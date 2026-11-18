"""Validate the three-token metadata profile without executing a device or workflow."""
from __future__ import annotations

import argparse
from datetime import datetime
import hashlib
import json
from pathlib import Path
from urllib.parse import urlsplit, unquote

from jsonschema import Draft202012Validator, FormatChecker

ROOT = Path(__file__).resolve().parent
SCHEMA_PATH = ROOT / 'catalog/ontology/machine-recipe-run.schema.json'
EXAMPLE = ROOT / 'catalog/examples/three-token-3d/one-recipe-three-runs.json'


def _unique_object(pairs):
    value = {}
    for key, item in pairs:
        if key in value:
            raise ValueError('Duplicate JSON key: ' + key)
        value[key] = item
    return value


def load_json_bytes(raw):
    def reject_constant(value):
        raise ValueError('Non-finite JSON number: ' + value)
    return json.loads(raw.decode('utf-8'), object_pairs_hook=_unique_object,
                      parse_constant=reject_constant)


def recipe_token(raw: bytes) -> str:
    """Fingerprint exact manifest bytes, including whitespace and line endings."""
    return 'sha256:' + hashlib.sha256(raw).hexdigest()


def _index(records, key):
    result = {}
    for record in records:
        identifier = record[key]
        if identifier in result:
            raise ValueError('Duplicate ' + key + ': ' + identifier)
        result[identifier] = record
    return result


def _local_file(directory, uri):
    parsed = urlsplit(uri)
    if parsed.scheme or parsed.netloc or parsed.query or parsed.fragment:
        raise ValueError('This offline validator needs a relative local artifact URI: ' + uri)
    directory = Path(directory).resolve()
    target = (directory / unquote(parsed.path)).resolve()
    if not target.is_relative_to(directory):
        raise ValueError('Artifact path leaves the supplied package directory')
    return target


def _check_artifact(artifact, directory):
    path = _local_file(directory, artifact['uri'])
    if hashlib.sha256(path.read_bytes()).hexdigest() != artifact['sha256']:
        raise ValueError('Artifact checksum mismatch: ' + artifact['uri'])


def _check_plan(manifest, directory):
    roles = _index(manifest['machine_roles'], 'role_id')
    steps = _index(manifest['steps'], 'step_id')
    _index(manifest['input_roles'], 'role_id')
    sequences, actions = {}, {}
    visited, active = set(), set()

    def visit(step_id):
        if step_id not in steps:
            raise ValueError('Unresolved prerequisite step: ' + step_id)
        if step_id in active:
            raise ValueError('Cyclic recipe prerequisites')
        if step_id in visited:
            return
        active.add(step_id)
        for parent in steps[step_id]['prerequisite_step_ids']:
            visit(parent)
        active.remove(step_id)
        visited.add(step_id)

    for step in steps.values():
        visit(step['step_id'])
        for sequence in step['instruction_sequences']:
            sid = sequence['sequence_id']
            if sid in sequences:
                raise ValueError('Duplicate sequence_id: ' + sid)
            if sequence['machine_role'] not in roles:
                raise ValueError('Unresolved sequence machine role')
            sequences[sid] = (step['step_id'], sequence)
            for action in sequence['actions']:
                aid = action['action_id']
                if aid in actions:
                    raise ValueError('Duplicate action_id: ' + aid)
                actions[aid] = action
    geometry = manifest.get('geometry')
    if geometry:
        _check_artifact(geometry['design'], directory)
        for dimension in geometry['dimensions'].values():
            if dimension['value'] <= 0:
                raise ValueError('Geometry dimensions must be positive')
        latent = geometry.get('latent_representation')
        if latent:
            _check_artifact(latent['artifact'], directory)
            _check_artifact(latent['decoder_checkpoint'], directory)
    return roles, sequences


def metadata_gaps(run, manifest, machines):
    """Static completeness only; a live controller must still verify runtime conditions."""
    gaps = []
    for binding in run['machine_bindings']:
        machine = machines[binding['machine_token']]
        if machine['registration_status'] != 'registered_physical_unit':
            gaps.append('physical machine registration')
        for field in ['controller', 'driver', 'interfaces']:
            if not machine[field]:
                gaps.append('machine ' + field)
    bindings = {b['input_role'] for key in ['material_bindings','utility_bindings','data_bindings'] for b in run[key]}
    for role in manifest['input_roles']:
        if role['required'] and role['role_id'] not in bindings:
            gaps.append('input role ' + role['role_id'])
    if any(b['binding_status'] == 'illustrative_planned' for b in run['material_bindings']):
        gaps.append('verified material loading')
    for step in manifest['steps']:
        for sequence in step['instruction_sequences']:
            for action in sequence['actions']:
                if action['definition_status'] != 'documented_model_bound' or not action['operation_reference']:
                    gaps.append('model-bound operation ' + action['action_id'])
                for parameter in action['parameters']:
                    if parameter['status'] == 'unresolved' or parameter['value'] is None:
                        gaps.append('operation parameter ' + parameter['parameter_id'])
        for parameter in step['parameters']:
            if parameter['status'] == 'unresolved' or parameter['value'] is None:
                gaps.append('step parameter ' + parameter['parameter_id'])
    for parameter in manifest.get('geometry', {}).get('tolerances', []):
        if parameter['status'] == 'unresolved' or parameter['value'] is None:
            gaps.append('geometry tolerance ' + parameter['parameter_id'])
    return sorted(set(gaps))


