# ICoN-PCL Equipment Metadata

The [US Nano and UCLA INML ingestion](docs/usnano-ucla-ingestion-2026-10-18.md) adds 38 supplier pack prices across 17 material grades/forms, 15 scoped UCLA source/substrate/cryogen options, 14 equipment/configuration records, nine M classes (M100–M108) and two capability-derived MBE routes (P46–P47). Commercial alternatives remain separate from article formulations; reference microscopy and installed-setup images retain their scope. New MBE slots enforce nitride versus arsenide/antimonide configuration.

The [United Scientific catalog review](docs/united-catalog-review-2026-10-18.md) screens both 2026 catalogs (1,168 PDF pages) and adds three USD dealer offers and one verified photo for the MSL3X1 72-slide pack compatible with P27's reusable substrate. No exact existing instrument models matched; the manufacturer catalogs omit retail prices.

The [KEYENCE catalog review](docs/keyence-catalog-review-2026-10-18.md) adds the missing VR-6000 brochure link and a USD 11,550 **controller-only** distributor reference. The existing series photo was reverified. No complete-system price, MSRP or new photo is claimed; the catalog PDF requires KEYENCE sign-in.

The [18 October price review](docs/price-resweep-2026-10-18.md) adds 42 price observations for 41 existing instrument models and 33 distinct material pack quotes across 16 identities. Sources include manufacturer shops, distributor catalogs and labeled resale offers. Prices display in USD, retain native amounts and configuration/condition scope, and have searchable evidence IDs. Seven previously uncovered component occurrences gained compatible pack offers; reference-only grades and prepared-solution mismatches remain excluded from automatic costs.

The **Visuals** tab provides live process-context and process-chain graphs, following the process-centered patterns of Garcia Trelles et al. (2024). It reads current ontology data and saved revisions, preserves evidence and units, and offers SVG / JSON / RDF exports. See [dynamic visuals and scientific scope](docs/visuals.md).

The [metadata standards review](docs/metadata-standards.md) adds standard field mappings, scoped eNanoMapper/NPO term references and QUDT quantity values to the public RDF graph, and corrects RO-Crate unit field names. The portable local preview opens automatically as **admin**; see [local administration](webapp/docs/local-admin.md). Hosted authentication remains enforced.

The **Research data / ELN** tab adds an openBIS-style Space / Project / Collection / Object / Data set workspace, instrument-export ingestion, private records and explicit sharing, revision history, qualified provenance and portable RO-Crate packages. See the [FAIR research-data guide](docs/FAIR_RESEARCH_DATA.md) and [machine-readable standards map](catalog/research_standards.json). This is a local ELN/LIMS foundation, not a connected openBIS server.

**Current catalog snapshot (18 October 2026):** 1,093 equipment/model/category records, 935 equipment family cards, 106 active M classes plus six retained X classes, 46 P-class routes, 263 ordered steps and 76 academic references. The latest facility-derived routes are capability plans, not checked experimental recipes. Older dated review counts below describe their respective review snapshots.

The [functional process review](docs/process-class-refinement-2026-10-17.md) replaces the rinse-fixture role with M85, distinguishes wet/deposition branches and casting fixtures, and retains pumps, mixers and ovens for their separate functions. Solvent lift-off is restricted to documented solvent-processing stations.

Research equipment metadata and a reproducible machine-list comparison tool.

The [ontology validation guide](docs/ontology-validation.md) describes independent unit and schema checks, graph constraints, process dependency validation and reviewed model-name similarities. Download the [Turtle knowledge graph](catalog/ontology/ontology.ttl), [JSON-LD](catalog/ontology/ontology.jsonld) or [snapshot audit](catalog/ontology/audit.json), also available in the app's **Evidence & sources** tab.

The [operating conditions and evidence guide](docs/process-conditions-and-evidence.md) documents 289 structured source conditions, stable output evidence IDs and 32 reported property measurements. Two reviewed fixed-case P20 properties can appear as explicitly unvalidated literature analogues when the selected formulation and settings match. Experimental validation remains future roadmap functionality.

