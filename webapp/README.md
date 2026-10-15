# Nanomaterial Equipment Ontology

Searchable research equipment catalog for ICoN-PCL, with Drexel University and Purdue University marks.

## Features

- 631 equipment records, grouped into product-family cards with variant tabs.
- Instrument cards with a photo appear before cards without photos, including after filtering. A newly opened card starts on a matching variant with a photo when available. Original ordering is retained within each group of cards, and variant-tab order is unchanged.
- Clickable equipment-type headings open the selected instrument detail card.
- Green stars identify independently supported or owner-confirmed manufacturers and named vendors. Vendor stars identify the supplier explicitly and do not establish an underlying OEM. Manufacturer display names preserve the distinction between BUCHI Labortechnik and Büchi AG (buchiglasuster). Defunct makers have a visible status notice and source. Search includes the display name and vendor name; the canonical manufacturer keys and equipment IDs remain stable.
- Search and filters for equipment family, materials, processes, manufacturer, manual evidence, and the user-designated Purdue list.
- Linked Purdue inventory records distinguish physical units from model variants. Instrument IDs and supplied serial/other IDs are searchable, appear in instrument details, and have a separate Admin CSV snapshot download.
- Prominent equipment-class headings; manufacturer photos where found, with exact/family captions and source links.
- Direct card links to manuals, technical specifications or product references.
- When a checked operating manual is unavailable, card and detail documentation links prefer a technical specification or brochure, then a product/document reference. Unreviewed linked manuals remain separately labeled in details. The optional `brochure_url` is editable through the form or CSV.
- In instrument details, the model name immediately above Selected variant opens its manufacturer product page; family-only pages carry configuration scope. Multi-variant selection tabs remain separate controls.
- Published manufacturer list/sale/starting prices have their own six evidence fields and source links. Display priority is sourced exact MSRP, then a sourced manufacturer price, then the asterisked class-equivalent estimate. Where a manufacturer price is available, its broad class estimate is collapsed under a fallback disclosure in details. CSV imports, manual entry and personal editing validate the same published-price evidence requirements.
- Manual links and scope, exact MSRP fields and asterisked class-equivalent estimates, material/process relationships and source provenance.
- Signed-in, account-specific persistent edits and added variants, protected by revision checks. CSV export includes your saved edits. Browser changes do not automatically commit to GitHub.
- The deployed app is owner-private. The code and curated CSV seed are public. The original inventory workbook and PDF are not redistributed.

## Local development

Requires Node.js 22.13+ (24 recommended).

```sh
npm run install:ci
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_sturdy_preak.sql
npm run dev -- --hostname 127.0.0.1 --port 5173
```

The starter provides a mock local sign-in; production uses verified ChatGPT identity. Local state and credentials are excluded from Git. Apply the migration once per local database.

```sh
node --experimental-strip-types --test tests/catalog.test.mjs
npm exec -- tsc --noEmit
```

Canonical data lives in the repository `catalog/` directory. From the repository root run `python scripts/build_app_data.py` after changing CSVs, then rebuild the app. The seed is deterministic; no network access is required to regenerate it.

Private inventory is a separate server-side dataset in `app/data/purdue-inventory.json`, linked by `equipment_id`. The public checkout supplies an empty array, never installed-equipment identifiers. The hosted owner-private source retains the user-supplied inventory. Only authenticated catalog responses include it; it is not imported into client code or public static assets. Preserve this distinction when synchronizing source. Model CSV imports do not change inventory entries or copy unit identities to new variants.

Inventory fields: `instrument_id`, `equipment_id`, `institution`, `serial_number`, `other_id`, `serial_or_other_id` (verbatim source cell), `inventory_status`, `quantity`, `description`, `inventory_notes`, `evidence_basis`, `recorded_date`. All identifiers are text. Only explicitly labeled serial numbers are classified as serials; ambiguous supplied identifiers remain in `other_id`. Planned purchases/builds have no invented serials. An inventory entry may describe multiple pieces or a composite system; the number of entries is not a physical unit count. Inventory downloads are snapshots, not input to the model-update CSV importer.

## Evidence limits

