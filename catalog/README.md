# Equipment database

`equipment.csv` is the editable equipment catalog. It contains ten **research examples** for each of the 59 source M categories plus a separate requested-equipment supplement. M62 Robotic handling and automation systems is a project extension containing 13 of those requested profiles; the catalog now has 64 active M categories, including literature-derived M63 titration/dosing, M64 swaging, M65 induction heating and M66 dialysis. These new classes contain source-reported starting examples; the ten-example target remains complete for the original 59 source classes. Ten examples does not mean ten independently verified manuals or ten interchangeable complete machines. Each record carries its model and manual evidence status.

## Files

| File | Meaning |
| --- | --- |
| equipment.csv | Main catalog: product families, variants, manuals, pricing fields and material/process relationships |
| product_families.csv | Curated family/chip membership overlay, exact member identities, previous defaults, grouping source/basis and date; applied by the app seed builder |
| product_family_review_2026-10-15.json | Review of 29 additional families and eight duplicate category profiles; 632 records retained in 535 cards |
| submodel_photo_review_2026-10-15.json | Image review across 47 toggleable families: 81 profile additions for 78 sub-models, scoped sources, image checks and unresolved gaps |
| categories.csv | Current M family labels, source/project origin, original source category names and source-PDF page/checksum |
| category_aliases.csv | Retired X identifiers and their canonical M destinations; X-FILTER has two destinations |
| requested_equipment.csv | All 44 requested occurrences, mapped to 44 highlighted equipment records after splitting the filtration-and-centrifuges requirement |
| source_models.csv | All 64 model/manual records retained by the source PDF, with their original provenance |
| routes.csv | Nine material-family routes, eleven source manufacturing-process routes and two curated wet/dry etching capabilities |
| route_steps.csv | All 109 ordered conceptual steps, preserving alternatives and concurrent equipment |
| coverage.json | Generated counts, including unresolved documentation and model evidence |
| deep_link_review_2026-10-14.csv | Sixty reviewed instruments: model-page, manual, specification, brochure and configuration-scoped price links |
| deep_link_review_2026-10-14.json | Review findings, before/after field groups, URL-check results and coverage changes |
| link_review_2026-10-15.json | Current US Mazak replacements, HTTP checks, and fields superseding historical link reviews |
| references.csv | Structured academic citations, ordered oldest to newest by publication year |
| reference_links.csv | Scoped background or checked-claim links from papers to the project or catalog entities |
| reference_files.csv | Local article basenames, file checksums, page counts and version/duplicate-copy provenance |
| bibliography.bib / bibliography.ris / bibliography.csl.json | Complete academic-library exports for citation managers |
| reference_coverage.json / reference_import_2026-10-15.json | Reference counts, import boundary, metadata-check sources and unresolved caveats |

Source: `Nanomaterial_Manufacturing_Equipment_Sequenced_Manuals.pdf`. File hashes and source pages identify the supplied document without publishing its binary or local paths. The PDF intentionally excludes M52 and M55; they have not been silently recreated or renumbered. Source-PDF assertions are distinguished from independent checking. Source model records remain an archival provenance layer even where later research identifies a scope caveat.

The [academic reference database](../docs/academic-references.md) separately indexes 17 supplied papers from 18 PDF copies. The first import contains background relationships rather than checked exact-model equipment claims. Academic citations do not retroactively establish the literature provenance or experimental validity of every existing material/process association. Manuals and manufacturer sources remain in their existing evidence fields outside this article-only bibliography.

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

## Retired Mazak links, 2026-10-15

