# Purchase-price review, 18 October 2026

The database gained **42 price observations for 41 previously unpriced models** and **33 distinct material/component pack quotes across 16 component identities**. These are published manufacturer, distributor and seller amounts, with configuration, condition, source, currency and observation date preserved. Five prices come from manufacturers; 37 are seller offers. Thirty-four models have new-equipment catalog configurations, while seven have used, refurbished or condition-unconfirmed references. Thermolyne F48025 has two separately priced controller configurations; this is one model, not two newly priced instruments.

All prices display in USD. Seven instrument observations originated in EUR or GBP; native amounts remain in the offer and evidence records. Conversions use the existing [16 October 2026 ECB reference snapshot](../catalog/currency_reference_rates.json). They are comparison amounts, without taxes, delivery, import charges, hazmat fees, installation, labour or utilities.

## Documentation and online review

The read-only scan covered 221 document entries representing 206 distinct file hashes: 32 public Markdown documents, 22 original/source PDFs, seven workbooks, five Word documents, four HTML files and 151 cached source-text files. Two Office lockfiles were excluded. This was a text and currency-candidate review, not a claim that every document page or outbound link was manually re-read. No new usable published purchase quote was established from the original local articles or manuals; an existing private spreadsheet range was not promoted to manufacturer MSRP. Private paths, article files and inventory details are not redistributed.

The online pass revisited dated pricebooks and followed exact-model and exact-pack pages. It is a bounded review, not an exhaustive search of every seller. The [machine-readable review](../catalog/price_review_2026-10-18.json) records 28 instrument and 19 component rejection/defer decisions alongside accepted observations. Reviewed gaps remain gaps when the amount belongs to an accessory, a different model, a sold-out listing, a facility fee or a minimum order.

Useful sources include:

- [Thermo Scientific 2026 distributor pricebook](https://store.clarksonlab.com/Vendors/vThe.pdf): F48025 controller configurations, Vacutherm VT 6060 M and a GenPure xCAD Plus UV/UF configuration.
- [Government Scientific Source](https://www.govsci.com/product-detail/Thermo--Nicolet/912A0760/EA/): public SKU prices for ultracentrifuges and UV/Vis and FTIR spectrometers. These are distributor prices; no institutional account was accessed.
- [Hielscher UIP1000hdT](https://www.hielscher.com/i1000_p.htm): a North America flow-cell set at USD 17,950, with the included components recorded.
- [BUCHI US shop](https://shopus.buchi.com/buchi-rotavapor-r-80-with-vertical-condenser-4.html): R-80, R-180 and R-300 configurations. The linked R-180 page has a legacy R-80 URL slug; its on-page heading and SKU identify R-180.
- [Sigma-Aldrich HPLC acetone](https://www.sigmaaldrich.com/US/en/product/sigald/270725), [Krackeler material catalog](https://www.krackeler.com/catalog/sigma/ALDRICH/81383), [Lab Alley DI water](https://www.laballey.com/products/deionized-water-lab-grade-kosher?selected=WAD-1L) and [EMS glass slides](https://www.emsdiasum.com/diamond-white-glass-microscope-slides): pack-bound material offers.

## Price and compatibility boundaries

No seller price was relabeled as MSRP. Manufacturer published, special-set and starting prices retain their kinds; the Across International PQ-N4 page explicitly calls its configurator amount an **Estimated Price**, recorded as a starting price with that qualification. None of these five manufacturer observations establishes an official list-price benchmark. The owner's MSRP estimation rule remains restricted to explicit MSRP and official manufacturer list prices.

New condition is inferred for ordinary commercial catalog listings when it is not stated explicitly; that inference and unconfirmed stock/lead time are recorded in the offer scope. New-open-box Metrohm stock is conservatively condition-unconfirmed for process budgeting. Used, refurbished and condition-unconfirmed seller amounts do not enter new-equipment totals. An out-of-stock recertified Heidolph offer was retained only as a review decision, not imported into live offers.

Nineteen recipe-line/offer eligibility links were reviewed. Only seven previously uncovered component occurrences became compatible-pack matches: a compatible pack does not establish an absolute consumed dose when the source reports only concentration or an unspecified volume. Dry Mowiol remains a reference for a prepared 5 wt% solution; concentrated acids do not automatically price dilute recipes. Unspecified wafer dimensions, polymer molecular weight/counterion, magnesium feed form and graphite foil dimensions remain reference-only. The graphite foil SKU is one 15 × 250 cm piece/roll, not 15 sheets.

Thirty-six offer rows were added, including three explicit reference aliases for already counted HF packs. Aliases do not inflate the 33 distinct pack-quote count or acquire automatic cost eligibility. One silica-substrate product image and one DI-water packaging image accompany their sourced offers.

## Coverage after this review

The catalog still has 1,079 model/category records, 922 equipment family cards and 260 formulation component occurrences. Pricing research added no models or categories.

| Instrument coverage | Before | After |
| --- | ---: | ---: |
| Explicit MSRP | 1 | 1 |
| Manufacturer price, without MSRP | 156 | 161 |
| New seller price, without manufacturer price | 62 | 91 |
| Secondary-market / condition-unconfirmed only | 44 | 51 |
| Formula estimate only | 37 | 29 |
| No purchase price or usable estimate | 779 | 746 |

| Component occurrence coverage | Before | After |
| --- | ---: | ---: |
| Compatible pack offer | 72 | 79 |
| Reference offer only | 79 | 93 |
| No market offer | 109 | 88 |

The database now has 157 component offer rows. Missing prices and uncosted amounts remain unknown, not zero. A deferred or rejected match does not demonstrate that no price exists elsewhere.

## Evidence and reproduction

Seventy-five stable `PRICE-EV-…` records preserve the 42 instrument observations and 33 distinct pack quotes. Search them by model, SKU, material, P/M category or evidence ID in **Evidence & sources → Evidence register**. Each record links its price, exact configuration or pack, source locator, checked date, related model/formulation and conversion context.

- [Accepted prices, before/after changes and rejected matches](../catalog/price_review_2026-10-18.json)
- [Canonical price evidence](../catalog/purchase_price_evidence.json) and [readable evidence register](evidence-register.md)
- [Instrument coverage CSV](../catalog/instrument_price_coverage.csv) and [component coverage CSV](../catalog/component_price_coverage.csv)
- [Seller offers](../catalog/seller_offers.csv), [component offers](../catalog/component_offers.csv), [source ledger](../catalog/pricing_sources_2026.json)

Regenerate the views and app data with `python catalog_tools.py` followed by `python scripts/build_app_data.py`. The tests verify model identity, source amounts, currencies, configuration boundaries, reference-only exclusions and reproducible coverage/evidence. Saved instrument snapshots acquire untouched manufacturer-price groups; personal quotes, explicitly cleared fields and renamed models keep their edits.
