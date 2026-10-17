# Photos and published prices — 17 October 2026

This bounded gap-focused pass reviewed **94 existing models** and improved **77**. It added **43 photos** and supplied published prices for **65 previously unpriced models**. It did not revalidate every instrument.

| Coverage | Before | After |
| --- | ---: | ---: |
| Model records | 858 | 858 |
| Records with a photo | 378 | 421 |
| Records with a published manufacturer price | 71 | 101 |
| Records with any published manufacturer/seller price | 71 | 136 |
| Seller offer records | 0 | 38 |

Three models have both a manufacturer and seller quote; those models are counted once in the combined total. Of the 38 seller quotes, eight explicitly identify new equipment, two identify used equipment and 28 do not state condition. Price kinds remain list, sale, asking, starting or generically published; none is relabeled MSRP.

## Source-bound evidence

The [review ledger](../catalog/link_review_2026-10-17-sellers.json) records reviewed models, source URLs, unsuccessful outcomes, scoped changes and before/after evidence. The [seller-offer CSV](../catalog/seller_offers.csv) is the canonical supplier dataset; [USD price comparison CSV](../catalog/equipment_prices_usd.csv) retains source amounts and adds USD equivalents. Rebuild with `python catalog_tools.py`, `python scripts/build_app_data.py` and `python scripts/build_usd_prices.py`.

Sources include IKA, Sonics, Edwards, JULABO, Holmarc, CEM, Fisher Scientific, LabRepCo, Pipette, Duniway, DigiKey Marketplace, RobotShop, Vention, Pro-Robots, Analytical West, Sterlitech, Certified MTP and regional laboratory suppliers. The ledger links each exact product page. For example, [Fisher's SimpliAmp A24811 page](https://www.fishersci.com/shop/products/simpliamp-thermal-cycler/a24811) publishes a USD 6,500 list price for its limited-warranty configuration. Search-index promotions absent from the live page were not used.

Quotes state relevant capacity, voltage, package and exclusions. The Vivaflow 200 quote is for a cassette, not a powered filtration system. A Vention UR16e request explicitly returned USD 51,979, while a separate region-localized request returned EUR 39,145; the retained USD quote is marked region-dependent rather than treating these as an exchange-rate equivalence. The EUROSTAR 20 quote identifies catalog SKU 0020105154 on the German page; it does not resolve the operator-manual generation mismatch or substitute the different U.S. SKU 0020132593.

## Display and planning

Cards prioritize explicit MSRP, then a published manufacturer price, then a seller offer explicitly describing new equipment, then the existing formula estimate. Other-condition seller offers remain visible with their condition and source, and can serve as a display fallback where no other figure exists. The detail card lists all recorded seller offers and retains the separate estimated-MSRP disclosure. Only explicit MSRP and qualifying **official manufacturer list prices** anchor the existing MSRP formulas; distributor list prices do not become manufacturer MSRP benchmarks.

New-equipment process snapshots follow the same price order, with used/refurbished/condition-unstated seller offers excluded from acquisition totals. Saved workflows keep their recorded price snapshot until equipment is assigned again. Seller quotes retain seller, kind, condition, date and configuration scope. USD conversion uses the existing 16 October 2026 ECB snapshot; native currency remains available. A seller quote is evidence of an advertised offer, not certification of stock, suitability or the completeness of a proposed process.

## Photos and preservation

All 43 new external photo URLs independently returned HTTP 200 and image content during this pass. Thirty-five additions use seller sources and eight use manufacturer sources. Some show a declared family or regional/configuration variant; captions make this explicit. Known AI-labeled imagery and mismatched accessory photos were excluded. Photos remain source-linked external references; this project does not assert a redistribution license over third-party images.

Model counts, categories, Purdue membership, private inventory, manual-verification status and academic citations were preserved. Supplier pages are commercial evidence and were not added to the academic-only reference library. Historical dated reviews remain intact; the regenerated MSRP-rule report is saved separately for 17 October.