Ten core research examples are retained per active M category. Some are candidates awaiting verification. There are 102 checked operating-manual associations; the interface distinguishes source-reported, unresolved and unverified documents. No exact manufacturer MSRP amounts have been recorded yet. The UI shows asterisked class-equivalent estimate ranges where exact MSRP is absent; estimates use separate fields and preserve low/medium confidence, assumptions, dated sources and component-specific overrides. They are planning judgments, not vendor quotes. Material/process links are curated planning relationships and do not establish installed model suitability.

Purdue P flags identify the user's designated list, not independently verified ownership or access. Newly added variants do not inherit that marker or verified documentation status.

## Brand artwork

- Drexel University: unchanged inline logo from https://drexel.edu/identity/drexel/logos
- Purdue University horizontal mark: https://www.purdue.edu/brand-studio/wp-content/themes/purdue-home-theme-beta/imgs/PU-H-light.svg
- Purdue P: https://www.purdue.edu/brand-studio/wp-content/mu-plugins/boilerup-wp/favicon/android-icon-192x192.png

University marks remain the property of their respective institutions and are excluded from the repository MIT license. Their presence does not assert endorsement. ICoN-PCL logo supplied by the project owner; retained unchanged. The logo is excluded from the MIT license.


## Shared CSV administration

Open **Admin CSV updates** while signed in. Every authenticated user is temporarily an administrator; `app/admin-policy.ts` is the single policy function used by the UI and server. Site sharing remains unchanged.

The admin screen downloads blank templates, shared data for editing, category/material/process references, and a full shared snapshot. Upload UTF-8 CSV, validate, review field-level differences, then apply. Blank cells preserve values; `[CLEAR]` removes values. Supported operations are `update`, `add_equipment`, and `add_variant`. The canonical column contract is `app/csv-updates.ts`.

Imports update a shared D1 overlay and keep before/after import history. An atomic revision guard rejects stale/concurrent imports and rolls back the whole batch. Files support 1,000 rows, at most 100 changed records and 3 MB, with an additional 1.5 MB change-payload limit. No delete operation is provided. Manufacturer stars, source verification and Purdue markers cannot be assigned through CSV. New models/manual links remain unverified. Personal edits continue to override only changed personal fields.

Migration `0001_light_speed_demon.sql` adds shared catalog and import-history tables. Apply it to an existing local database after building, using the same local D1 command shown above with the new filename. Hosted migrations are applied by Sites during publication. Exported shared snapshots can be reviewed for Git; imports never automatically commit to GitHub.

Run CSV unit tests alongside catalog tests:

```sh
node --experimental-strip-types --test tests/catalog.test.mjs tests/csv-updates.test.mjs
```

With the local dev server running, `python tests/integration/admin_preview.py` checks mock sign-in, CSRF, preview without writes, multi-row application, invalid-batch rejection, shared visibility, concurrent conflicts and restoration. It is hardcoded to localhost and does not exercise or modify production.


The admin CSV screen is the second navigation tab. Administrators can also expand **Add machine profile** below the equipment-directory filters, review a manually entered instrument or variant, and apply it through the same shared CSV import endpoint and history.

Directory filter menus support multiple selections. Choices in one list combine with OR; separate lists combine with AND. Option counts respect the search text, other filter groups, and manual/Purdue toggles, while ignoring their own group's current selection. Options with a positive count are bold; zero-count options remain selectable. Click choices to toggle them, Shift-click for contiguous ranges, Shift+Arrow keys to extend a keyboard range, and Escape to close the menu.

## Newer models

`app/model-lifecycle.ts` applies the reviewed `catalog/model_lifecycle.csv` registry to each exact model identity. **Newer model available** appears on the directory box for the selected variant; details show the newer model link, relationship scope, manufacturer evidence and review date. The badge is independent of current availability/support status. Parallel products and unresolved relationships stay unbadged. Model/maker edits and newly created variants cannot inherit a parent's evidence. Lifecycle verification is maintained in the canonical repository, rather than the ordinary admin import fields. Run `node --experimental-strip-types --test tests/*.test.mjs` and regenerate the seed after registry changes.

The directory reports catalog-wide screening coverage independently of the current search filters. Every detail card distinguishes confirmed newer-model links, no-successor-confirmed outcomes, unresolved generation/identity checks and newly added records not yet reviewed. The initial full sweep screens 632 models/variants and confirms 24 relationships; 105 remain unresolved. No badge is a claim of latest-model status. Per-model source/query details and retrieval limits are retained in the repository review CSV/report.
