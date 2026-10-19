# US Nano and UCLA INML ingestion — 18 October 2026

This pass fills bounded gaps identified in the [US Research Nanomaterials catalog](https://www.us-nano.com/) and [UCLA INML equipment pages](https://inml.cnsi.ucla.edu/equipment/). It is not an exhaustive import of either website.

## Materials and prices

**38 supplier pack quotes across 17 distinct material grades/forms** were added from US Nano: graphene, graphene oxide, graphene nanoplatelets, pristine/OH/COOH multiwall nanotubes, single-wall nanotubes, aqueous dispersions, 50 nm silica, three BN grades and two natural flake graphite sizes. Pack size, purity, surface chemistry, dimensions and solvent/concentration remain separate. Quotes are displayed as USD, interpreted from the US supplier's dollar catalog and FOB Houston terms; this interpretation is explicit in each evidence record. They are published supplier prices, not explicit MSRP. Freight, taxes and fees are excluded.

| Product / selected option | Pack | Price |
| --- | --- | ---: |
| US1133M dry silica, 50 nm | 100 g | $68 |
| US1149M natural flake graphite, 10 µm | 100 g | $95 |
| US1022 dry single-layer GO | 0.5 g | $168 |
| US4300 dry MWCNTs, OD <7 nm | 1 g | $39 |
| US7906 GO aqueous dispersion, 1 wt% | 30 mL of dispersion | $980 |

The [structured US Nano review](../catalog/usnano_review_2026-10-18.json) retains source URLs, SKU/selector options, grades, image scope and evidence. Source-compatible pack options were added to existing P08 silica and P34 graphite lines. These are specification-level commercial alternatives, not claims of unchanged experimental performance.

Other grades are selectable **market material options**, with their own identities and user-entered consumption. US Nano CNTs do not become Nanocyl NC7000, vendor GO does not become study-synthesized Scaffaro GO, and BN variants do not acquire eligibility for P31's source micropowder. Dispersions are priced by purchased liquid volume; no density or dry-mass conversion is invented. Estimated consumption cost is distinct from pack acquisition or validated dosage.

**31 priced offers have verified supplier imagery, using 11 distinct image URLs.** These are electron micrographs, not powder/bottle photographs. Some files reuse the same underlying field across dry/dispersion or functionalized variants; captions preserve that limitation. Images and scale bars remain unmodified. Source links and rights attribution accompany display; verification copies stay local.

## Equipment and process gaps

UCLA adds **14 equipment/configuration records covering 12 named model families plus one unmodeled facility setup**. Thirteen records represent named models because GEN-930 has two configurations. The high-frequency probe setup preserves its unknown make/model. No equipment matches were identified in US Nano's material catalog.

| Class | New category |
| --- | --- |
| M100 | Molecular-beam epitaxy systems |
| M101 | Optical grating spectrometers for photoluminescence |
| M102 | Semiconductor electrical/optoelectronic probe stations |
| M103 | Semiconductor parameter analyzers |
| M104 | Precision LCR/impedance meters |
| M105 | Lock-in amplifiers |
| M106 | Time-correlated single-photon counting electronics |
| M107 | Optical microscopy/spectroscopy cryostats |
| M108 | Infrared microscopy accessories/stations |

Nicolet 8700 joins M36. New classes currently have one or two source-supported records; ten verified models per class are not claimed. Ten equipment records have checked images. Setup photos do not establish every component's model; current manufacturer photos do not depict UCLA's individual assets. Historical Agilent labels and Keysight support sources remain distinct. Related-family/unchecked manuals retain their limitations.

**P46** is plasma-assisted MBE of III-nitride layers; **P47** is MBE of III-arsenide/antimonide nanostructures. Each has three conceptual integrated-system stages and three optional characterization branches that depend on recovery independently. M100 slots enforce nitride versus arsenide/antimonide subtype. Reusing a selected system fills compatible vacant stages. P23/P44 also gain explicitly optional curator PL/lifetime exploration after their source synthesis stages.

**15 UCLA material contexts** cover sources, optional dopants, project-specific substrates and optional characterization cryogens. No commercial grade, price or dosage is invented. Nitrogen gas, liquid nitrogen, silicon dopant and silicon wafer remain distinct. Source-cell lists describe capabilities, not a simultaneous mixture recipe.

These are **capability plans**. Hardware maxima and measurement ranges are not growth setpoints. Substrate orientation, source purity, conditions, thickness, yield and properties remain unreported. The 2022 facility pages do not establish current access. No current equipment prices were verified; the historical/undated SR830 $5,995 reference stays in the review and is excluded from current prices and estimate anchors.

## Use, evidence and reproduction

In **Processes**, choose P46/P47 and **Choose materials** to select individual sources/dopants/substrates. Existing routes such as P29 offer reviewed commercial grades alongside source materials; a compatible absolute amount enables pack-price proration. Unreported amounts stay unpriced. The first tab's market table includes imagery and expandable process relevance.

- [market_components.csv](../catalog/market_components.csv): 32 reviewed options with scoped P links, role, stable material/line IDs, source, cost scope and eligible pack IDs. Separate from literature formulations.
- [component_offers.csv](../catalog/component_offers.csv): exact seller/SKU/grade/form/pack prices and image attribution.
- [UCLA review](../catalog/ucla_inml_review_2026-10-18.json): models, configurations, documents, image checks, unresolved items and integration IDs.
- [Catalog source evidence](../catalog/catalog_source_evidence.json) and [price evidence](../catalog/purchase_price_evidence.json): 33 new catalog/context claims and 38 price claims, also in the readable [evidence register](evidence-register.md).

All added equipment was compared with the designated Purdue list; no exact matches were found. Private inventory, serials, user plans and source PDFs remain excluded. The academic library is unchanged: vendor/facility pages are not academic articles, and UCLA's publication index remains a discovery source pending individual-paper review.

~~~
python catalog_tools.py
python scripts/build_app_data.py
python ontology_tools.py --check
python -m pytest -q
~~~

Checks preserve market identity/process scope, dispersion versus dry mass, source eligibility, MBE subtype restrictions, parallel dependencies and saved material references. New models receive empty position/fiber/direction templates pending exact-model manual evidence.
