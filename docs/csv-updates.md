# Updating equipment by CSV

Use `brochure_url` for a product brochure and `technical_spec_url` for a specification page or datasheet. When no checked operating manual is available, the app uses these as documentation links before falling back to a manufacturer product page. Source-reported manuals retain their review labels in details.

Published manufacturer prices are separate from exact MSRP. Use `manufacturer_price_value`, `manufacturer_price_currency`, `manufacturer_price_kind` (`list_price`, `sale_price`, `starting_price`, or `published_price`), `manufacturer_price_source_url`, `manufacturer_price_checked_date` (YYYY-MM-DD), and `manufacturer_price_scope` (model/configuration). An amount requires all evidence fields. Clearing the amount clears its associated metadata; new variants start with no inherited price. These prices appear alongside the planning estimate and never become MSRP automatically.

Use the app's **Admin CSV updates** tab. Everyone who can sign in is an admin for now. Updates affect the shared catalog. Your personal instrument edits remain separate.

1. Download **Current data for updates** to get stable equipment IDs, or start with the blank template in `templates/equipment_updates_template.csv`.
2. Edit in Excel or another CSV editor. Save as UTF-8 CSV. Keep the column names unchanged. You may omit optional columns and remove unchanged rows.
3. Upload, validate, and review each before/after difference. Fix errors in your file and upload it again.
4. Click **Apply shared changes**. A stale preview must be refreshed if another admin changes the catalog.

## Row operations

| operation | Required identifiers and values |
| --- | --- |
| `update` | Existing `equipment_id`; any fields to change. Category cannot be reassigned through this operation. |
| `add_equipment` | New unique `equipment_id`, known `category_id`, `manufacturer`, and `model_name`. Product family and variant label default to the model name. |
| `add_variant` | New unique `equipment_id`, existing `parent_equipment_id`, and `model_name`. Set a descriptive `variant_label`, such as `250 mL`. The family/category are inherited. |

Choose new IDs using letters, digits, periods, underscores and hyphens, such as `LAB-0001`. Parent IDs must already exist in the shared catalog before this import; add parents in a separate earlier import.

## Field rules

- Blank means leave unchanged. `[CLEAR]` removes a value; required identity fields cannot be cleared.
- Numbers are plain numbers: `250` for mL, `12500` for MSRP. Do not include currency symbols or thousands separators.
- Exact MSRP requires `msrp_value`, `msrp_currency` (for example `USD`), `price_source_url`, and `price_checked_date` (`YYYY-MM-DD`). Class estimates remain separate.
- `manual_url`, `product_page_url`, `technical_spec_url`, `image_url`, `image_source_url`, and `price_source_url` must use http or https.
- A new photo requires its source-page URL and a scope/caption in the same row. Identify exact-model versus family-example photos.
- Material/process IDs use semicolons, for example `N01;N02`. Download references in the admin screen. Related labels are rebuilt from IDs unless labels are explicitly provided.
- Quote values containing commas, quotes, or line breaks. Excel normally handles this automatically.
- New records start without Purdue-list/ownership markers or verified manual/model status. Unknown manufacturers receive no green star. Audit and verification fields are not importable.

A minimal update looks like:

```csv
operation,equipment_id,notes
update,M37-09,"Replace this with your reviewed note."
```

## Limits and saved data

Up to 1,000 CSV rows, 100 changed records, 3 MB per file, and a 1.5 MB combined before/after change payload. Large edits should be split into smaller files. Validation errors block the entire file. There is no deletion operation.

Import history records the file name, actor, revision, timestamp and before/after changes. **Export shared snapshot** downloads the current shared records for review or a Git update. Imports persist in the app database and do not automatically commit to GitHub. The ordinary directory export may include personal edits; the admin export uses shared data only.

## Manual entry

The equipment directory has an admin-only **Add machine profile** section below the filter menus. Enter an instrument or variant, select **Review profile**, then **Add to shared catalog**. This form produces the same row format and calls the same preview/apply endpoints as CSV. It uses the same revision checks, verification rules and import history.