## Equipment database

The [CSV catalog](catalog/equipment.csv) contains **590 research examples across 59 source M categories**, plus 42 supplemental records covering the requested equipment. There are 86 active M categories: the 59 source classes, M62 robotics, seven literature-derived classes for titration/dosing, swaging, induction heating, dialysis, three-roll milling, electron-beam evaporation and spark-plasma sintering, plus M70 programmable thermocyclers, eleven process-gap classes M71–M81, and seven implemented planning classes M82–M88. All 44 requested occurrences are retained, including the repeated AM400 entry. See the [bolded requested-equipment view](docs/requested-equipment.md), [database guide](catalog/README.md), and [evidence coverage](catalog/coverage.json).

The catalog preserves the supplied PDF's M identifiers, nine source material families plus N10 Nanocomposites, eleven additional source process routes and 109 ordered conceptual steps. Two curated wet/dry etching capabilities and 28 literature-derived manufacturing routes supplement those source routes. M52 and M55 were intentionally absent from that source. New examples include explicit research candidates; the ten-example target does not imply ten verified manuals per family. Model evidence, manual scope, source-reported links and unresolved gaps remain separate fields. MSRP fields await dated price evidence.

Validate CSV edits and regenerate the readable view with `python catalog_tools.py`.

The app presents 925 instrument/category records as **769 family cards** (including 34 literature-reported additions, 96 manufacturer-documented market alternatives and 93 process-gap alternatives), with selectable sub-model chips. The [market breadth review](catalog/market_expansion_2026-10-16.json) adds models across the 68 M classes active at that review and records every source, scope and unresolved item. The [process-slot completion review](catalog/process_slot_completion_2026-10-16.json) adds eleven more classes. Photo links cover 488 records; 143 records have public manufacturer prices, and one of those explicitly identifies MSRP in JPY. Pack, component, base-hardware, list and starting prices remain separate from full-system MSRP. New market models have identity-only lifecycle entries, with no newest-generation claim.

The [M82–M88 implementation](docs/m82-m88-implementation-2026-10-17.md) adds 67 models/variants with 67 sourced photos and 58 published prices, plus 12 researched manufacturer green stars. Nine configurations remain quote-only. Operation-specific subtypes and optional/manual branches distinguish market candidates from article-reported apparatus.

The [family membership CSV](catalog/product_families.csv) records 29 additional curated families and repairs repeated chips for eight models listed in two categories. Each sub-model retains its own documents, photo, price, model status and inventory associations. A category-context selector preserves distinct materials/processes and evidence for the same model listed in multiple categories. The [dated grouping report](catalog/product_family_review_2026-10-15.json) records the 576-to-535 card consolidation; no instrument records were deleted.

The latest [manufacturer link review](catalog/deep_link_review_2026-10-14.csv) updated 60 instruments across 27 categories, adding 44 product-page links, 47 specification links, 18 brochure links and 19 configuration-scoped published prices. See the [review audit](catalog/deep_link_review_2026-10-14.json) for source limitations and before/after evidence.

The [academic reference database](docs/academic-references.md) contains 53 reference records representing 52 distinct studies/articles: the 17 supplied papers, 35 cited reference/version records (including one discovery-bridge review), and one article credited for a reference micrograph, with publication metadata, stable IDs, source-file checksums and scoped literature relationships. Browse them in the app's **Academic references** tab, oldest to newest, or use the [BibTeX](catalog/bibliography.bib), [RIS](catalog/bibliography.ris) and [CSL JSON](catalog/bibliography.csl.json) exports. The original article PDFs remain local. Background reading is distinguished from checked support for a specific claim. The [2026-10-16 citation review](docs/citation-sweep-2026-10-16.md) adds 12 apparatus records, enriches two existing models, and introduces nine process routes with scoped methods evidence. The [breadth expansion](docs/citation-breadth-2026-10-16.md) adds fourteen more studies, twelve manufacturing routes, fourteen apparatus profiles and seventy scoped claims. Its [50-record review ledger](catalog/citation_review_2026-10-16-breadth.csv) distinguishes checked methods from deferred, unresolved and excluded sources; the bibliographies are not yet exhaustively reviewed. The [all-years cited-reference expansion](docs/citation-all-years-2026-10-16.md) uses only 2025–2026 original parents with no cutoff on cited-paper years, adding eight apparatus profiles and seven processes from nine 2017–2023 primary studies. Its [630-entry citation inventory](catalog/cited_reference_inventory_2026-10-16.csv) separates pending citations from title screens and full-text methods checks.

