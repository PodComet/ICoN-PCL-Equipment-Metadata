# Ontology validation and research exports

The catalog now has a formal RDF export and independent checks using Pint, Pydantic, RDFLib, pySHACL, NetworkX and scikit-learn. The app's **Evidence & sources** tab presents the committed snapshot and downloads. Live admin imports, private Purdue inventory and saved user plans are outside that snapshot. These checks do not establish that a scientific claim, link, apparatus configuration or operating procedure is correct.

## What changed

- **Pint** independently checks all 138 numeric unit definitions against the app registry, including temperature offsets and relative heating rates. It normalizes 248 numeric source conditions; 41 qualitative statements remain text. Physical bounds, integer cycle counts and compatible uncertainty units are checked during the data build. Gauge/absolute/unspecified pressure, RPM/RCF, concentration bases and standard/actual gas flow retain their distinct quantity kinds. Pint does not supply missing rotor dimensions, densities or gas reference conditions. See the [Pint documentation](https://pint.readthedocs.io/en/stable/).
- **Pydantic** validates typed science records, provenance and core instrument identity. Invalid numeric ranges, nonfinite numbers, empty evidence locators and unsupported fields fail before app-data export. Published schema contracts are downloadable; instrument identity contracts cover core fields rather than every optional catalog column. See [Pydantic validators](https://docs.pydantic.dev/latest/concepts/validators/).
- **RDFLib** exports stable identifiers and relationships for equipment, manufacturers, M/X classes, material/process routes, steps, formulations, conditions, reported properties and academic evidence. Category-level associations remain `catalogAssociation`, not exact-model suitability assertions. See [RDFLib](https://rdflib.readthedocs.io/en/stable/).
- **pySHACL** checks graph links and required evidence against the versioned [shapes](../catalog/ontology/shapes.ttl). Inference is disabled. Removing a source-evidence link or pointing to an undefined evidence node fails validation. See [pySHACL](https://github.com/RDFLib/pySHACL).
- **NetworkX** checks 49 source sequences, extension anchors and acyclicity. N10, P13 and P14 have no source sequence; this is recorded rather than filled with an invented method. A local workflow checker preserves explicit parallel branches and rejects cycles, missing parents and self-reference. Source-order predecessors describe the app's default planning sequence, not experimentally established causal dependencies. See [NetworkX DAG algorithms](https://networkx.org/documentation/stable/reference/algorithms/dag.html).
- **scikit-learn** uses character TF-IDF and cosine nearest neighbors to identify similar names within a manufacturer. Nine pairs above 0.90 were reviewed and retained as separate catalog entries: differing model numbers, suffixes, dimensions or generations. Eight already-curated cross-category contexts are recognized. Scores are review aids, not identity, successor or interchangeability evidence. No property model was fitted. See [NearestNeighbors](https://scikit-learn.org/stable/modules/generated/sklearn.neighbors.NearestNeighbors.html).

Six active Purdue-origin X classes now have explicit definitions in `catalog/supplemental_categories.csv`. The 97 M-class definitions remain in `categories.csv`; previously approved X-to-M migrations are unchanged. X-AM retains a broad additive-manufacturing definition while its records keep their distinct metal, hybrid and directed-energy method labels.

## Reproduce and validate

Python 3.11 or later:

```sh
python -m pip install -r requirements-dev.txt
python scripts/build_app_data.py
python ontology_tools.py --check
python -m pytest -q
```

Comparison-only users can keep using the smaller `requirements.txt`. Ontology curation uses `requirements-ontology.txt`; direct library versions are pinned to the reviewed installed versions. The audit records versions and LF-normalized SHA-256 hashes of the canonical inputs. Hashes identify the reviewed snapshot, not independently authenticated source documents.

Check a local process export without publishing it:

```sh
python ontology_tools.py --workflow path/to/saved-workflow.json
```

This command checks step identities and dependencies only. The app's own validator remains responsible for instrument suitability, required slots and scientific condition matching.

## Graph interpretation

The vocabulary namespace is `https://github.com/PodComet/ICoN-PCL-Equipment-Metadata/ontology#`; resource IDs use the repository's `/id/` namespace. These are identifiers, not a claim that each URI resolves to a hosted page or that this is an externally certified ontology.

- An `EquipmentModel` is a catalog record, not a physical inventory asset. The same model may have separate category-context records.
- `requiredAlternative` connects a step to OR branches. Requirements within a branch are jointly needed. Individual `EquipmentRequirement` nodes preserve repeated requirements for the same class. `requirementsJSON` preserves subtypes, optional branches and conditional overrides without simplifying them into unconditional requirements.
- `sourceOrderPredecessor` preserves default source ordering and is deliberately distinct from a validated causal prerequisite.
- `OperatingCondition` retains its original value, operator, unit, quantity kind, source scope and evidence. Canonical numbers supplement the original value rather than replacing it.
- `ReportedProperty` is a literature measurement. Its `supportsExpectation` flag preserves the app's limited conditional analogue admission; it does not assert experimental validation of a user's plan.
- `SourceEvidence` connects claims and locators to source URLs and academic references. No inference promotes background reading to exact-model evidence.

Literature-reported claims require an academic reference. Manufacturer facts can cite manufacturer documentation directly without an unrelated academic reference; a source URL, claim and locator are still required.

Query P20 conditions and their evidence with RDFLib:

```python
from rdflib import Graph
g = Graph().parse('catalog/ontology/ontology.ttl', format='turtle')
for row in g.query('''
PREFIX icon: <https://github.com/PodComet/ICoN-PCL-Equipment-Metadata/ontology#>
SELECT ?condition ?evidence WHERE {
  ?condition a icon:OperatingCondition ;
    icon:inRoute <https://github.com/PodComet/ICoN-PCL-Equipment-Metadata/id/route/P20> ;
    icon:supportedBy ?evidence .
}
'''):
    print(row)
```

The Turtle and JSON-LD exports represent the same graph. Stable ordering and explicit resource IDs avoid generated blank-node identities in the data graph. `--check` compares both graph formats, normalized conditions, JSON schemas, shapes and audit output to the committed files. A build failure stops publication of new generated data.

The original source PDFs and private asset identifiers remain local. Experimental validation of predicted properties remains future roadmap functionality.

The [metadata standards profile](metadata-standards.md) documents additive DCTERMS, PROV, SKOS, Schema.org and QUDT mappings, scoped eNanoMapper/NPO references and the ISA exchange crosswalk. QUDT values retain exactness and local quantity-kind distinctions; SHACL rejects missing unit IRIs. The graph is not a signed nanopublication.
