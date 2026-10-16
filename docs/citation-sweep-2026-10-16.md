# Manufacturing equipment found through cited literature

The 2026-10-16 review started with the **10 articles dated 2024-2026 in the original academic library** and followed manufacturing-related citations, including supporting-information citations. It added **12 equipment records**, enriched **two existing model records**, created **nine process routes with 36 conceptual steps**, and added **11 reference records representing ten studies**. The library now contains 28 reference records; the equipment table contains 644 records.

This was a targeted review of relevant cited methods, not an exhaustive full-text review of every reference in all ten bibliographies. Databases, computer graphics, bulk-alloy results without a demonstrated nanoscale manufacturing use, and characterization-only instruments were excluded. Inaccessible methods and deferred candidates are recorded in the [machine-readable audit](../catalog/citation_sweep_2026-10-16.json). Their equipment identities were not guessed.

## Added equipment

| Record | Reported instrument / apparatus | Evidence and limits |
| --- | --- | --- |
| LIT-M05-ELLIS2018 | Parr PTFE-lined hydrothermal vessel | [Ellis 2018](https://doi.org/10.1098/rsos.171884), section 2.4.2; model/capacity unreported |
| LIT-M26-SCAFFARO2022 | Wet electrospinning setup with stirred collector | [Scaffaro 2022](https://doi.org/10.1016/j.compscitech.2022.109363), section 2.1; custom apparatus |
| LIT-M26-SCAFFARO2024 | Linari horizontal electrospinning apparatus | [Scaffaro 2024](https://doi.org/10.1007/s42114-023-00827-w), section 2.1; model unreported, not assigned to RT Advanced |
| LIT-M60-LI2022 | Manual SCIL imprint station | [Li 2022](https://doi.org/10.1063/5.0100657), article p.182407-2 / Figure 1; custom apparatus |
| LIT-M61-LI2022 | Argon ion-beam milling apparatus | Same study; manufacturer/model unreported, physical milling distinguished from RIE |
| LIT-M09-SUN2025 | Fisherbrand Model 505 Sonic Dismembrator | [Sun 2025](https://doi.org/10.1038/s41598-024-82728-6), PLGA synthesis methods; probe configuration unreported; study includes micro- and nanoparticles |
| LIT-M07-YOO2023 | Tecan Cavro Centris | [Yoo 2023 preprint](https://arxiv.org/abs/2309.00349), SI Figure S2c-1; 5 mL syringes / 3-port valves |
| LIT-M62-YOO2023-RG2 | OnRobot RG2 | Same preprint, SI Figure S1; gripper accessory, not a complete robot |
| LIT-M56-HARRIS2024 | Coherent LPX 305F | [Harris 2024](https://doi.org/10.1002/smtd.202301763), accepted manuscript Methods p.23; laser component |
| LIT-M48-HARRIS2024 | ORNL Auto-PLD platform | Same study; custom deposition assembly containing the laser above |
| LIT-M21-RAO2021 | ARES laser-induced cold-wall CVD system | [Rao 2021](https://doi.org/10.1038/s41524-021-00629-y), Methods; custom system using laser heating during CNT synthesis |
| LIT-M08-MEKKI2021 | Droplet-based silver nanoparticle synthesis assembly | [Mekki-Berrada 2021](https://doi.org/10.1038/s41524-021-00520-w), Methods: Experimental design; custom assembly, pump models unspecified |

Four records identify commercial models/components; two identify a manufacturer with no model; five describe custom apparatus; one leaves both manufacturer and model unspecified. These records supplement the original ten examples per source M category. They do not replace those examples or introduce Purdue inventory claims.

The existing **M02-05 / IKA RET control-visc** and **REQ-EQ-020 / Doosan M0609** gain model-level evidence for robotic silver nanoparticle synthesis. That separate Korean study does not identify any Purdue unit, serial number or installed configuration. Account-specific field edits remain protected when shared seed associations are refreshed.

## Processes

| Route | Added conceptual process | Materials |
| --- | --- | --- |
| P15 | Hydrothermal synthesis of doped metal-oxide nanoparticles | N02 |
| P16 | Wet electrospinning with nanocarbon self-assembly | N05, N07, N08 |
| P17 | Double-emulsion / solvent-evaporation particle synthesis | N05 |
| P18 | Robot-assisted aqueous silver nanoparticle synthesis | N01 |
| P19 | Pulsed laser deposition of ultrathin films | N09 |
| P20 | Electrospinning of nanocarbon-loaded polymer mats | N05, N07, N08 |
| P21 | Laser-induced cold-wall CVD of carbon nanotubes | N07 |
| P22 | Droplet-based microfluidic silver nanoparticle synthesis | N01 |
| P23 | Antisolvent reprecipitation of perovskite nanoplatelets | N04 |

The existing P06 lithography route gains SCIL and ion-milling apparatus; P09 self-assembly gains the wet electrospinning assembly. Additional scoped article claims support P13 wet etching and P14 reactive-ion etching. Those claims describe the cited study, not every instrument sharing the category.

Route steps omit operating settings. Concurrent dosing/stirring and instrument components are explained in source-sequence notes. A class match is a planning suggestion; it does not prove a commercial substitute is compatible. Where the source does not identify an apparatus type (for example its drying oven), the step retains that gap instead of assigning an unsupported vacuum oven or rotary evaporator. Users can add a reviewed equipment slot. Reusing a physical instrument across stages should be reviewed before interpreting a slot-based budget.

P23 is supported by [Lampe 2022](https://arxiv.org/abs/2210.09783), preprint section 4.1. Its stirring and centrifugation devices remain unnamed. Future microfluidic automation discussed there is not treated as implemented equipment. P22 instead describes an implemented droplet assembly; these processes remain distinct.

## Citation and version provenance

All additions carry stable reference IDs, passage locators, review dates and scoped claim links in `reference_links.csv`. The audit records each starting article and the cited reference number/name that led to a study. Bibliography exports remain chronological and reproduce offline with `reference_tools.py build`.

[Yoo 2024's published article](https://doi.org/10.1002/adfm.202312561) and its cited 2023 preprint remain separate reference records for **one study**. The final main text was reviewed, but the final publisher supplement was inaccessible. Exact hardware claims therefore point to the checked preprint supplement; they are not silently attributed to the published supplement.

Li's article number is **182407**, confirmed by the publisher PDF and registry; an incorrect repository cover-sheet number is noted. Harris locators refer to the OSTI accepted manuscript. Rao's Results and Methods differ on the catalyst sputtering technique; the P21 source note retains that discrepancy.

No current availability, successor model or exact MSRP was inferred from an old article. New lifecycle rows explicitly leave successor status unresolved. Existing class-equivalent price estimates, when displayed, remain asterisked estimates. PDFs and extracted full text stay local; public Git contains curated facts, metadata and source links.