Proposed category relationships are recorded in the numbered [equipment ontology recommendations](docs/recommendations.md). Approved X-to-M moves are documented in the [category merge guide](docs/category-merges.md); legacy X identifiers remain searchable.

The app’s **Processes** tab builds saved equipment workflows from the sequenced process routes. The library shows only classes used by the current process steps, narrowing further when a slot is selected. Drag exact instrument models into class-filtered slots, add or reorder steps, retain per-instance configuration / operation / signal / I/O data, and tally equipment prices from $0. Workflow IDs, ontology references, price snapshots, revision history and JSON export preserve the plan for future integrations. See [Process equipment plans](webapp/docs/process-workflows.md). Saved user workflows stay in the private app database. Every process starts with an empty **Input materials** node before step 1. Choose process-relevant materials and planning amounts from dropdowns, with attributed photos where available. The clickable final output opens a material-specific card showing inputs, selected machines, prerequisites and source composition evidence. Four checked article compositions retain reference IDs. Other outputs are explicitly planning targets, without predicted conversion or yield. Material IDs and input/output targets persist in saved revisions and JSON exports. Quantity edits stay synchronized across repeated uses of the same physical equipment; per-step configurations remain independent. The save control explicitly displays unsaved, saving and saved-revision states.

## Machine-list comparison

Compare columns A and B of an Excel workbook or the first two columns of a CSV file. Produce a shared-machine list, unmatched lists, and a complete JSON audit trail with original values and spreadsheet row numbers.

## Quick start

Python 3.11 or later is required. Run these commands from the repository folder:

```sh
python -m venv .venv
# Windows PowerShell:
.venv\Scripts\Activate.ps1
# macOS/Linux: source .venv/bin/activate
python -m pip install -r requirements-dev.txt
python equipment_compare.py data/examples/equipment_lists.csv --header --output reports/example
python -m pytest -q
```

For your original workbook, place it in `data/private/` and run:

```sh
python equipment_compare.py "data/private/equipment comparison.xlsx" --sheet Sheet1 --output reports/local
```

The original workbook has **no header row**. Do not use `--header` for it. The first sheet is selected by default. `--sheet` selects a named Excel sheet. Columns beyond A:B are ignored. Blank cells and whitespace-only cells are skipped independently, including uneven list lengths. Numeric cells are converted to text; formatted leading zeros are not recovered, so store machine identifiers as text. Formula and Excel error cells in A:B are rejected; replace them with confirmed values first.

## Matching rules

Matching uses Unicode NFKC normalization, collapsed whitespace (including line breaks), and case-insensitive comparison. It preserves punctuation, model numbers, and word order. Duplicate names form one comparison group; every occurrence retains its original value and row number. Matching is by machine name, not a claim that two entries refer to the same physical asset.

Different spellings, abbreviations, generic equipment categories, and different model variants are not automatically equated. Review unmatched lists for potential semantic matches. No fuzzy score is presented as a confirmed match.

## Reports

Each run writes five files into the chosen output folder, replacing previous files with those names:

| File | Contents |
| --- | --- |
| matches.csv | One row per normalized name shared by both lists |
| only_a.csv | Names found only in column A |
| only_b.csv | Names found only in column B |
| comparison.json | All groups, original values, row references and run metadata |
| summary.md | Counts and input checksum |

