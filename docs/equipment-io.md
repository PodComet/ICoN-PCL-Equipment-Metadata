# Instrument input, output and measuring units

Every directory card has three compact boxes, with larger boxes beside the title
in the instrument popup. The selected sub-model supplies all three values:

| Box | EquipmentIO column | Data field |
| --- | --- | --- |
| Input | C | `inputs_and_states` |
| Output | D | `outputs_and_states` |
| Measuring units | E | `units_of_measure` |

Long values scroll within fixed-height boxes. The popup shows the source workbook,
worksheet, row and import date. Links from columns H and I open the workbook's
manual/document and specification/reference. Source qualification text is retained:
an automatic extraction, a family-level reference or an unresolved input state is
not upgraded to a verified model specification.

The card text omits `Source:` / `Sources:` citation footnotes to local PDFs, which
visitors cannot access. The underlying dataset retains those references. Reachable
web URLs, including public PDF URLs, remain clickable and open in a new tab or
window. The H/I document links behave the same way. Removing a source line does
not remove any subsequent equipment controls or qualification notes.

## Current import

The targeted 31 October correction for **KD Scientific Legato 210** (`M07-08`)
replaces Legato 200 infuse-only wording with the manufacturer's 210 infuse/withdraw
interface. Its source is row 543 of `EquipmentIO_legato210_updated_2026-10-31.xlsx`.
The 210P-only multi-program and analog-option features are excluded. Other models
are unchanged. The [correction record](../catalog/equipment_io_legato210_review_2026-10-31.json)
retains the source hashes, manual pages and before/after values.

The 30 October 2026 import uses `EquipmentIO_manuals2_updated_2026-10-30.xlsx`.
All 44 existing Purdue-marked catalog records matched. In total, 1,115 of the
1,125 catalog records match 1,107 spreadsheet rows. A model in multiple categories
gets the same spreadsheet values. The ten unmatched catalog records display an
explicit missing-exact-model message. The review JSON also lists three spreadsheet
rows whose names are not present as exact model identities in this catalog.

`catalog/equipment_io.csv` is the public text derivative. The workbook and source
manuals remain local. Inventory identifiers, credentials and saved user plans are
not imported into this dataset. Existing administration and inventory access rules
are unchanged.

## Refresh

From the repository root:

```sh
python scripts/import_equipment_io.py /path/to/EquipmentIO.xlsx --date YYYY-MM-DD
```

Review `catalog/equipment_io_import_review.json` before publishing. Importing does
not change catalog identities, category membership, prices, Purdue flags or
manual-verification status. Matching removes formatting punctuation and spaces,
ignores case and retains the `+` suffix that distinguishes models such as Ignite
and Ignite+. Ambiguous source names cause an error. It never uses spreadsheet row
positions, approximate matching or product-family membership to choose a model.

`python scripts/build_app_data.py` regenerates the app JSON from the canonical CSV.
The server joins it after shared and personal catalog overlays, checking equipment
ID, manufacturer and exact model identity. A renamed/copied model cannot inherit
another model's facts. Missing values remain missing.

The CSV retains a SHA-256 of the source workbook and exact row references for
reproducibility. It does not require the source workbook at runtime.