def validate_bundle(bundle, directory, schema=None):
    schema = schema or load_json_bytes(SCHEMA_PATH.read_bytes())
    Draft202012Validator.check_schema(schema)
    checker = FormatChecker()
    Draft202012Validator(schema, format_checker=checker).validate(bundle)
    manifest_schema = {'$schema':schema['$schema'], '$defs':schema['$defs'], '$ref':'#/$defs/RecipeManifest'}
    machines = _index(bundle['machines'], 'machine_token')
    recipes = _index(bundle['recipes'], 'recipe_token')
    _index(bundle['runs'], 'run_token')
    manifests, plans = {}, {}
    source_path = Path(directory) / 'sources.json'
    source_ids = None
    if source_path.exists():
        source_ids = set(_index(load_json_bytes(source_path.read_bytes())['entries'], 'id'))
        for machine in machines.values():
            if not set(machine['evidence_ids']).issubset(source_ids):
                raise ValueError('Unresolved example-local machine evidence')
    for token, reference in recipes.items():
        raw = _local_file(directory, reference['manifest_uri']).read_bytes()
        if recipe_token(raw) != token:
            raise ValueError('Recipe token does not match frozen manifest bytes')
        manifest = load_json_bytes(raw)
        Draft202012Validator(manifest_schema, format_checker=checker).validate(manifest)
        if source_ids is not None and not set(manifest['source_ids']).issubset(source_ids):
            raise ValueError('Unresolved example-local recipe source')
        manifests[token] = manifest
        plans[token] = _check_plan(manifest, directory)
    all_specimens, assessments = set(), []
    for run in bundle['runs']:
        token = run['recipe_token']
        if token not in recipes:
            raise ValueError('Unresolved run recipe_token')
        manifest = manifests[token]
        roles, sequences = plans[token]
        bindings = _index(run['machine_bindings'], 'machine_role')
        if set(bindings) != set(roles):
            raise ValueError('Run must bind every recipe machine role exactly once')
        for role, binding in bindings.items():
            machine = machines.get(binding['machine_token'])
            if machine is None:
                raise ValueError('Unresolved physical machine_token')
            expected = roles[role]['catalog_equipment_ids']
            if expected and machine['catalog_equipment_id'] not in expected:
                raise ValueError('Machine model not admitted by recipe role')
        input_roles = {r['role_id']:r for r in manifest['input_roles']}
        for kind, key in [('material','material_bindings'),('utility','utility_bindings'),('data','data_bindings')]:
            _index(run[key], 'input_role')
            for binding in run[key]:
                role = input_roles.get(binding['input_role'])
                if role is None or role['kind'] != kind:
                    raise ValueError('Input binding has unresolved role or incompatible kind')
                if kind == 'material' and binding['quantity']['value'] < 0:
                    raise ValueError('Material loading quantity cannot be negative')
                if kind == 'data':
                    _check_artifact(binding['artifact'], directory)
        _index(run['instruction_executions'], 'execution_id')
        for execution in run['instruction_executions']:
            pair = sequences.get(execution['sequence_id'])
            if pair is None or pair[0] != execution['step_id']:
                raise ValueError('Execution does not reference its recipe step and sequence')
            if execution['action_ids'] != [a['action_id'] for a in pair[1]['actions']]:
                raise ValueError('Executed action order differs from referenced sequence')
        gaps = metadata_gaps(run, manifest, machines)
        if (run['status'] == 'ready' or run['execution_readiness']['status'] == 'ready') and gaps:
            raise ValueError('Run claims ready with incomplete execution metadata: ' + ', '.join(gaps))
        if run['scope'] == 'illustrative_planned':
            if run['status'] != 'planned' or run['generated_specimens'] or run.get('started_at') or run.get('ended_at'):
                raise ValueError('Illustrative planned record cannot assert an actual execution or result')
        if run['status'] == 'completed':
            if not run.get('started_at') or not run.get('ended_at') or not run['generated_specimens']:
                raise ValueError('Completed manufacturing record requires actual times and generated specimens')
        if run.get('ended_at') and not run.get('started_at'):
            raise ValueError('Actual ending requires an actual start')
        if run.get('ended_at') and datetime.fromisoformat(run['ended_at'].replace('Z','+00:00')) < datetime.fromisoformat(run['started_at'].replace('Z','+00:00')):
            raise ValueError('Actual ending precedes start')
        for specimen in run['expected_specimens']:
            sid = specimen['specimen_id']
            if sid in all_specimens:
                raise ValueError('Different runs cannot share an expected specimen identity')
            all_specimens.add(sid)
        assessments.append({'run_token':run['run_token'],'metadata_gaps':gaps,
                            'scope':'Static metadata checks only; no device execution or runtime validation.'})
    return {'profile':bundle['profile'],'machines':len(machines),'recipes':len(recipes),
            'runs':len(bundle['runs']),'assessments':assessments}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('bundle', nargs='?', type=Path, default=EXAMPLE)
    args = parser.parse_args()
    result = validate_bundle(load_json_bytes(args.bundle.read_bytes()), args.bundle.parent)
    print(json.dumps(result, indent=2))
