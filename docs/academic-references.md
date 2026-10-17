# Academic reference database

The first import contains **17 distinct academic papers from 18 local PDF copies** supplied in the project folder. It includes journal articles, a conference paper and a clearly labeled arXiv preprint. Instruction manuals, the equipment guide, analytics guides, spreadsheets, meeting notes, project drafts, and poster/talk abstracts are outside this import. The later [2026-10-16 citation review](citation-sweep-2026-10-16.md) follows manufacturing-related references from the ten 2024-2026 papers. After the [breadth expansion](citation-breadth-2026-10-16.md), the library contained 42 reference records representing 41 studies. The [all-years cited-reference expansion](citation-all-years-2026-10-16.md) brings the current library to 52 records representing 51 distinct articles/studies, including a discovery-bridge review. It starts only from 2025–2026 folder papers and imposes no year cutoff on cited works. The [630-entry citation inventory](../catalog/cited_reference_inventory_2026-10-16.csv) records pending work separately from title screening and methods checks. The first citation pass adds eleven version records for ten studies; the breadth pass adds fourteen studies. A published/preprint pair is retained explicitly. Cited articles are imported after methods review, not automatically.

The default display and bibliography export order is **publication year, oldest to newest**, followed by available publication date and author/title ties. Undated records come last in either sort direction. IDs remain stable when sorting changes. Citation managers should apply the destination journal's required reference style when preparing a manuscript; the library's chronological display does not prescribe manuscript reference order.

## Tables and exports

| File | Purpose |
| --- | --- |
| [references.csv](../catalog/references.csv) | One record per academic work: structured authors, publication details, DOI, publication type, metadata source, review status, topics and caveats |
| [reference_affiliations.csv](../catalog/reference_affiliations.csv) | Publication-specific author institutions, indexed to author order, with source, locator, date and an explicit not-stated status |
| [reference_affiliation_review_2026-10-16.json](../catalog/reference_affiliation_review_2026-10-16.json) | Coverage and source audit for all 402 author entries in the 52 reference records |
| [reference_files.csv](../catalog/reference_files.csv) | Local article basenames, SHA-256 checksums, PDF page counts and copy/version labels; several copies can refer to one work |
| [reference_links.csv](../catalog/reference_links.csv) | A paper's relationship to a project, equipment category, route/material family or instrument, with a claim, PDF page/section locator and explicit scope |
| [reference_import_2026-10-15.json](../catalog/reference_import_2026-10-15.json) | Import boundary, metadata-check sources, exclusions and limitations |
| [reference_coverage.json](../catalog/reference_coverage.json) | Reproducible counts of papers, files, duplicate copies and evidence relationships |
| [bibliography.bib](../catalog/bibliography.bib) | BibTeX bibliography, including all authors |
| [bibliography.ris](../catalog/bibliography.ris) | RIS bibliography for reference managers |
| [bibliography.csl.json](../catalog/bibliography.csl.json) | CSL JSON bibliography with structured authors and publication dates |

The [breadth review ledger](../catalog/citation_review_2026-10-16-breadth.csv) records 50 candidate decisions with actual review depth, including unresolved identities, access gaps and an integrity hold. This is targeted screening, not a completed audit of every bibliography.

PDF binaries, extracted full text, abstracts, author contact details and absolute local file paths are not distributed. The file table identifies copies without making a local disk path into a public download link. These tables contain bibliographic metadata, not a license to redistribute the articles.

## Evidence and version rules

- A **background** link records relevance or context. It does not assert that the original catalog was derived from that paper, nor that its methods are implemented in the app. The first import has no checked, exact-model equipment claim links. The two citation passes add 103 scoped claims across equipment, categories and processes.
- A **supports_claim** link requires `review_status=claim_checked`, a specific claim, locator and scope. Review the actual passage before asserting support. A manufacturer mention is insufficient to establish an instrument's material/process capability. `full_text_and_registry_checked` identifies online full-text review without falsely implying a local PDF. Exact hardware from a preprint supplement stays linked to that version, even when the main article has a later published counterpart.
- Instrument links apply to their exact equipment ID. Checked category claims appear in a separate equipment-category evidence section, never as inherited instrument validation. Background category/material/process links remain contextual reading. Project-wide references are browsed in the library rather than attached to every instrument.
- Local PDF locators use PDF page positions (starting at 1), not necessarily printed journal page numbers. Section names make the passage easier to find.
- Publication years come from the paper and corroborating registry metadata, not filenames. The two byte-identical ontology PDFs represent one 2024 article; a filename says 2026. The nanocomposite review is a 2024 article although its filename says 2025.
- `Magnetization2.pdf` is a prepublication manuscript. Its citation identifies the title/author-matched 2024 journal counterpart, and its file/claim records preserve that manuscript scope. The versions have not been exhaustively compared.
- ZipTok3D remains labeled a preprint. A DOI, registry match, published journal article, or metadata check is not itself independent verification of peer review.
- One LIS article has metadata checked against the supplied PDF but an unresolved Crossref lookup (404 at review). Its DOI is recorded as printed; registration/resolution has not been verified.

