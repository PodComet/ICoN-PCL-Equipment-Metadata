# Nanomaterial Equipment Ontology

Searchable research equipment catalog for ICoN-PCL, with Drexel University and Purdue University marks.

## Features

- 631 equipment records, grouped into product-family cards with variant tabs.
- Search and filters for equipment family, materials, processes, manufacturer, manual evidence, and the user-designated Purdue list.
- Manual links and scope, dated MSRP fields, material/process relationships and source provenance.
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

## Evidence limits

Ten core research examples are retained per active M category. Some are candidates awaiting verification. There are 102 checked operating-manual associations; the interface distinguishes source-reported, unresolved and unverified documents. No sourced MSRP amounts have been recorded yet. Material/process links are curated planning relationships and do not establish installed model suitability.

Purdue P flags identify the user's designated list, not independently verified ownership or access. Newly added variants do not inherit that marker or verified documentation status.

## Brand artwork

- Drexel University: unchanged inline logo from https://drexel.edu/identity/drexel/logos
- Purdue University horizontal mark: https://www.purdue.edu/brand-studio/wp-content/themes/purdue-home-theme-beta/imgs/PU-H-light.svg
- Purdue P: https://www.purdue.edu/brand-studio/wp-content/mu-plugins/boilerup-wp/favicon/android-icon-192x192.png

University marks remain the property of their respective institutions and are excluded from the repository MIT license. Their presence does not assert endorsement. ICoN-PCL logo supplied by the project owner; retained unchanged. The logo is excluded from the MIT license.
