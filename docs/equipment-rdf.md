# Equipment RDF export

Snapshot: **2026-11-04**. This equipment-focused export contains **1,125 equipment/model catalog records** and **100,679 RDF statements**, including linked manufacturers, categories, material/process associations, model families, model lifecycle information, documentation, photographs, price metadata and directly linked catalog evidence.

| File | Use |
| --- | --- |
| [equipment.ttl](../catalog/ontology/equipment.ttl) | RDF/Turtle: readable, compact representation |
| [equipment.rdf](../catalog/ontology/equipment.rdf) | RDF/XML: equivalent graph for applications that request `.rdf` files |
| [equipment-export.json](../catalog/ontology/equipment-export.json) | Counts, source hashes, output hashes, snapshot date and validation results |

Both RDF files are self-contained and represent the same graph. Existing [whole-ontology exports](../catalog/ontology/ontology.ttl) remain separate. This new export includes the latest equipment Input, Output and Measuring units spreadsheet import, including the corrected KD Scientific Legato 210 entry.

## Contents and interpretation

- Every `equipment_id` has its own `icon:EquipmentModel` / `schema:ProductModel` resource. Variants, duplicated model names and separate category-context records retain distinct identifiers. The record count is not a physical inventory count.
- Equipment identifiers reuse the project's existing namespace, for example `https://github.com/PodComet/ICoN-PCL-Equipment-Metadata/id/equipment/M07-08`. Identifiers do not imply that each URI resolves to its own web page.
- **1,115** records have model-bound I/O profiles; **10** have `icon:inputOutputStatus "no_exact_model_data"`. Input/output states and measuring units remain source descriptions. They are also available as named `schema:PropertyValue` records. Descriptions are not converted into an executable interface or unqualified formal unit assertions.
- **331** explicit catalog price quotes and **124** estimates are separate resource types. Amounts are in USD with the source currency, original amount, quote date, price kind, condition and source retained. Foreign-source quotes use the project's **2026-10-16** currency reference. No price was refreshed during this export. Missing prices are absent rather than zero.
- Estimates use `icon:PriceEstimate` and `schema:minPrice` / `schema:maxPrice`, with their method, basis and confidence. They are not asserted as actual manufacturer offers or MSRP facts.
- **219** catalog evidence records directly related to equipment retain their evidence IDs, claims, scopes, source URLs and locators. These are provenance records; they are not signed nanopublications.
- `icon:catalogAssociation` means scoped catalog relevance. It does not certify exact-model suitability. `icon:inProductFamily` preserves display grouping without asserting `owl:sameAs` or feature inheritance across variants.
- Verification labels and original scope notes are retained. A candidate entry does not become a verified model merely because it appears in RDF.

Only explicitly listed public catalog inputs and fields are read. Private inventory identifiers, serial numbers, Purdue membership flags, credentials, saved user plans, source spreadsheet files, PDFs and image files are excluded. Public document links and textual provenance are retained. Third-party content keeps its own rights; the software license does not relicense it.

## Reproduce

From the repository root, with Python 3.11 or later:

```sh
python -m pip install -r requirements-rdf.txt
python scripts/export_equipment_rdf.py --date 2026-11-04
```

The date identifies the export snapshot and does not replace source-check dates. To export elsewhere, add `--output-dir /path/to/output`. Input hashes normalize CRLF line endings to LF, following the existing ontology-export policy. Output checksums describe the actual generated file bytes. All record identifiers are explicit URI resources; no generated blank-node identifiers are required.

The exporter rejects duplicate or unresolved IDs and mismatched equipment identities in auxiliary tables. It independently parses both serializations and verifies graph equivalence before writing the manifest. The dedicated tests additionally check record coverage, the current Legato 210 correction, missing I/O, price separation, currency provenance and exclusion of an injected private inventory column:

```sh
python -m pytest -q tests/test_equipment_rdf.py
```

## Query example

```python
from rdflib import Graph

g = Graph().parse("catalog/ontology/equipment.ttl", format="turtle")
for row in g.query("""
PREFIX icon: <https://github.com/PodComet/ICoN-PCL-Equipment-Metadata/ontology#>
PREFIX dct: <http://purl.org/dc/terms/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT ?id ?model ?input ?output ?units WHERE {
  ?equipment a icon:EquipmentModel ;
             dct:identifier ?id ; rdfs:label ?model .
  OPTIONAL {
    ?equipment icon:inputOutputProfile ?profile .
    OPTIONAL { ?profile icon:inputDescription ?input }
    OPTIONAL { ?profile icon:outputDescription ?output }
    OPTIONAL { ?profile icon:measuringUnitsDescription ?units }
  }
}
ORDER BY ?id
"""):
    print(row)
```

## Exchange terms

The export follows the existing [project metadata profile](../catalog/metadata-profile.json), using [W3C Turtle](https://www.w3.org/TR/turtle/), [Schema.org ProductModel](https://schema.org/ProductModel) and [PropertyValue](https://schema.org/PropertyValue), DCTERMS, PROV, SKOS and DCAT alongside documented project properties. It does not assert a community certification or external ontology equivalence.
