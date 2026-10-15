# Equipment database

`equipment.csv` is the editable equipment catalog. It contains ten **research examples** for each of the 59 source M categories plus a separate requested-equipment supplement. M62 Robotic handling and automation systems is a project extension containing 13 of those requested profiles; the catalog now has 60 active M categories. Ten examples does not mean ten independently verified manuals or ten interchangeable complete machines. Each record carries its model and manual evidence status.

## Files

| File | Meaning |
| --- | --- |
| equipment.csv | Main catalog: product families, variants, manuals, pricing fields and material/process relationships |
| categories.csv | Current M family labels, source/project origin, original source category names and source-PDF page/checksum |
| category_aliases.csv | Retired X identifiers and their canonical M destinations; X-FILTER has two destinations |
| requested_equipment.csv | All 44 requested occurrences, mapped to 44 highlighted equipment records after splitting the filtration-and-centrifuges requirement |
| source_models.csv | All 64 model/manual records retained by the source PDF, with their original provenance |
| routes.csv | Nine material-family routes, eleven source manufacturing-process routes and two curated wet/dry etching capabilities |
| route_steps.csv | All 109 ordered conceptual steps, preserving alternatives and concurrent equipment |
| coverage.json | Generated counts, including unresolved documentation and model evidence |
| deep_link_review_2026-10-14.csv | Sixty reviewed instruments: model-page, manual, specification, brochure and configuration-scoped price links |
| deep_link_review_2026-10-14.json | Review findings, before/after field groups, URL-check results and coverage changes |

Source: `Nanomaterial_Manufacturing_Equipment_Sequenced_Manuals.pdf`. File hashes and source pages identify the supplied document without publishing its binary or local paths. The PDF intentionally excludes M52 and M55; they have not been silently recreated or renumbered. Source-PDF assertions are distinguished from independent checking. Source model records remain an archival provenance layer even where later research identifies a scope caveat.

## Editing conventions

- Keep `equipment_id` stable. Use `product_family_id` to group real product variants; volume differences belong in `capacity_ml` and `variant_label`.
- `catalog_scope=core_example` identifies the ten-example sets. Supplemental generic requirements, robots, upgrades and custom assemblies do not inflate those counts.
- `highlight_requested=true` identifies requested equipment. CSV has no font styling; the [readable view](../docs/requested-equipment.md) renders requested labels in bold.
- `purdue_list=true` and the Purdue P image mark the user's designated Purdue list. This designation is separate from independently verified ownership or access evidence. The official image is attributed in [asset credits](../assets/README.md).
- Separate model existence from manual applicability. A brochure can support `model_evidence_url` but is not an operator manual. `manual_lookup_url` is a discovery shortcut, never evidence of a manual.
- `manual_match_status=verified_operating_manual` means the linked manufacturer-authored operating document was checked for its stated model/family scope. Match actual firmware, generation and configuration before use. Conditional, component-only and source-reported links have different statuses.
- Unresolved candidate names, family-level descriptions and unverified configurations remain marked for review. This release does not label them verified models. Commercial model options are not evidence of Purdue ownership or access.
- Material/process links are curated planning associations inherited from the source routes or explicitly identified supplementary proposals. They do not establish a model's experimentally validated nanomaterial capability. Characterization and supporting utilities are distinct from synthesis.
- Pricing fields are intentionally empty unless supported by a dated source. Do not substitute retailer pricing, a starting price or an estimate for MSRP. Record amount, currency, source URL and date together. `not_researched` is not a claim that a price is unpublished.

After editing, run:

```sh
python catalog_tools.py
python -m pytest -q
```

The original XLSX and its matching reports remain excluded from Git. Manufacturer manuals remain external links; no third-party PDF manuals or images are redistributed here.

## Manufacturer link review, 2026-10-14

This pass updated 60 instruments across 27 categories, including ten Purdue-list profiles. Product-page coverage increased from 64 to 108 records, specification links from 36 to 83, brochure links from zero to 18, and published manufacturer prices from ten to 29. Checked operating-manual associations increased from 102 to 107. This is a focused pass, not a claim that every catalog record was reverified.

Prices record the selected SKU or configuration, currency, date and source. Sale and published shop prices remain separate from explicit MSRP and class estimates. Search-index prices can be stale: the live Sartorius article page was used where the two differed. The EUROSTAR 20 URL now presents a newer generation; its current price is not assigned to the unresolved source identifier. Digital Vortex-Genie 2 has a product-linked document whose extracted scope remains unresolved, so it does not receive a checked-manual badge.

Some manufacturer sites blocked automated requests with HTTP 403/465 while their model documents remained visible through official indexed sources. Those retrieval limits are recorded in the JSON audit; they are not reported as successful direct downloads. Obsolete PDF candidates returning 404/410 were replaced by official landing pages. Exact installed configurations, unspecified equipment and custom assemblies remain unresolved where evidence is missing.

The app carries the review's before/after groups in `webapp/app/data/research-updates.json`. Old saved snapshots receive an update only when their fields still match the prior defaults. Custom manual/price evidence groups and explicitly edited personal fields are preserved. Keep earlier review groups when adding later review migrations.


## Photos and class-equivalent estimates

`equipment.csv` includes optional `image_url`, `image_source_url`, `image_scope`, `technical_spec_url`, `product_page_url`, and `media_checked_date` fields. Photos remain manufacturer-hosted and can become unavailable; photo rights remain with their owners. Family photos explicitly identify their scope.

`category_price_estimates.csv` contains 66 broad new-equipment planning ranges. `equipment_price_overrides.csv` specializes accessories, upgrades, mobile bases, configured assemblies, and per-unit furnace quantities. `market_benchmarks.json` records the research anchors and distinguishes published selling prices from quote-only pages. No range is an exact model MSRP. Where no public price was found, ranges are low-confidence analyst judgments; specification sources establish class scope and do not substantiate numerical bounds. Exclusions are recorded in the basis.

`python scripts/build_app_data.py` joins these CSVs into the app seed. CSV export includes the joined estimate fields while preserving exact MSRP separately. An exact sourced MSRP entered in the app takes display priority over estimates.


## Manufacturer legitimacy checks

`manufacturers.csv` records every distinct manufacturer name, including legacy brands and unresolved labels. A green star requires a verified manufacturer/brand identity and official website, supported by independent documented research use or explicit project-owner confirmation (`verification_basis=user_confirmation`). The badge identifies that basis; owner confirmation does not create an independent research citation. FRITSCH was confirmed by the project owner on 2026-10-14. Evidence of use is not a quantified claim of market prevalence, current service support, installed-model suitability, or institutional ownership. Unverified names stay visible but unstarred; custom and unspecified equipment do not acquire a manufacturer badge.

The app reapplies this audit by manufacturer name when loading saved edits. Changing the manufacturer to an unknown name removes the verified status rather than inheriting another brand's star. Audit evidence is maintained in Git, separately from user-editable instrument metadata.
