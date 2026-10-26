# Weekly material and component price refresh — 26 October 2026

All 224 existing offers across 157 source URLs attempted: 163 prices reconfirmed, 0 changed, 61 prior dated quotes retained. Exact identities and media unchanged.

No numeric price changes were verified. This is a partial source-verification refresh, not a claim that every quote is current. The 26 offers added since the previous scheduled sweep are included in this run's 224-record scope.

Direct retrieval returned 104 successful pages, 24 HTTP403 responses, 28 transport failures and one HTTP404. The source reader recovered ten TCI US product tables and the exact Thermo Fisher 022914.K2 USD price table. The latter remains USD124.65 for 1 L of HPLC-grade DMSO, an online offer listed through 28 December 2026; the separate USD146 regular price was not substituted.

Three offers that were verified in the previous scheduled run could not be reverified: Thermo Scientific Chemicals B23726.14, and Santa Cruz Biotechnology sc-253704/sc-253704A. Their previous prices and 19 October dates remain intact. TCI T1353-25G was recovered and reconfirmed. The MSE BR0066461 source now returns HTTP404; its previous USD117.95/100 g quote remains dated 19 October. No collection-level or different-region price was substituted. Government Scientific's 042953-VU EA/15-per-EA ambiguity and U.S. Plastic's absent public numeric MSL3X1 quote remain unresolved.

All source quotes are USD. The project's dated currency policy remains unchanged at 16 October 2026; no conversion was necessary. SKU, manufacturer, grade, form, pack quantity/unit, price kind, images and recipe eligibility are preserved. No new offers, materials, recipes or images were added.

The [dated audit](../catalog/material_price_refresh_2026-10-26.json) contains every attempt, available response hashes, exact scope, complete before/after quote metadata and source-status changes. Each verified quote has a new evidence ID with its previous quote and any prior evidence link. Unverified quotes retain both their amount and checked date. Source pages stay outside public Git.

Regenerate with `python scripts/build_app_data.py`. Validation covers unchanged identities, historical retention, evidence context and the generated app export. The current password-only site access, private Purdue inventory, credentials, source PDFs and saved user plans are not part of this public price refresh.

Validation: 140 Python tests and 270 application tests pass. The production build preserves password protection for all 27 nonbranding static resources. Historical catalog tests reconstruct their dated checkpoints through the refresh audit rather than treating legitimate subsequent quote rechecks as unexplained changes.
