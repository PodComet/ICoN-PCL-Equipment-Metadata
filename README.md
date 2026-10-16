# ICoN-PCL Equipment Metadata

Research equipment metadata and a reproducible machine-list comparison tool.

## Equipment database

The [CSV catalog](catalog/equipment.csv) contains **590 research examples across 59 source M categories**, plus 42 supplemental records covering the requested equipment. There are 68 active M categories: the 59 source classes, M62 robotics, seven literature-derived classes for titration/dosing, swaging, induction heating, dialysis, three-roll milling, electron-beam evaporation and spark-plasma sintering, plus M70 programmable thermocyclers. All 44 requested occurrences are retained, including the repeated AM400 entry. See the [bolded requested-equipment view](docs/requested-equipment.md), [database guide](catalog/README.md), and [evidence coverage](catalog/coverage.json).

The catalog preserves the supplied PDF's M identifiers, nine source material families plus N10 Nanocomposites, eleven additional source process routes and 109 ordered conceptual steps. Two curated wet/dry etching capabilities and 28 literature-derived manufacturing routes supplement those source routes. M52 and M55 were intentionally absent from that source. New examples include explicit research candidates; the ten-example target does not imply ten verified manuals per family. Model evidence, manual scope, source-reported links and unresolved gaps remain separate fields. MSRP fields await dated price evidence.

Validate CSV edits and regenerate the readable view with `python catalog_tools.py`.

The app presents 669 instrument/category records as **571 family cards** (including 34 literature-reported additions), with selectable sub-model chips. The [family membership CSV](catalog/product_families.csv) records 29 additional curated families and repairs repeated chips for eight models listed in two categories. Each sub-model retains its own documents, photo, price, model status and inventory associations. A category-context selector preserves distinct materials/processes and evidence for the same model listed in multiple categories. The [dated grouping report](catalog/product_family_review_2026-10-15.json) records the 576-to-535 card consolidation; no instrument records were deleted.

The latest [manufacturer link review](catalog/deep_link_review_2026-10-14.csv) updated 60 instruments across 27 categories, adding 44 product-page links, 47 specification links, 18 brochure links and 19 configuration-scoped published prices. See the [review audit](catalog/deep_link_review_2026-10-14.json) for source limitations and before/after evidence.

The [academic reference database](docs/academic-references.md) contains 52 reference records representing 51 distinct studies/articles: the 17 supplied papers plus 35 cited reference/version records, including one discovery-bridge review, with publication metadata, stable IDs, source-file checksums and scoped literature relationships. Browse them in the app's **Academic references** tab, oldest to newest, or use the [BibTeX](catalog/bibliography.bib), [RIS](catalog/bibliography.ris) and [CSL JSON](catalog/bibliography.csl.json) exports. The original article PDFs remain local. Background reading is distinguished from checked support for a specific claim. The [2026-10-16 citation review](docs/citation-sweep-2026-10-16.md) adds 12 apparatus records, enriches two existing models, and introduces nine process routes with scoped methods evidence. The [breadth expansion](docs/citation-breadth-2026-10-16.md) adds fourteen more studies, twelve manufacturing routes, fourteen apparatus profiles and seventy scoped claims. Its [50-record review ledger](catalog/citation_review_2026-10-16-breadth.csv) distinguishes checked methods from deferred, unresolved and excluded sources; the bibliographies are not yet exhaustively reviewed. The [all-years cited-reference expansion](docs/citation-all-years-2026-10-16.md) uses only 2025–2026 original parents with no cutoff on cited-paper years, adding eight apparatus profiles and seven processes from nine 2017–2023 primary studies. Its [630-entry citation inventory](catalog/cited_reference_inventory_2026-10-16.csv) separates pending citations from title screens and full-text methods checks.

Proposed category relationships are recorded in the numbered [equipment ontology recommendations](docs/recommendations.md). Approved X-to-M moves are documented in the [category merge guide](docs/category-merges.md); legacy X identifiers remain searchable.

The app’s **Processes** tab builds saved equipment workflows from the sequenced process routes. The library shows only classes used by the current process steps, narrowing further when a slot is selected. Drag exact instrument models into class-filtered slots, add or reorder steps, retain per-instance configuration / operation / signal / I/O data, and tally equipment prices from $0. Workflow IDs, ontology references, price snapshots, revision history and JSON export preserve the plan for future integrations. See [Process equipment plans](webapp/docs/process-workflows.md). Saved user workflows stay in the private app database.

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

[Open the private app](https://icon-pcl-equipment-metadata.loyal-trout-0175.chatgpt.site). Signed-in edits are account-specific and persistent; export CSV to review changes for Git. The public seed database remains in `catalog/`. Exact MSRP stays separate from asterisked class-equivalent planning ranges, with dated references, confidence and assumptions. Manufacturer photos are included where available, with scope and source links. Equipment type headings are prominent, and cards link directly to documentation.

After updating canonical CSV files, run `python catalog_tools.py` then `python scripts/build_app_data.py` and rebuild the app. University and ICoN-PCL logos are excluded from the MIT license.


CSV updates are available through **Admin CSV updates**. Download the template or current data, upload changes, preview and apply them to the shared catalog. Everyone signed in is an admin for now. See [CSV update guide](docs/csv-updates.md).

The Admin CSV screen is the second tab. Administrators can manually add shared machine profiles below the directory filters using the same ingestion pipeline. Filters support multiple choices, Shift-range selection, contextual counts, and bold labels when choices have matches.

## Private installed-equipment inventory

The app supports inventory entries linked to model records, with instrument IDs, serial/other IDs, purchase/build status and quantities. Multiple units share a model card rather than becoming product variants. Actual Purdue unit identifiers are retained only in the private deployment and local inventory export; the public app seed is empty. See `templates/purdue_inventory_template.csv` for the separate inventory schema. This snapshot format is distinct from the model-update CSV importer.

The [process workbench update](docs/process-workbench-2026-10-16.md) shows separate category cubes for AND/OR/optional requirements, a searchable full equipment browser, reusable physical units and a plan-completion animation with conceptual output. Three manufacturer-documented Opentrons profiles and the explicitly labeled P43 control-interface example are included. Every machine has a **Position List** roadmap template; a GEN2 draft demonstrates `poly-fibers/v2` with `poly-evidence/v1` evidence and per-position export.
