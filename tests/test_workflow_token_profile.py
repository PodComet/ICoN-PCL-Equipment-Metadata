import copy
import json
from pathlib import Path
import shutil

import pytest
from jsonschema import ValidationError
from rdflib import Graph, URIRef
from rdflib.namespace import RDF, RDFS

from workflow_token_tools import EXAMPLE, ROOT, SCHEMA_PATH, load_json_bytes, recipe_token, validate_bundle


@pytest.fixture
def example(tmp_path):
    for file in EXAMPLE.parent.iterdir():
        if file.is_file():
            shutil.copy2(file, tmp_path/file.name)
    return load_json_bytes((tmp_path/EXAMPLE.name).read_bytes()), tmp_path


def rewrite_manifest(bundle, directory, mutate):
    reference = bundle['recipes'][0]
    path = directory/reference['manifest_uri']
    manifest = load_json_bytes(path.read_bytes())
    mutate(manifest)
    path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False)+'\n', encoding='utf-8', newline='\n')
    old = reference['recipe_token']
    new = recipe_token(path.read_bytes())
    reference['recipe_token'] = new
    for run in bundle['runs']:
        if run['recipe_token'] == old:
            run['recipe_token'] = new
    return manifest


def test_one_recipe_multiple_runs_have_distinct_identity_and_shared_immutable_content(example):
    bundle, directory = example
    result = validate_bundle(bundle, directory)
    assert (result['machines'], result['recipes'], result['runs']) == (1,1,3)
    assert len({r['run_token'] for r in bundle['runs']}) == 3
    assert len({r['recipe_token'] for r in bundle['runs']}) == 1
    assert len({r['expected_specimens'][0]['specimen_id'] for r in bundle['runs']}) == 3
    assert all(r['generated_specimens'] == [] for r in bundle['runs'])
    assert all(a['metadata_gaps'] for a in result['assessments'])


def test_hash_policy_verifies_exact_bytes_and_detects_manifest_or_geometry_changes(example):
    bundle, directory = example
    manifest = directory/bundle['recipes'][0]['manifest_uri']
    manifest.write_bytes(manifest.read_bytes()+b' ')
    with pytest.raises(ValueError, match='frozen manifest'):
        validate_bundle(bundle,directory)


def test_changed_linked_design_cannot_hide_behind_unchanged_recipe_token(example):
    bundle,directory=example
    design=directory/'annular-coupon.scad'
    design.write_bytes(design.read_bytes()+b'\n// revised\n')
    with pytest.raises(ValueError,match='Artifact checksum mismatch'):
        validate_bundle(bundle,directory)


def test_two_sequences_in_one_step_are_distinct_and_correspond_to_each_run(example):
    bundle,directory=example
    manifest=load_json_bytes((directory/'annular-coupon.recipe.json').read_bytes())
    s2=next(s for s in manifest['steps'] if s['step_id']=='S2')
    assert [s['sequence_id'] for s in s2['instruction_sequences']]==['S2-A','S2-B']
    for run in bundle['runs']:
        occurrences=[e for e in run['instruction_executions'] if e['step_id']=='S2']
        assert len({e['execution_id'] for e in occurrences})==2
    bundle['runs'][0]['instruction_executions'][1]['sequence_id']='S1-A'
    with pytest.raises(ValueError,match='recipe step and sequence'):
        validate_bundle(bundle,directory)


def test_recipe_can_require_more_than_one_machine_without_forcing_a_tree(example):
    bundle,directory=example
    other=copy.deepcopy(bundle['machines'][0])
    other['machine_token']='urn:uuid:51cfd187-717b-4918-9a25-f20d5c0a0f10'
    bundle['machines'].append(other)
    rewrite_manifest(bundle,directory,lambda m:m['machine_roles'].append({**copy.deepcopy(m['machine_roles'][0]),'role_id':'second_printer'}))
    for run in bundle['runs']:
        run['machine_bindings'].append({'machine_role':'second_printer','machine_token':other['machine_token'],'configuration':[]})
    assert validate_bundle(bundle,directory)['machines']==2


@pytest.mark.parametrize('broken',['recipe','machine','duplicate_run'])
def test_unresolved_or_duplicate_primary_tokens_are_rejected(example,broken):
    bundle,directory=example
    if broken=='recipe':bundle['runs'][0]['recipe_token']='sha256:'+'a'*64
    elif broken=='machine':bundle['runs'][0]['machine_bindings'][0]['machine_token']='urn:uuid:51cfd187-717b-4918-9a25-f20d5c0a0f10'
    else:bundle['runs'][1]['run_token']=bundle['runs'][0]['run_token']
    with pytest.raises(ValueError):validate_bundle(bundle,directory)


def test_cycle_is_not_an_executable_step_order(example):
    bundle,directory=example
    rewrite_manifest(bundle,directory,lambda m:m['steps'][0].update(prerequisite_step_ids=['S4']))
    with pytest.raises(ValueError,match='Cyclic recipe'):
        validate_bundle(bundle,directory)


def test_3d_workflow_requires_geometry_but_material_metadata_can_be_bound_per_run(example):
    bundle,directory=example
    manifest=load_json_bytes((directory/'annular-coupon.recipe.json').read_bytes())
    assert manifest['material_requirements']==[]
    assert all(r['material_bindings'][0]['batch_id'] for r in bundle['runs'])
    validate_bundle(bundle,directory)
    rewrite_manifest(bundle,directory,lambda m:m.pop('geometry'))
    with pytest.raises(ValidationError,match='geometry'):
        validate_bundle(bundle,directory)


def test_tokens_alone_cannot_mark_an_incomplete_machine_plan_ready(example):
    bundle,directory=example
    bundle['runs'][0]['execution_readiness']={'status':'ready','missing_requirements':[]}
    with pytest.raises(ValueError,match='incomplete execution metadata'):
        validate_bundle(bundle,directory)


def test_planned_record_cannot_assert_manufactured_outputs_or_execution_times(example):
    bundle,directory=example
    run=bundle['runs'][0]
    run['generated_specimens']=copy.deepcopy(run['expected_specimens'])
    with pytest.raises(ValueError,match='cannot assert an actual execution'):
        validate_bundle(bundle,directory)


def test_completed_manufacturing_run_needs_actual_times_and_specimens(example):
    bundle,directory=example
    run=bundle['runs'][0]
    run.update(scope='recorded_execution',status='completed')
    with pytest.raises(ValueError,match='actual times and generated specimens'):
        validate_bundle(bundle,directory)


def test_json_source_and_ontology_namespaces_preserve_reproducibility():
    for raw in [b'{"x":1,"x":2}',b'{"x":NaN}',b'{"x":Infinity}']:
        with pytest.raises(ValueError):load_json_bytes(raw)
    schema=json.loads(SCHEMA_PATH.read_text(encoding='utf-8'))
    assert schema['x-relations']['run_to_recipe'].startswith('exactly one')
    assert len(schema['x-field-mappings'])==38
    graph=Graph().parse(ROOT/'catalog/ontology/machine-recipe-run.ttl',format='turtle')
    icon='https://github.com/PodComet/ICoN-PCL-Equipment-Metadata/ontology#'
    assert (URIRef(icon+'ManufacturingRecipe'),RDFS.subClassOf,URIRef('http://www.w3.org/ns/prov#Plan')) in graph
    assert (URIRef(icon+'PlannedManufacturingRun'),RDFS.subClassOf,URIRef('http://www.w3.org/ns/prov#Entity')) in graph
    assert (URIRef(icon+'PlannedManufacturingRun'),RDFS.subClassOf,URIRef('http://www.w3.org/ns/prov#Activity')) not in graph
