# Thermo Fisher catalog gap review — 19 October 2026

The [Thermo Fisher Shop All Products catalog](https://www.thermofisher.com/us/en/home/order.html) was compared with existing ontology records, focusing on missing photos, missing direct manufacturer prices and relevant material pack quotes. The chemical review screened 34 product pages. The instrument review used the existing Thermo/Applied Biosystems/Invitrogen records and selected catalog/model pages. This is a focused gap review, not verification of every product in Thermo Fisher's catalog.

## Instrument photos

**12 existing profiles gain images:** Vacutherm VT 6025 and VT 6060; Evolution One and Evolution Pro; Nicolet Summit; Axia ChemiSEM; DXR3 Raman microscope; Barnstead GenPure xCAD Plus; Smart2Pure Pro 16 UV/UF with 30 L tank; K-Alpha; ARL PERFORM'X; and Niton XL5 Plus.

Eight are model-matched views. Four are explicitly **representative family images**: the shared Vacutherm image used for two chamber sizes, the Summit PRO illustration used only as a labeled Summit-family view, and the configurable GenPure xCAD Plus family. A family picture does not establish a particular controller, chamber size or accessory bundle. The Smart2Pure photo shows its front panel, not a complete tank installation. Original image rights remain with the sources; only remote references are included.

## Instrument prices

| Existing model / selected manufacturer SKU | Official US list price | Separate online-exclusive price |
| --- | ---: | ---: |
| Evolution One / 840-341400 | USD 10,200 | — |
| Evolution Pro / 840-340200 | USD 16,000 | — |
| Thermolyne FB1315M / FB1315M, 120 V | USD 2,090 | USD 1,881 |
| Smart2Pure Pro 16 UV/UF + 30 L tank / 50157882 | USD 17,700 | USD 15,930 |

All four fill empty manufacturer-price fields. Smart2Pure also closes one record with no previously sourced purchase price; the other three already had seller references. Existing seller observations remain available. Official list prices qualify for the owner's estimate benchmark rule; discounted online offers remain separate and are not MSRP anchors. None of these prices is labeled MSRP. Contract prices, stock, shipping, fees and tax may differ.

## Material packs and media

**12 new US USD pack quotes across seven existing component identities** cover titanium(IV) isopropoxide (5/25/100 g), DMSO, two acetonitrile grades, two methanol grades, cyclohexane, two differently stabilized dichloromethane grades, and HPLC water. Solvent packs are 1 L each. Exact SKU, grade, stabilizer, pack, source and check date are retained. Promotional prices retain their stated 28 December 2026 expiry where shown.

The titanium isopropoxide quotes are 99.995% metals-basis material: a reference alternative to the 99.9% source identity, **below** the separate 99.999% identity. Existing generic titanium-isopropoxide quotes mean this is not a new chemical-identity price discovery. All 12 additions remain reference-only; they do not authorize formulation substitution, doses or automatic recipe costs.

One existing V22889 offer gains the manufacturer's **whole-kit packaging photograph**, showing its three dye vials. The kit price and allocation restrictions are unchanged; it is not an isolated DiD vial, neat DiD or an output material photo. Chemical structure diagrams are not presented as material photos.

## Preserved gaps and reproduction

RFQ-only products, hidden numeric prices on Contact Us pages, obsolete SKU stubs, historical prices, mismatched purity/stabilizer records and prices for a different GenPure dispenser/configuration were withheld. Existing photos, quotes, Purdue designations, private serials and saved plans were preserved. No equipment models, M/P/N classes, process conditions, quantities or recipe eligibility changed.

The [machine-readable audit](../catalog/thermo_catalog_review_2026-10-19.json) retains before/after fields, selected SKUs, representative image scopes, source hashes and exclusions. **31 new source claims** are in the [readable Evidence register](evidence-register.md). Raw supplier HTML, PDFs and image binaries remain outside public Git.

Regenerate with `python catalog_tools.py`, `python scripts/build_app_data.py` and `python scripts/build_usd_prices.py`. All new native prices are USD, so this review requires no exchange-rate change.