Active Mazak references now use the current US site. The VC-500A/5X card links to the official [VC Series brochure request page](https://www.mazak.com/us-en/products/download-brochure/vc-series-brochure1/), and its model evidence links to an official US customer article that explicitly describes the base machine. The brochure uses a request form. An exact current public specification sheet or operator manual was not established, so the retired presentation PDF has been removed from the specification field. The AM HWD hybrid has not been substituted for the base machine. No price or photo is inferred.

`webapp/app/data/link-replacements.json` maps only reviewed retired URLs. The app applies those replacements after saved-record and research overlays, including class-reference lists, so an old saved link does not reappear. Other custom URLs, cleared fields, model identity and Purdue associations remain intact. Historical reports retain the URLs recorded on their original dates; `link_review_2026-10-15.json` records the later replacement evidence and superseding fields.


## Photos and class-equivalent estimates

`equipment.csv` includes optional `image_url`, `image_source_url`, `image_scope`, `technical_spec_url`, `product_page_url`, and `media_checked_date` fields. Photos remain manufacturer-hosted and can become unavailable; photo rights remain with their owners. Family photos explicitly identify their scope.

The [2026-10-15 photo review](photo_review_2026-10-15.json) adds 35 manufacturer-hosted photos, including the New Era NE-4000, bringing photo coverage to 87 of 632 records. Each selected image was decoded and checked for usable dimensions. Captions identify shared family images, example configurations and optional accessories. The report retains 21 deferred pages where access or exact-model matching remained unresolved. Saved profiles with unchanged empty photo fields receive the additions through the research updates; custom images and intentional clears remain protected.

The subsequent [Purdue photo and manufacturer sweep](purdue_photo_manufacturer_review_2026-10-15.json) reviews all 44 Purdue-designated profiles and adds six source-hosted images, bringing Purdue image coverage from 22 to 28 profiles (93 catalog-wide). Sources include manufacturer/vendor pages and institutional equipment pages. The FormAlloy L2 image is a Purdue facility sheet containing machine photos; the BaltiCold image explicitly shows related CSM108.2 rather than asserting an exact match to the requested CSM108.02. All 28 Purdue image URLs were retrieved and decoded during this review. Sixteen profiles remain without images, including unidentified/custom equipment and unresolved upgrade components. Manufacturer names are now established for 32 of 44 profiles; the remaining 12 have no maker/model identification in the supplied requirement. TRACER 2.0 is individually assigned to AgileX Robotics, with independent brand-level research-use evidence from the Mobile ALOHA paper (section 3, page 4). That paper uses an earlier Tracer generation, not a verified TRACER 2.0 configuration. Rethink Robotics remains defunct. No private inventory identifiers, installed specifications or prices are inferred from these images.

`category_price_estimates.csv` contains 66 broad new-equipment planning ranges. `equipment_price_overrides.csv` specializes accessories, upgrades, mobile bases, configured assemblies, and per-unit furnace quantities. `market_benchmarks.json` records the research anchors and distinguishes published selling prices from quote-only pages. No range is an exact model MSRP. Where no public price was found, ranges are low-confidence analyst judgments; specification sources establish class scope and do not substantiate numerical bounds. Exclusions are recorded in the basis.

`python scripts/build_app_data.py` joins these CSVs into the app seed. CSV export includes the joined estimate fields while preserving exact MSRP separately. An exact sourced MSRP entered in the app takes display priority over estimates.


## Manufacturer legitimacy checks

`manufacturers.csv` records every distinct manufacturer name, including legacy brands and unresolved labels. A green star requires a verified manufacturer/brand identity and official website, supported by independent documented research use or explicit project-owner confirmation (`verification_basis=user_confirmation`). The badge identifies that basis; owner confirmation does not create an independent research citation. FRITSCH was confirmed by the project owner on 2026-10-14. Evidence of use is not a quantified claim of market prevalence, current service support, installed-model suitability, or institutional ownership. Unverified names stay visible but unstarred; custom and unspecified equipment do not acquire a manufacturer badge.

The app reapplies this audit by manufacturer name when loading saved edits. Changing the manufacturer to an unknown name removes the verified status rather than inheriting another brand's star. Audit evidence is maintained in Git, separately from user-editable instrument metadata.

## Newer-model review, 2026-10-15

[`model_lifecycle.csv`](model_lifecycle.csv) stores model-specific lifecycle research. The full first-pass sweep screens all 632 records behind 576 product-family cards, including all 44 Purdue profiles: 24 have confirmed newer models/generations, 493 have no verified successor in the sources checked, ten have parallel alternatives without an established successor, and 105 remain unresolved. The twelve unspecified/custom requirements cannot be assigned a generation without a maker/model. An absent badge does not establish that an instrument is the latest model. Some discontinued products remain unresolved because a replacement mapping was not verified.

The [dated report](model_lifecycle_review_2026-10-15.json) retains scope, counts, source URLs, search queries and unresolved findings. After the initial 31-model review, 581 deduplicated official-domain searches screened the remaining 589 identifiable records. The [source retrieval ledger](model_lifecycle_source_checks_2026-10-15.csv) records 413 existing source URLs checked, including 356 HTTP-200 responses. An HTTP-200 response alone does not verify model currency. Some sites block direct retrieval while official indexed content remains accessible. This is a full screening pass, not exhaustive deep verification or certification that no further successors exist. Historical manufacturer listings and generic families remain bounded evidence.

The directory shows **Newer model available** only for `lifecycle_status=newer_model_confirmed` with `successor_relationship=direct_successor` or `newer_generation`. The instrument card links to `successor_product_url`, with `successor_scope`, `successor_evidence_url` and `successor_checked_date`. Some relationships lead to a newer family rather than one exact configuration; the card makes that scope explicit. The badge does not assert that the older instrument is discontinued, unsupported or interchangeable with the newer one.

Parallel capacities, co-listed alternatives, renaming and unresolved source identities receive no badge. Evidence is joined by `equipment_id` plus the exact catalog `model_name` and `manufacturer`. Renaming the model/maker or cloning a new variant removes the association; saved snapshots of the unchanged original receive the current review. `review_method`, `review_query`, `review_source_urls` and `review_source_match` distinguish an explicit manufacturer relationship from bounded search screening and unspecified requirements. Maintain this CSV in Git, run `python catalog_tools.py --check` and `python scripts/build_app_data.py`, then test and rebuild the app. Lifecycle verification is read-only in ordinary admin/model CSV updates; the full catalog snapshot export includes the joined lifecycle fields.

The [breadth citation review](../docs/citation-breadth-2026-10-16.md) adds fourteen studies, twelve processes and source-specific claims. N10 groups composites with nanoscale phases; it is not a universal manufacturing sequence. The [candidate review CSV](citation_review_2026-10-16-breadth.csv) retains source access, review depth and unresolved work.

JASCO was confirmed by the project owner on 2026-10-16. Prefer [jascoinc.com](https://jascoinc.com/) for its model content, photos and documents. The [JASCO source review](link_review_2026-10-16-jasco.json) supplies V-730 and historical FT/IR-4700 resources; brochures remain distinct from operator manuals, and the green star does not invent an academic-adoption claim.
