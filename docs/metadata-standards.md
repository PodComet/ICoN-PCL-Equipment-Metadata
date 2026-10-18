# Metadata formats and field names

Reviewed 17 October 2026 using the installed [Knowledge Pixels nanopub skill](https://github.com/knowledgepixels/nanopub-skill), the [nanopublication guidelines](https://nanopub.net/guidelines/working_draft/), [eNanoMapper](https://www.enanomapper.net/ontology), [ISA-JSON](https://isa-specs.readthedocs.io/en/latest/isajson.html), [QUDT](https://qudt.org/doc/2026/06/DOC_SCHEMA-QUDT.html) and the referenced vocabulary specifications. The skill's source URL and installed file digest are recorded in the [machine-readable profile](../catalog/metadata-profile.json).

Nanopublications are a domain-independent format for citable RDF claims with provenance. They do not define a nanomaterial database schema. The public catalog remains RDF/Turtle and JSON-LD; research packages remain RO-Crate. Internal CSV column names and workflow JSON are versioned application contracts. An additive exchange mapping preserves existing imports and saved plans.

| Information | Exchange representation |
|---|---|
| IDs and labels | `dct:identifier`, `rdfs:label` |
| Named manufacturer and model | `https://schema.org/ProductModel`, `schema:manufacturer`, `schema:Organization`; unspecified manufacturers remain local |
| Product page, image, documentation | `schema:url`, `schema:image`, `dct:references`, retaining exact-model/family scope |
| M/X, P and N classifications | Local identifiers organized as `skos:Concept` and `skos:ConceptScheme` |
| Extracted source evidence | `prov:Entity`, `prov:wasDerivedFrom`, source locator and original claim |
| Exact normalized setting | `qudt:QuantityValue`, `qudt:numericValue` as `xsd:decimal`, `qudt:unit` as a reviewed unit IRI |
| Uploaded file variable units | `schema:unitCode` with the QUDT URL or a `UCUM:`-prefixed code; `schema:unitText` retains source spelling |
| Future ISA exchange | `processSequence`, `parameterValues`, material `characteristics`; ontology annotations use `annotationValue`, `termAccession`, `termSource` |

The research JSON-LD exporter previously wrote a nonstandard `unitID` field and bare UCUM codes into `unitCode`. It now follows [Schema.org's unitCode definition](https://schema.org/unitCode) and [unitText](https://schema.org/unitText). Existing saved records and original instrument files are preserved; only generated exchange metadata changes.

The [reviewed material-term table](../catalog/ontology_term_references.csv) links seven N families to eight NPO terms present in eNanoMapper. N06 has separate lipid nanoparticle and liposome references. They are scoped `rdfs:seeAlso` links, not equivalence assertions or classifications of every material instance. N04, N07 and N10 await reviewed mappings. An external term label and IRI must be checked together; labels alone do not establish equivalence.

Ranges, inequalities, unrecognized units, pH, reference gas flows and ambiguous fraction bases retain their original operators, values, units and local quantity kinds. They are not flattened to exact QUDT point values. Gauge and absolute pressures stay distinct. Model-class relevance is not promoted into evidence that an exact model can execute a specific synthesis. Reported properties and unvalidated planning expectations remain separate.

## Nanopublication preparation

The current public graph is not a signed nanopublication. A future claim export must have four named graphs: Head, assertion, provenance and pubinfo; `np:hasAssertion`, `np:hasProvenance` and `np:hasPublicationInfo` link them. It also needs a real author/signer identity, UTC timestamp, explicit rights, appropriate assertion/provenance/pubinfo template IRIs and validation before signing. No ORCID, license, digital signature or trusty URI is fabricated. No data was sent to a nanopublication registry by this update.

The ISA crosswalk documents field names; it does not claim an ISA-JSON or ISA-TAB-Nano-conformant export. Those need a separate complete submission model and community validation. M/P/N codes remain local to this project.

## Reproduce

Run `python ontology_tools.py --check` and `python -m pytest -q` from the repository root. Regenerate after reviewed changes with `python ontology_tools.py`. SHACL checks require exactly one numeric decimal, unit IRI and retained local quantity kind per exported QUDT value. Tests reject missing units and verify round trips, scoped external references and preservation of range semantics. The app's **Ontology validation & downloads** offers the profile, vocabulary links, graph and validation rules.
