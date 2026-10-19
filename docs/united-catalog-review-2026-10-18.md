# United Scientific catalog review — 18 October 2026

The [requested catalog page](https://www.unitedsci.com/catalogs-brochures) links two 2026 catalogs: [Laboratory Products](https://www.unitedsci.com/media/wysiwyg/pdfs/United_Scientific_2026_Laboratory_digital.pdf), 586 pages, and [Education Products](https://www.unitedsci.com/media/wysiwyg/pdfs/United_Scientific_2026_Education_digital.pdf), 582 pages. Both were text-screened against existing model names and component identities. The matching laboratory page and product photograph were visually checked. This is not a manual technical validation of every catalog item.

## Accepted additions

Laboratory catalog page 361 identifies **MSL3X1**: plain, precleaned glass microscope slides with ground edges, **75 × 25 × 1.0–1.2 mm, 72 per pack**. These satisfy the dimensional requirement for the existing **P27** microfluidic nanoprecipitation chip substrate line, `P27-LITERATURE-20261017-C10`. The source does not impose a named glass composition or optical grade.

| Seller | Exact pack | Published USD price | Source |
| --- | --- | ---: | --- |
| U.S. Plastic Corp. | MSL3X1, 72 slides; seller item 76663 | $6.66 | [Product listing](https://www.usplastic.com/catalog/item.aspx?itemid=119090) |
| Nexera Scientific | MSL3X1, 72 slides; seller SKU NUS-MSL3X1 | $7.00 | [Product listing and photo](https://nexerasci.com/products/glass-microscope-slides-plain-pre-cleaned-ground-edges-75-x-25mm-1-0-1-2mm-thick-box-of-72) |
| Fisher Scientific | MSL3X1, 72 slides; catalog S139531 | $7.98 | [Product listing](https://www.fishersci.com/shop/products/glass-microscope-slides-4/S139531) |

These are **three offers for one SKU and pack configuration**, not three new material identities. Prices were checked on 18 October 2026, exclude shipping/tax, and may change. Fisher account or contract prices may differ. U.S. Plastic's public page and USD price microdata were verified by direct HTTP after one web-fetch service returned 404.

The Nexera offer includes one verified product photograph showing the MSL3X1 label and 72-slide pack. Its source, scope, rights attribution and verification hash are retained. The photo is available when that offer is selected in the component card; it is a product illustration, not a nanomaterial micrograph.

All three offers are selectable for the P27 substrate. Existing offers and the default selection remain. The line retains `cost_scope: reusable`: a pack acquisition price does not establish substrate lifetime, reuse count or consumed material cost, so these quotes do not automatically increase the consumed-reagent process subtotal.

## Instrument and price limitations

No exact existing instrument make/model matched either catalog. The ontology has no United Scientific instrument profiles; similar functions or appearance do not establish that another manufacturer's photograph or price belongs to a current model. **No instrument prices, instrument photos, new model profiles or manufacturer verification stars were added.**

The publisher states that it sells through authorized dealers and its catalogs contain no retail prices. The accepted dealer amounts are published seller prices, not MSRP or official manufacturer list-price benchmarks. Plain glass slides were not substituted for fused silica, sapphire, silicon, oxide or conductive-coated substrates. Unmatched filtration supplies were not treated as exact membrane matches.

## Reproduction and evidence

The [structured review](../catalog/united_catalog_review_2026-10-18.json) records PDF hashes, page locators, accepted/rejected matches, source URLs, offer IDs, evidence IDs, image verification and the eligibility change. Three new price evidence records appear in the readable [evidence register](evidence-register.md) and the application's **Evidence & sources** tab. Original PDFs and image verification copies remain local; the repository contains metadata and source links.

Regenerate the published data from the repository root:

```sh
python catalog_tools.py
python scripts/build_app_data.py
```
