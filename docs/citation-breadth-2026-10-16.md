# Process and evidence breadth review

This second, targeted pass follows references from the original 2024–2026 literature. It accepts both previously missing manufacturing routes and additional evidence for existing processes or equipment. It adds **14 studies/reference records, 12 manufacturing routes with 52 conceptual steps, 14 apparatus profiles, two existing-model enrichments and 70 checked claim links**. There are now **42 reference records representing 41 studies**, 658 equipment/category records and 561 equipment cards.

The [50-record review ledger](../catalog/citation_review_2026-10-16-breadth.csv) distinguishes methods review, title/abstract screening, deferred access, bibliographic conflicts and an integrity hold. Fifty candidate records do **not** mean fifty full texts were reviewed. The fourteen incorporated studies have checked methods; other entries have the depth stated in the ledger. The [full audit](../catalog/citation_breadth_2026-10-16.json) retains each parent citation, source version, passage locator and limitations. **The complete bibliographies have not been exhaustively reviewed.** The [initial review](citation-sweep-2026-10-16.md) remains a separate historical record.

## New routes and supporting studies

| Route | Process | Checked source and boundary |
| --- | --- | --- |
| P24 | Continuous-flow T-junction silver nanoparticle synthesis | [Nathanael 2023 preprint](https://arxiv.org/abs/2303.10469), section 2.1, PDF pp.6–7; single-phase flow, distinct from P22 droplets |
| P25 | Solution-phase intermetallic nanocubes and carbon-support loading | [Gao 2022](https://doi.org/10.1038/s41467-022-29926-w), Methods, PDF p.9; CuPd cubes approximately 50 nm; centrifugation/vacuum drying identified, stirring/sonication types unresolved |
| P26 | Robot-assisted thermal CVD of aligned nanotube arrays | [Li 2024 preprint](https://arxiv.org/abs/2404.01006), Methods, PDF pp.27–32; distinct from P21 laser-heated CVD |
| P27 | Microfluidic polymer nanoprecipitation | [Ortiz-Perez 2024](https://doi.org/10.1039/d4dd00104d), formulation methods; PLGA-PEG self-assembly, distinct from double emulsion |
| P28 | In-situ polymer–clay polycondensation | [Ferreira 2014](https://doi.org/10.1590/0104-1428.1662), Experimental, journal p.605; clay lamellae are nanoscale, whole polymer product is a composite |
| P29 | Nanofiller/polymer film solution casting | [Xu 2013](https://doi.org/10.1021/am302624t), Methods, journal p.3000; cellulose nanofillers in polymer, not isolated polymer nanoparticles |
| P30 | Dialysis-induced lignin particle self-assembly | [Tian 2017](https://doi.org/10.1186/s13068-017-0876-z), Experimental, PDF pp.8–9; particles approximately 195–197 nm with a reported 10–20 nm core-shell feature, not uniformly sub-100 nm particles |
| P31 | Sol–gel transformation of nanofiber composite paper | [Tang, volume 2024](https://doi.org/10.1007/s40820-023-01257-5), sections 2.1–2.2, PDF pp.3–4; PBO fibers 10–40 nm, not proof of a nanoimprint press |
| P32 | Solvothermal growth of oxide/graphene nanocomposites | [Nason, volume 2024](https://doi.org/10.1007/s40820-023-01222-2), section 2.1, PDF p.3; Parr vessel brand known, model unreported; drying/furnace geometry unresolved |
| P33 | pH-stat controlled magnetite coprecipitation | [Reichel 2017](https://doi.org/10.1038/srep45484), Methods, PDF p.5; aqueous precipitation, not hydrothermal; approximately 40 nm mesoparticles |
| P34 | Oxidative exfoliation of graphite to GO | [Martinez 2020](https://doi.org/10.3390/nano10101936), section 2.2; single-layer GO below 1.5 nm thickness, lateral sizes can exceed 100 nm |
| P35 | Rotary swaging and induction flash annealing | [Fan 2025](https://doi.org/10.1038/s43246-025-00736-z), Materials fabrication, PDF p.6; nanosized Al2Ca precipitates embedded in bulk Mg alloy, not free nanoparticles or nanograins |

These sequences omit operating settings. Unreported equipment stages remain explicitly unresolved. Models sharing a category are planning candidates, not experimentally validated substitutes. Repeated use of one assembly across stages must not be counted as several physical machines when budgeting.

## Additional support without duplicating models

- **M11-04 / IKA T 25 digital** gains exact-model evidence from Xu for nanocellulose/polymer film preparation.
- **M07-09 / Chemyx Fusion 200** gains exact-model evidence from Ortiz-Perez for aqueous antisolvent delivery. The paper describes manual pump operation in its setup.
- **P01 / M54** gains an independent arc-source condensation citation from [Kleibert 2017](https://doi.org/10.1103/PhysRevB.95.195404), Experimental Details, PDF pp.2–3. No commercial source model is inferred.
- **M05 / M15 and N02** gain [Pellegrino 2020](https://doi.org/10.1038/s41598-020-75967-w), Methods: filtered precursor and lined autoclave for TiO2. This undoped study is not assigned to the doped P15 protocol.
- **P08** gains BN functionalization and GO albumin-coating evidence; **P09** gains dialysis self-assembly and polymer nanoprecipitation evidence; **P11** gains a nitrogen-calcination citation. Claims retain their actual stages and materials.

The checked model-use papers also supplement IKA’s previous owner confirmation and Chemyx’s previously supplier-only research-use status. Chemyx now meets the existing official-identity plus independent-use rule for its green star; this is not a claim of quantified adoption.

Instrument cards now show checked **equipment-category evidence separately** from direct-model claims. Category citations never grant a model-specific validation badge or claim.

## Apparatus and taxonomy

New profiles include AL-4000, Micro-STS1200, MG400, LSPOne in the stated 10-port/250 microlitre configuration, Emitech K1050X, 805 Dosimat, Thermomixer C and SPG-20; two custom microfluidic devices; a pH-stat assembly; a passive dialysis arrangement; an unresolved-capacity CPXH bath; and an unnamed four-die swager. Emitech is used for support-chip fabrication, not direct nanoparticle synthesis. Thermomixer C and CPXH apply to albumin coating, not initial GO oxidation.

Four classes prevent misleading substitutions: **M63 automatic titration/piston dosing, M64 rotary swaging, M65 induction heating/rapid annealing and M66 dialysis solvent exchange**. These are literature-driven starting examples, not ten researched commercial alternatives per new class. The original 59 source classes retain all 590 core examples. **N10 / Nanocomposites** groups nanoscale phases or reinforcement inside matrices, keeping polymer/clay films and nanoprecipitate-strengthened bulk alloy distinct from isolated polymer or metal nanoparticles. N10 is a material grouping, without a universal process sequence; choose a specific P route to plan fabrication.

Unknown oven geometries do not acquire M18/M20 claims. Dialysis is distinguished from pressure filtration. The upstream Masuko friction grinder mentioned by Xu remains a citation-mediated research lead rather than a verified planetary ball mill. Ion implantation and process-monitoring imagers remain separate gaps. The Eppendorf 5430R in Martinez section 2.6 is post-adsorption separation; its identity is not transferred to unnamed manufacturing centrifuges.

The source prints “Methrom Titrino 888,” while Metrohm's corresponding named 888 product is Titrando. The pH-stat assembly retains this unresolved controller identity; the paper does not validate an exact 888 Titrando record. Its separately named 805 Dosimat has a linked official model manual. New brands reported only by papers remain unstarred pending independent web-identity checks. New components/classes without properly scoped price evidence remain explicitly unpriced.

## Access, dates and integrity

Nathanael and Li exact hardware claims point to inspected arXiv versions. Nathanael's later journal DOI is documented, but its inaccessible final methods are not silently substituted for the preprint. Pellegrino and Martinez use complete published XML; Ortiz-Perez uses checked publisher full text available through the search cache. Those are labeled full-text checks, not local PDF checks. Eleven new PDF copy records bring local provenance to 36 copies. PDFs and extracted full text stay local.

Tang and Nason belong to cited 2024 volumes but were published online in November 2023. Both facts are retained in the reference metadata/notes. Ferreira's PDF polymer abbreviation PBS is retained instead of the registry's PDS typo. Peer review, current product availability, exact MSRP and Purdue inventory identities are not inferred from registry matches or old articles.

Two Mim 2025 bibliography entries have DOI/title conflicts (references 165 and 168); four other DOI identities remain unresolved. Gomes Souza reference 16 is held because of the publisher's [Expression of Concern](https://doi.org/10.1039/d4ra90062f). No manufacturing claims are imported from those entries. Deferred sources and checked reserves remain visible for future work.

Regenerate the database and bibliography offline with `python catalog_tools.py` and `python scripts/build_app_data.py`. Canonical CSVs, claim links, the review ledger, exported bibliographies and generated app seeds are committed together. Account-specific field edits and explicit clears stay protected during seed refreshes.

Validation: 45 Python tests and 92 app tests pass, TypeScript and production build pass, and browser checks confirm the new library filter, scoped instrument evidence and distinct process slots. The 44 private inventory entries remain outside public Git.
