# Equipment database

`equipment.csv` is the editable equipment catalog. It contains ten **research examples** for each of the 59 active M categories plus a separate requested-equipment supplement. Ten examples does not mean ten independently verified manuals or ten interchangeable complete machines. Each record carries its model and manual evidence status.

## Files

| File | Meaning |
| --- | --- |
| equipment.csv | Main catalog: product families, variants, manuals, pricing fields and material/process relationships |
| categories.csv | Authoritative M definitions and source-PDF page/checksum |
| requested_equipment.csv | All 44 requested occurrences, mapped to 43 highlighted equipment records |
| source_models.csv | All 64 model/manual records retained by the source PDF, with their original provenance |
| routes.csv | Nine material-family routes and eleven additional manufacturing-process routes |
| route_steps.csv | All 109 ordered conceptual steps, preserving alternatives and concurrent equipment |
| coverage.json | Generated counts, including unresolved documentation and model evidence |

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