CSV names and occurrence arrays are JSON-encoded inside CSV cells to retain embedded line breaks and protect formula-like prefixes. For programmatic use, read `comparison.json`; it contains unmodified original names. Counts labeled `rows` count nonblank occurrences; other machine counts count unique normalized names. Duplicate counts count groups with multiple occurrences, not extra rows.

Reports contain the source file's SHA-256, selected sheet, header setting, algorithm version and matching policy. Ordering and JSON formatting are stable, with no timestamps or absolute paths. Identical input bytes and options using the pinned dependencies produce identical report bytes. Renaming the source changes the recorded source name. Original Excel bytes are retained locally; resaving an Excel workbook can change its checksum without changing visible data.

The checked-in `reports/example/` can be regenerated with the quick-start command. Tests verify its contents against a fresh run. Local reports based on the uploaded workbook are in `reports/local/` and are excluded from Git.

## Research use

This public repository contains the comparison method, tests, templates and synthetic examples. Source equipment inventories and reports derived from them are not distributed here. A repository has one visibility setting; selective sharing is achieved by keeping restricted data outside its tracked files.

For a reproducible study, record the input checksum, script version or Git commit, Python/dependency versions, sheet and header setting. Preserve the original input separately. The example reports demonstrate reproducibility; they are synthetic and are not research findings. This tool compares names, not equipment capability or asset identity.

Contributions that improve matching should include a synthetic test case and explain how the change affects false matches. Do not submit restricted inventories in issues or pull requests.

## Project layout

```text
equipment_compare.py        Command-line script and comparison functions
requirements.txt            Pinned runtime dependencies
requirements-dev.txt        Test dependencies
templates/equipment_lists.csv   Blank two-column template (has headers)
data/examples/              Synthetic, publishable example input
data/private/               Local original inputs (ignored by Git)
reports/example/            Reproducible synthetic example reports
reports/local/              Local actual-data reports (ignored by Git)
tests/                      Matching, XLSX input and reproducibility tests
.github/workflows/tests.yml Automated tests on Python 3.11–3.13
```

Copy the blank CSV template and populate its two columns, or create an Excel workbook with machine names in A and B. Use `--header` for the supplied CSV template. Keep originals unchanged and use a separate report directory for each comparison you want to retain.

## Development

Install `requirements-dev.txt`, run `python -m pytest -q`, and regenerate example reports after intentional algorithm changes. Increment `VERSION` when changing matching or report semantics. Tests cover case and Unicode handling, model distinctions, duplicates, blanks, numeric values, first-row inclusion, sheet selection, formula rejection, empty inputs and byte-for-byte report reproducibility.

## Data handling

The original workbook and its detailed reports stay local by default. Only synthetic examples are included in Git. Before deliberately adding private inputs or reports, review their content and repository access. Code and synthetic examples are available under the MIT License. This license does not grant rights to any separately supplied equipment inventory.


## Nanomaterial Equipment Ontology app

The searchable and editable app source is in [webapp/](webapp/README.md). It presents equipment-family cards, model/capacity variant tabs, manual evidence, MSRP provenance fields, material/process filters, and CSV export. The header carries the supplied ICoN-PCL logo and official Drexel University and Purdue University marks. User-designated equipment is bold and marked with Purdue P. Box headings open instrument details. A green star identifies a verified manufacturer or explicitly named vendor, supported by independent research-use evidence or project-owner confirmation. Vendor stars do not establish an underlying OEM; defunct companies carry a separate status notice. Display names keep BUCHI Labortechnik distinct from Büchi AG (buchiglasuster). The complete audit, status sources and verification basis are in `catalog/manufacturers.csv`.

