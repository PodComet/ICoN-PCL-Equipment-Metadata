# Equipment RDF export

The catalog contains **1,125 equipment/model records**. The nested RDF/XML snapshot is dated **2026-11-11**. The Turtle snapshot is dated **2026-11-04**.

| File | Use |
| --- | --- |
| [equipment.rdf](../catalog/ontology/equipment.rdf) | Nested RDF/XML equipment profile |
| [equipment-xml-export.json](../catalog/ontology/equipment-xml-export.json) | RDF/XML coverage, source hashes and file checksum |
| [equipment.ttl](../catalog/ontology/equipment.ttl) | RDF/Turtle equipment snapshot |
| [equipment-export.json](../catalog/ontology/equipment-export.json) | Turtle snapshot counts, source hashes and file checksum |

The equipment exports use the same model identifiers and different RDF profiles. The site serves the nested XML at [the equipment RDF/XML endpoint](https://iconpcl.podcomet.ai/ontology/equipment.rdf) after sign-in. [Whole-ontology exports](../catalog/ontology/ontology.ttl) cover the wider knowledge graph.

## Nested RDF/XML profile

Each equipment ID has one top-level `rdf:Description`. The model name, identifier and manufacturer link appear directly on the machine. Typed resources nest its classification and variant details, I/O, associations, documentation, photo, pricing and review. Shared manufacturers, classifications, vocabulary definitions and evidence records are referenced by URI and defined once in the file.

Each model or subrecord points to its originating catalog row with `prov:wasDerivedFrom` and a `#row=` fragment. The row number counts the CSV header and then logical data rows, including rows with multiline fields. Document URLs, locators and checked dates accompany sourced facts when recorded.

| Field or section | Vocabulary and catalog source |
| --- | --- |
| Equipment identifier and model name | `dct:identifier` from `equipment.csv.equipment_id` and `schema:name` from `model_name`. [DCMI terms](https://www.dublincore.org/specifications/dublin-core/dcmi-terms/), [Schema.org name](https://schema.org/name) |
| Manufacturer | `schema:manufacturer` links to a shared organization named from `manufacturers.csv.manufacturer`. Website and research review come from the same row. Unspecified manufacturers use the local `icon:manufacturer` link. [Schema.org manufacturer](https://schema.org/manufacturer), [Organization](https://schema.org/Organization) |
| Classification, functionality and variant | `icon:inCategory` from `equipment.csv.category_id` points to a SKOS concept named in the category table. `icon:equipmentSubtype` retains the source functionality label when present. Variant label and grouping provenance come from `product_families.csv`. A documented `capacity_ml` becomes a QUDT quantity value in millilitres. [SKOS](https://www.w3.org/TR/skos-reference/), [QUDT millilitre](https://qudt.org/vocab/unit/MilliL) |
| I/O and measuring units | `icon:inputDescription`, `icon:outputDescription` and `icon:measuringUnitsDescription` retain the corresponding `equipment_io.csv` fields. The section cites its exact catalog row and its manual/specification URLs. `icon:reportedUnit` links recognized symbols to QUDT. The [reviewed symbol mappings](../catalog/equipment-xml-units.json) use the [QUDT 3.5.3 vocabulary](https://qudt.org/3.5.3/vocab/unit). |
| Materials and processes | `icon:catalogMaterial` and `icon:catalogProcess` come from `related_material_ids` and `related_process_ids`. Their shared names and provenance come from `routes.csv`. The association basis identifies the scope of each model's relevance. Reviewed [eNanoMapper/NPO terminology links](../catalog/ontology/ontology-term-references.csv) attach to material concepts via `rdfs:seeAlso` with their original source and scope. [EMBL-EBI eNanoMapper](https://www.ebi.ac.uk/ols4/ontologies/enm) |
| Documentation and media | Manufacturer pages, manuals, specifications and brochures come from their respective URL fields in `equipment.csv`. A single document URL can carry multiple roles. The photograph uses `schema:ImageObject` with its URL, source and scope from the catalog image fields. [DigitalDocument](https://schema.org/DigitalDocument), [ImageObject](https://schema.org/ImageObject) |
| Pricing | `schema:PriceSpecification` uses the amount, currency and checked date from the equipment, seller-offer or estimate row. Its source URL identifies the offer or estimate evidence. Foreign-currency quotes retain their original amount, currency and rate citation. [PriceSpecification](https://schema.org/PriceSpecification) |
| Reviews and evidence | Model, manual and price review status comes from `equipment.csv`. Lifecycle facts come from `model_lifecycle.csv`. Shared claims, locators and original citations come from `evidence_registry.csv`. [PROV-O](https://www.w3.org/TR/prov-o/) |

QUDT links cover recognized unit symbols in the measuring-units field, plus a reviewed mapping of the Legato 210 narrative. The original wording retains distinctions such as AC/DC context. The export represents unsupported or ambiguous symbols as source text. Catalog material and process links indicate recorded relevance at the stated scope. Model-specific use requires corresponding evidence.

## Turtle snapshot

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
python scripts/export_equipment_xml.py --date 2026-11-11
```

The date identifies the export snapshot and does not replace source-check dates. To export elsewhere, add `--output-dir /path/to/output`. Input hashes normalize CRLF line endings to LF, following the existing ontology-export policy. Output checksums describe the actual generated file bytes. All record identifiers are explicit URI resources; no generated blank-node identifiers are required.

The exporters reject duplicate or unresolved IDs and mismatched equipment identities in auxiliary tables. Each exporter parses its own serialization and checks its round trip. The XML exporter also checks that the document has exactly one top-level description per equipment ID. Use `--sample sample.rdf` with the XML exporter to extract the Legato 210 record. The full export resolves shared resource definitions.

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