## Add or amend citations

Use the complete-column CSV templates under [templates](../templates): `references_template.csv`, `reference_links_template.csv`, and `reference_files_template.csv`. Each input row is a full replacement for its existing ID; omitted IDs remain intact. These inputs update the academic database only and are separate from the equipment-profile CSV importer.

1. Give each work a stable `reference_id`. The first import uses `REF-` plus the first 12 uppercase hex characters of SHA-256 of the normalized DOI. New IDs may also be stable curator-assigned strings containing letters, numbers, underscores or hyphens. Never renumber IDs when sorting.
2. Store `authors_json` as a JSON list, for example `[{"family":"Example","given":"A."}]`. Keep author order. Optional `suffix` preserves names such as Jr.; use `literal` for a group author. A CSV-aware editor handles the embedded quotation marks.
3. Choose `journal_article`, `conference_paper` or `preprint`. Use `needs_review` for unresolved metadata. Record the publication year/date separately from `checked_date`. Unknown years can be empty. Do not invent authors, issue numbers, dates or DOI values to complete a record.
4. Add local copy information to the file table when available. Use basenames only, not absolute paths. Deduplicate works by normalized DOI while retaining the copy rows.
5. Add links only for a reviewed relationship. Valid target types are `project` (`ICoN-PCL`), `equipment` (exact equipment ID), `category` (current category ID), and `route` (current N/P route ID).

Preview an update without changing the database:

```sh
python reference_tools.py update --references new_references.csv --reference-links new_links.csv --reference-files new_files.csv
```

Omit an input option when that table has no changes. After reviewing the preview, apply it and regenerate the exports and app seed:

```sh
python reference_tools.py update --references new_references.csv --reference-links new_links.csv --reference-files new_files.csv --apply
python reference_tools.py check
python scripts/build_app_data.py
python -m pytest -q
```

Validation rejects duplicate identifiers/DOIs, missing reference or catalog targets, malformed provenance, unsafe URLs and incomplete claim support. All proposed tables are checked before CSVs are written. Generation and export run offline; they never fetch or silently revise publication metadata. Review the diff and commit the CSVs, exports and generated app seed together. Publishing follows the app's normal deployment workflow; editing these files does not automatically deploy a site.

For a portable SQLite copy with the same four tables and foreign keys:

```sh
python reference_tools.py build --sqlite academic-references.sqlite
```

The app's **Academic references** tab searches titles, authors, affiliated institutions, DOI, years, topics and source filenames. It shows metadata caveats and file provenance and exports the complete library as BibTeX, RIS, CSL JSON or CSV. Instrument cards show a separate academic-reference section, explicitly separating contextual reading from checked model claims. Reference maintenance currently uses the validated CSV workflow in Git.


## Author institutions

The Academic references tab lists each author with the institution(s) reported for that publication. The first three authors are visible initially; expand **All authors & affiliations** for the remaining authors. Multiple affiliations are preserved and each has a source link with a source locator. Search includes institution names. **Author affiliations CSV** exports this table independently, preserving standard citation/BibTeX/RIS/CSL author formatting.

The 2026-10-16 review covers all **402 author entries** (publication-specific occurrences, not unique people). It records institutions for **401** and an explicit **not_stated** status for one: the Rumble 2019 article lists John Broome with Ottawa, Canada, but no institution. No current employer or university has been inferred. The Lampe 2022 preprint's Nano-Institute Munich group description is preserved as printed rather than assigning an unprinted university name. Present-address notes are excluded from parsed article front matter.

Maintain [reference_affiliations_template.csv](../templates/reference_affiliations_template.csv) with one row per author/institution. `author_index` is zero-based and must match the exact `author_name` derived from that reference's `authors_json`; changing author order requires reviewing the affiliation rows. Use `affiliation_status=reported` with a named institution, or `not_stated` with an empty institution only when the cited article explicitly provides no institutional name. An author with no reviewed row is displayed as **Affiliation not yet verified**. Never fill gaps from another paper or a current author profile. `source_kind`, `source_url`, `source_locator` and `checked_date` are required. Source kinds distinguish article full text, publisher pages, publisher deposits in Crossref, Europe PMC article metadata, and reviewed supplied article copies. Source-reported affiliations are bibliographic metadata, not independently verified author biographies.

Preview or apply updates with the existing importer:

```sh
python reference_tools.py update --reference-affiliations updated_affiliations.csv
python reference_tools.py update --reference-affiliations updated_affiliations.csv --apply
python reference_tools.py build
```

Validation rejects missing references, out-of-range author indices, mismatched author names, duplicate author/institution rows, unsafe source links, contact details in institution fields and inconsistent reported/not-stated statuses. Affiliation tables and generated seeds are committed together; runtime access and private Purdue serial numbers are unchanged.
