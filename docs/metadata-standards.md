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

### Machine, recipe and run tokens

The 18 November 2026 additive [JSON Schema](../catalog/ontology/machine-recipe-run.schema.json) and [vocabulary extension](../catalog/ontology/machine-recipe-run.ttl) define three primary tokens. A physical unit has a UUID under `machine_token`, distinct from the catalog's make/model `equipment_id`. A `recipe_token` is `sha256:` followed by the exact-byte SHA-256 of a frozen recipe manifest. Each specific run/attempt has a separate UUID under `run_token` and references the recipe token it used. One machine can serve many recipes, and one recipe can coordinate several machine roles and be reused across many runs. Local sequence, action and specimen IDs and artifact checksums are supporting identifiers, not additional primary token tiers.

The recipe manifest includes ordered steps and prerequisites, multiple Position/Fiber/Direction instruction sequences per step, model requirements, unit-aware settings, preconditions, completion/error signals and expected outputs. A 3D manufacturing recipe also references its design artifact, physical dimensions, coordinate system, build orientation and tolerances. Material metadata is optional in the recipe; required material, utility and data roles must be bound at run launch, including feedstock batch/quantity and a compatible qualified machine program. The controller endpoint, protocol and exact adapter artifact are distinct from the metadata-record registry address. Credentials are not part of the public manifest.

The [example package](../catalog/examples/three-token-3d/one-recipe-three-runs.json) links one illustrative AM400 physical-unit identity and one frozen [annular-coupon recipe](../catalog/examples/three-token-3d/annular-coupon.recipe.json) to three distinct planned run UUIDs and three expected specimen IDs. Runs 1 and 2 use the same demonstration material batch; run 3 uses another. The [design file](../catalog/examples/three-token-3d/annular-coupon.scad) specifies a 12 mm outer diameter, 8 mm inner diameter and 10 mm height. [Purdue MMRL](https://engineering.purdue.edu/MMRL/equipment/renishaw-am400) documents the make/model and LPBF capability, not these illustrative UUIDs, commands, feedstock bindings or results. All runs remain planned and blocked. No manufactured specimen or measured result is asserted.

Hash the frozen manifest file's bytes, without the token wrapper or run records. Example files use UTF-8 JSON, two-space indentation, LF line endings and a final LF. This is the explicit `sha256-exact-manifest-bytes/v1` policy, not RFC 8785 canonicalization. A byte change, or a change to the checksum of a linked design/instruction artifact recorded in that manifest, creates a new recipe token. Retrieved artifacts must also pass their own checksum checks. UUIDs locate records; SHA-256 verifies content. Neither is an access credential or an encoding that recovers instructions by itself.

[ZipTok3D](https://doi.org/10.48550/arXiv.2609.01740) supplies the optional learned-geometry concept. Preserve the latent artifact, tokenizer/decoder checkpoint checksums, retained prefix length K, refinement count L, numeric precision, normalization/inverse transforms, mesh extraction settings and dimensional validation. A learned reconstruction does not replace an authoritative design or qualify a manufacturing program. This manufacturing profile is an ICoN-PCL extension, not a format claimed by that article.

The exchange crosswalk uses SAREF for physical devices, PROV-O for plans and actual executions, P-Plan for step structure, QUDT for quantities, and SPDX for checksums. `prov:hadPlan` belongs on a qualified `prov:Association`; planned records do not assert actual `prov:used`, `prov:Activity` or `prov:wasGeneratedBy` facts. The local `icon:` terms are explicitly declared in the extension. These mappings do not claim a community-certified autonomous-lab standard.

Install `requirements-ontology.txt`, then run `python workflow_token_tools.py` to validate the example's schema, exact hashes, artifact links, role bindings, dependencies and run/sequence references. This offline validator and metadata profile do not implement device drivers, a scheduler, live interlock/signal observation or execution. Existing live workflows, evidence records and catalog model IDs are not migrated.

Run `python ontology_tools.py --check` and `python -m pytest -q` from the repository root. Regenerate after reviewed changes with `python ontology_tools.py`. SHACL checks require exactly one numeric decimal, unit IRI and retained local quantity kind per exported QUDT value. Tests reject missing units and verify round trips, scoped external references and preservation of range semantics. The app's **Ontology validation & downloads** offers the profile, vocabulary links, graph and validation rules.
