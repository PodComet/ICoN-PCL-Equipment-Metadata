# MSE Supplies price and image review — 19 October 2026

The [MSE Supplies catalog](https://www.msesupplies.com/pages/mse-supplies-products) was screened against the existing ontology. Its 52 product sitemaps contained **51,618 indexed product entries**. Name screening produced 168 candidate links for 61 existing instrument records; exact models, variants and missing fields were then reviewed. This is a focused gap review, not verification of every product or price in that index.

## Added to existing records

- **14 instrument images:** IKA A10 basic, A11 basic, M20 Universal mill; four OVEN125 basic/control and solid/glass-door configurations; RV3, RV8 and RV10 digital; Kinematica PT2500E, PT3100D and PT10-35GT; JULABO MAGIO MS-600F. Photos retain their seller source and configuration scope. Shared electrical images do not establish the supplied voltage, and a drive-only photograph does not establish a complete homogenizer station.
- **Two newly priced instruments:** Pfeiffer HiScroll12 at **USD8,469.95** (SKU2000026578.1, variant40690681937978) and HiScroll18 at **USD9,686.95** (SKU2000026597-1, variant40696650465338). Both selected configurations have automatic gas ballast and an integrated pressure sensor. These are explicit new-equipment **seller offers**, not manufacturer MSRP; mains cables are separate. Less expensive sensor-free variants are not silently substituted for these configurations.
- **12 available material pack quotes across seven component identities**, five previously without a sourced pack price: aluminum pellets; indium pellets; gallium metal; GaAs and GaSb substrates; natural flake graphite; 50nm silica powder. Each row retains exact SKU, grade, form, dimensions where applicable, pack quantity, USD price, selected variant and review date. Three component identities gain scoped seller photographs: gallium, graphite and silica.

All material additions are **reference-only**. No formulation eligibility, experimental amounts, reaction conditions or output estimates were changed. Commercial gallium/indium and substrate choices do not establish MBE recipe compatibility. The actual manufacturer of seller-branded MSE PRO materials is not disclosed and is left blank in that field.

## Withheld or preserved

AI-labelled material pictures were excluded. Five products with numeric prices but unavailable selected variants were documented in the audit rather than adopted as current offers. These include selenium targets labelled99.995%, which must not be treated as the source's99.999% target. Current zero/quote-only listings for several targets and Inovenso systems were not recorded as zero-dollar prices.

HiScroll12's seller image refers to HiScroll18, and its copied pumping-speed specification is inconsistent; its existing photo/specifications remain unchanged. Nabertherm R50/250/12 imagery was withheld because the photographed controller/configuration could not be established. Huber600-H was not assigned to an unresolved600 configuration. MultiPort standard/jacketed kit and accessory prices were not assigned to the user's unspecified Gamry corrosion cell.

## Reproduction and evidence

The [machine-readable review](../catalog/mse_catalog_review_2026-10-19.json) contains source-index hashes, selected SKUs/variants, price and image evidence IDs, photo before/after fields and exclusion reasons. **28 new evidence records** enter the public [Evidence register](evidence-register.md). Earlier observations remain available. Remote images are linked with their original rights retained; raw supplier pages, source PDFs and image binaries are not redistributed in public Git.

Regenerate with `python catalog_tools.py`, `python scripts/build_app_data.py` and `python scripts/build_usd_prices.py`. Native prices are USD, so no FX change was needed. Equipment model/class counts, Purdue designations, private inventory separation and saved user workflows are preserved. Research updates fill untouched photo snapshots while retaining deliberate user edits and identity guards.