[Open the private app](https://icon-pcl-equipment-metadata.loyal-trout-0175.chatgpt.site). Signed-in edits are account-specific and persistent; export CSV to review changes for Git. The public seed database remains in `catalog/`. Exact MSRP stays separate from asterisked formula estimates: closest documented older-model benchmark × 1.20, otherwise 1.20 × category minimum through 0.80 × category maximum. The [pricing policy](docs/msrp-policy.md) records benchmark qualifications, currencies and unavailable ranges. Manufacturer photos are included where available, with scope and source links. Equipment type headings are prominent, and cards link directly to documentation.

After updating canonical CSV files, run `python catalog_tools.py` then `python scripts/build_app_data.py` and rebuild the app. University and ICoN-PCL logos are excluded from the MIT license.


CSV updates are available through **Admin CSV updates**. Download the template or current data, upload changes, preview and apply them to the shared catalog. Everyone signed in is an admin for now. See [CSV update guide](docs/csv-updates.md).

The Admin CSV screen is the second tab. Administrators can manually add shared machine profiles below the directory filters using the same ingestion pipeline. Filters support multiple choices, Shift-range selection, contextual counts, and bold labels when choices have matches.

## Private installed-equipment inventory

The app supports inventory entries linked to model records, with instrument IDs, serial/other IDs, purchase/build status and quantities. Multiple units share a model card rather than becoming product variants. Actual Purdue unit identifiers are retained only in the private deployment and local inventory export; the public app seed is empty. See `templates/purdue_inventory_template.csv` for the separate inventory schema. This snapshot format is distinct from the model-update CSV importer.

The [process workbench update](docs/process-workbench-2026-10-16.md) shows separate category cubes for AND/OR/optional requirements, a searchable full equipment browser, reusable physical units and a plan-completion animation with conceptual output. Three manufacturer-documented Opentrons profiles and the explicitly labeled P43 control-interface example are included. Every machine has a **Position List** roadmap template; a GEN2 draft demonstrates `poly-fibers/v2` with `poly-evidence/v1` evidence and per-position export.

## Public-site preparation

See [the sourced research-information draft](docs/public-research-information-draft.md) and [the custom-domain launch guide](docs/public-domain-launch.md). Shared catalog administration and private installed-equipment inventory now require a password-unlocked administrator session in addition to sign-in. Public catalog browsing and personal account plans remain separate. Runtime secrets and the private inventory are excluded from this repository.

The finished-output card now provides independent POSITION, FIBER and DIRECTION selections for each assigned instrument occurrence, with [spreadsheet imports and evidence-linked declared effects](docs/instrument-position-upload.md). [USD pricing](docs/usd-pricing.md) uses the committed dated ECB reference snapshot and preserves original price evidence. The reproducible normalized report is `catalog/equipment_prices_usd.csv`.

## Components and MIT.nano review

[Component formulations and cumulative process pricing](docs/COMPONENTS_AND_PRICING.md) describes the 41 sourced examples, 42 dated pack quotes, CSV formats, reproducible totals and explicit gaps. [MIT.nano review](docs/MIT_NANO_REVIEW.md) records 28 model additions and 34 additional instrument photos relevant to existing P-class production or characterization tasks.

See the [M89–M99 expansion review](docs/mit-class-expansion.md) for the latest MIT.nano-inspired classes, process links, model/price provenance and scope limits.

The [2026 purchase-price review](docs/PRICE_RESEARCH_2026.md) adds 59 instrument prices and 42 distinct component/material pack quotes. Four explicitly dated 2026 distributor pricebooks are documented separately from current website observations and manufacturer MSRP. Reproducible coverage CSVs identify remaining price gaps; supplier references do not silently establish formulation compatibility.

Material pack prices include expandable P-category/method links and process filtering. See [input quantities and material pricing](docs/output-quantities-and-material-prices.md) for the 2026-10-18 supplier quote expansion and compatibility scope.

The [Evidence register](docs/evidence-register.md) provides readable source claims and related records, with CSV/JSON companions. [Evidence-system documentation](docs/evidence-system.md) explains the app’s immutable saved action, sequence and workflow-combination evidence IDs, reproduction packages and private/public storage boundaries.
