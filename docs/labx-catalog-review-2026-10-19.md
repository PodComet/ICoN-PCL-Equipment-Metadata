# LabX materials-science catalog review — 19 October 2026

Screened all **304 listings** shown on the [Materials Science and Testing application page](https://www.labx.com/application/materials-science-and-testing), across four pages. Selected exact-model checks also covered linked analytical and laboratory categories. Index screening is discovery; this is not a full technical audit of every listing or all of LabX's catalogs.

## Added models and asking prices

| Class | Model | Condition | Seller via LabX | Asking price, USD |
| --- | --- | --- | --- | ---: |
| M16 | [BUCHI Rotavapor R-215](https://www.labx.com/item/buchi-rotavapor-evaporator-r215-with-vacuum-pump-water-bath/DIS-37051-3bc5e03afe31367a8e6ee2b5ff959a7c) | Used | InnovtrendLab | $3,500 |
| M16 | [Heidolph Hei-VAP Advantage](https://www.labx.com/item/heidolph-hei-vap-advantage-evaporator-including-heidolph/DIS-37051-6ab45c4f35ecf4fc07739aceb2ce229b) | Used | InnovtrendLab | $2,500 |
| M41 | [Veeco CP-II](https://www.labx.com/item/featured/DIS-86979-491) | Refurbished | EquipX | $29,500 |
| M98 | [Shimadzu EDX-800HS2](https://www.labx.com/item/shimadzu-edx-800hs2-energy-dispersive-x-ray-3871/DIS-86979-3871) | Refurbished | EquipX | $26,500 |
| M37, existing profile | [Bruker D8 ADVANCE, Series 1 configuration](https://www.labx.com/item/featured/4262755) | Refurbished | KS Analytical Systems | $57,000 |

The two evaporator offers include stated pump/bath/glassware configurations; a chiller from a different listing is not included. Fitted AFM modes and XRF options remain configuration dependent. Exact pages were checked in the normal browser, including current price, condition, seller and absence of an unavailable banner. Search snippets carried different historical prices for some models and were not used as current quotes. No purchase or seller contact was made.

All five prices remain **seller asking prices**, separate from manufacturer prices and MSRP. They do not qualify as official list-price anchors under the project's estimation rule. New-instrument planning estimates may therefore remain alongside these condition-specific alternatives. Shipping, tax, installation, consumables and service are not presumed included. The four new models use existing M classes; their P/N links are curator functional suggestions, not evidence of use in a particular published recipe.

## Photos and documentation

Added **14 instrument photos**: four for the new models and ten filling existing gaps. Existing profiles are BUCHI R-100 and R-300; SP VirTis BenchTop Pro; PolyScience AD07R-20; Malvern Zetasizer Nano ZS; Bruker D2 PHASER and D8 ADVANCE; and Milli-Q IQ 7000, IQ 7005 and IQ 7015.

The D8 image shows Series 1, the PolyScience image an A12E configuration, and VirTis a configurable BenchTop Pro example. The EDX photo is explicitly a family illustration: its visible label says EDX-800HS while the seller title and institutional specification identify HS2. These images do not establish installed configurations or ownership. Five older photographs come from listings that are no longer available; they remain labeled historical references, with no current price inferred. Only remote source references are stored; original image rights remain with the sources.

Two model-family operating manuals cover R-215 and Hei-VAP Advantage. The R-215 manual is BUCHI-authored but hosted by a third-party mirror; that distinction is retained. Exact university technical specifications serve as fallback documents for CP-II and EDX-800HS2, and are not labeled manufacturer manuals. The [official BUCHI service table](https://www.buchi.com/en/support/spare-parts-service-availability) explicitly names R-300 as R-215's replacement, enabling a source-backed newer-model badge. Its planned service-end date is historical and is not a current support guarantee.

## Material packs

Two new market-reference nanofillers are surface-modified **15–40 nm calcium-carbonate powders**, each **100 g at $495 USD** from Spectra Services: [B2026208 for PVC](https://spectraservices.com/product/molecular-depot-b2026208.html) and [B2026207 for adhesives](https://spectraservices.com/product/molecular-depot-b2026207.html). Exact SKU, pack, form, currency and check date are retained. LabX discovery showed $524.70; the direct seller quote is a separate source observation, not a claimed price decrease.

Both are broad P29 polymer-composite-film market options. Numerical purity and surface-treatment chemistry are unspecified; they do not become eligible substitutes for existing literature formulations or output models. Their generic, identical bottle graphics were withheld. Eight other supplier candidates were held for uncertain process relevance or ambiguous formulation, including a product titled paste but specified as powder without carrier or solids content.

## Exclusions, provenance and reproduction

Sold/withdrawn listing prices, shipping charges, partial atomizer images, quote-only prices and uncertain model matches were excluded. Filabot polymer extrusion was not forced into the metal-extrusion class; bulk Raman was not treated as Raman microscopy. Heidolph's erroneous seller manufacturer field (GE) was reconciled against its branded instrument and manufacturer manual. Used/refurbished description discrepancies remain in source context.

The [machine-readable review](../catalog/labx_catalog_review_2026-10-19.json) records adoption, before/after fields, exclusions, access failures and source checks. **25 source claims** resolve through the [readable evidence register](evidence-register.md). An ordinary HTTP request to LabX returned 403; normal browser access worked, without bypassing a challenge. Raw HTML, PDFs, image binaries, credentials, private serials and user plans are excluded from public Git. Existing Purdue designations, manufacturer stars and literature recipes are unchanged.

Regenerate with `python catalog_tools.py`, `python scripts/build_app_data.py` and `python scripts/build_usd_prices.py`. All new native prices are USD; no exchange-rate change is needed.
