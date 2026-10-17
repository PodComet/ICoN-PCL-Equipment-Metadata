# Public purchase-price research, 17 October 2026

This pass added exact configuration prices to **59 previously unpriced model records**: 11 official manufacturer prices and 48 seller prices. Of these, 51 describe new equipment and eight are used, refurbished or condition-unconfirmed references. No MSRP was inferred from a seller price. The three Agilent IDP pump prices explicitly say **List Price** on the official US store; other official prices retain their published-price label.

The material database gained **42 distinct source pack quotes** and reviewed reference mappings. There are now 100 offer rows, including aliases that expose the same pack against different formulation identities. Aliases are references unless that particular formulation line has a reviewed eligible-offer ID. Twenty-one additional eligibility links were accepted; this does not imply that every such row has an absolute consumed amount suitable for automatic costing.

## Authority and source years

Four explicitly dated 2026 distributor publications were used:

- [OHAUS 2026 price list](https://store.clarksonlab.com/Vendors/vOha.pdf), effective 1 January 2026.
- [Thermo Scientific 2026 laboratory equipment list](https://store.clarksonlab.com/Vendors/vThe.pdf), effective 1 January 2026.
- [Nabertherm Inc 2026 price list](https://store.clarksonlab.com/Vendors/vNabi.pdf).
- [VELP Scientifica 2026 price list](https://store.clarksonlab.com/vendors/vVels.pdf).

Clarkson identifies itself as an authorized distributor in the relevant publications. These are public distributor pricebooks, not independently authenticated manufacturer MSRP benchmarks. OHAUS **List Price** is distinct from its **MAP** column; MAP was not imported as a purchase offer. The still-online IKA list retains its actual May 2025 effective date. A current website price observed in October 2026 is not presented as a price list published in 2026.

[MIT procurement](https://procurement.mit.edu/expert-buying-advice/lab-supplies-and-equipment) describes preferred suppliers and its VWR stockroom. [Northwestern](https://www.northwestern.edu/procurement/source-purchase/preferred-vendors/internal-billing/lab-supply-stockroom.html) documents the Fisher punchout/live-price catalog. [Berkeley](https://supplychain.berkeley.edu/node/143) lists Fisher, VWR and Sigma-Aldrich laboratory catalog suppliers. These sources establish research-procurement relevance; they do not demonstrate that all shortlisted laboratories endorse one catalog or purchased particular models. Private negotiated account prices were not accessed.

The official Eppendorf directory confirms a 2026 price list for its German market. No numerical US price was inferred from that directory. Separately verified US product pages supplied exact centrifuge packages with named rotors, voltage and included accessories.

## Model, package and material matching

Every instrument price is bound to its existing equipment ID, manufacturer and model, with configuration, currency, condition, source and observation date. A pump base, titration measuring unit or grinder base remains labeled as such; missing peripheral equipment is not assumed included. Current robot configuration prices do not identify a Purdue asset's installed controller or pendant.

Component packs retain seller, manufacturer, SKU, chemical grade/form, package quantity, units, price and compatibility rationale. Prepared solutions do not inherit dry-powder prices. A shared two-part SYLGARD kit is not charged independently as a full base kit and a full curing-agent kit. Targets, wafer dimensions, patterned substrates and TEM grid meshes remain reference prices where the source recipe does not establish an exact fit. Concentration, gas flow and coating thickness are not consumed amounts. No density or production yield was invented.

All new prices are USD. The established project estimate rule remains restricted to explicit MSRP and official manufacturer list-price benchmarks. Seller prices and secondary-market references do not become estimation anchors. New-equipment process totals exclude used, refurbished and condition-unconfirmed offers. Taxes, delivery, installation, utilities, labour and hazmat fees are outside these public price snapshots.

## Coverage and remaining work

The committed seed contains 1,062 model records. Its price coverage is:

| Status | Records |
| --- | ---: |
| Explicit MSRP | 1 |
| Official manufacturer price, without MSRP | 155 |
| New seller price, without a manufacturer price | 62 |
| Secondary-market/condition-unconfirmed offer only | 44 |
| Formula estimate only | 37 |
| No purchase price or usable estimate | 763 |

Of the 859 initially unpriced records, 105 were individually reviewed in this bounded pass and 754 remain explicitly unreviewed. A reviewed rejection does not establish that no public price exists anywhere.

Across 248 formulation component occurrences, 72 have a compatible pack offer, 68 have reference offers only and 108 have no market offer. Seventy-nine of 188 distinct component IDs were reviewed across this pass and 109 remain unreviewed. Missing prices and uncosted amounts remain unknown rather than zero.

## Reproduce and inspect

- [Field-level review and research decisions](../catalog/price_review_2026-10-17.json)
- [Price-source ledger](../catalog/pricing_sources_2026.json)
- [Instrument coverage CSV](../catalog/instrument_price_coverage.csv)
- [Component coverage CSV](../catalog/component_price_coverage.csv)
- [Seller offers](../catalog/seller_offers.csv) and [component offers](../catalog/component_offers.csv)

Run `python catalog_tools.py` and `python scripts/build_app_data.py` to regenerate coverage and app data without network access. The review archive retains source years, PDF page/SKU locators, exact price evidence, rejected alternatives and explicit review status. Source PDFs and private equipment inventory are not redistributed.
