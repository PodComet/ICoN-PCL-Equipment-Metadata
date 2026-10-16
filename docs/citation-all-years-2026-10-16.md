# Cited-reference expansion, 16 October 2026

Starting papers are the local academic articles published **after 2024: 2025–2026**. The papers they cite have **no year cutoff**. Publication dates were checked from the article and registry, rather than inferred from filenames. Older work imported in previous reviews remains in the database.

This pass adds **8 apparatus/model profiles, 7 manufacturing processes, 3 equipment classes and 10 academic references**: nine primary studies from **2017–2023**, plus one 2024 review used as a discovery bridge. Two existing equipment profiles receive additional evidence. The shared catalog grows from **561 cards / 658 records to 569 cards / 666 records**; private saved additions are counted separately by the app.

| Source | Discovery chain | Addition |
| --- | --- | --- |
| Gomes, 2021, [DOI](https://doi.org/10.1039/d1nr03231c) | Mim 2025, ref. 11 → primary study | Flame-spray assembly and glass collection filter; P36 flame-spray pyrolysis |
| Yao, 2022, [DOI](https://doi.org/10.1039/d2nr03712b) | Mim 2025, ref. 49 → primary study | Additional P08/P09 process evidence; no hardware identity inferred |
| del Bosque, 2023, [DOI](https://doi.org/10.1016/j.polymdegradstab.2023.110278) | del Bosque 2026, ref. 6 → primary study | EXAKT 80E, M67 three-roll mills, P37 nanocarbon/PDMS processing |
| Sánchez-Romate, 2023, [DOI](https://doi.org/10.1021/acsami.2c22162) | del Bosque 2026, ref. 13 → primary study | Additional three-roll process evidence; existing PGSTAT302N characterization citation |
| Malkiel, 2018, [DOI](https://doi.org/10.1038/s41377-018-0060-7) | del Bosque 2026, ref. 42 → primary study | RAITH150, VST evaporator with unknown model, M68 electron-beam evaporation, P42 fabrication sequence |
| Kusne, 2020, [DOI](https://doi.org/10.1038/s41467-020-19597-w) | del Bosque 2026, ref. 51 → primary study | P38 co-sputtered phase-change films and independent class evidence |
| Awan, 2018, [DOI](https://doi.org/10.1021/acsomega.8b01881) | nanoPharos 2026 → Papadiamantis 2024 review, ref. 15 → primary study | P39 hydrothermal ZnO/cellulose nanohybrids; no exact apparatus inferred |
| Hassan, 2017, [DOI](https://doi.org/10.1021/acsomega.7b00759) | nanoPharos 2026 → Papadiamantis 2024 review, ref. 55 → primary study | Liquifog and custom cold-wall reactor; P40 aerosol-assisted CVD |
| Bai, 2019, [DOI](https://doi.org/10.1016/j.wear.2019.202944) | nanoPharos 2026 → Papadiamantis 2024 review, ref. 93 → primary study | Existing RETSCH PM100 evidence; FCT HP D1050, M69 spark-plasma sintering, P41 nanocarbon coating/consolidation |

The three second-hop studies are explicitly distinguished from direct citations of the folder papers. The [2024 bridge review](https://doi.org/10.1016/j.csbj.2024.10.020) is recorded as bibliography context, rather than primary apparatus evidence.

## Review coverage

The [parent/citation inventory](../catalog/cited_reference_inventory_2026-10-16.csv) retains **630 publisher-deposited bibliography entries** from five relevant starting papers: Mim (384), del Bosque (65), nanoPharos (64), NEMAD (68) and Semantic Intelligence in Metallurgy (49). These are citation edges and can repeat the same paper. They are neither 630 unique studies nor 630 full-text reviews. Cited years and DOI strings remain as deposited, including blank dates and unresolved identifiers.

The [candidate decision ledger](../catalog/citation_review_2026-10-16-all-years.csv) contains **99 decisions** at their actual review depth. Within the 630-entry direct-citation inventory, **87 entries have review activity and 543 remain pending**. Review activity includes title screening and access checks; only the nine primary studies above received new full-text methods review. Existing library membership is tracked separately and does not automatically count as methods review for this citation chain.

Seven local original papers qualify by year. The library/information-science topic-modeling paper and ZipTok3D received parent-scope screening; their cited papers were not ingested into this manufacturing queue, and no complete citation-level review is claimed for them. The [machine-readable audit](../catalog/citation_all_years_2026-10-16.json) records all seven parents and their scope decisions.

## Evidence limits

- The parent misdates Sánchez-Romate as 2022; the verified paper is 2023. Its printed mini-calender name, “EKATK 80,” remains unresolved and does not independently establish EXAKT 80E.
- EXAKT 80E is retained as reported; 80E PLUS documents or images are not silently substituted.
- Kusne's autonomous system selects characterization measurements; autonomous synthesis is not asserted.
- Bai's manufacturing relevance includes carbon clusters below 100 nm before consolidation; the final TiC reinforcement is submicron, not uniformly below 100 nm. The inspected version is an accepted manuscript.
- Unreported hardware remains class-level or explicitly unknown. Historical/custom apparatus receives no guessed photo, manual, current-availability status or price.
- Exact-model, equipment-class, process and background citations remain separate. PGSTAT302N evidence concerns characterization, with no added manufacturing-route association.
- Original PDFs and full-text caches remain local. Public Git contains curated bibliographic data, source locators, scoped paraphrases and review decisions.

## Processes tab

The instrument library follows the equipment classes in the selected process's **current steps**. It initially shows instruments across those steps; selecting a slot narrows the list. “Show all process instruments” restores the process-wide list. A route tag by itself cannot admit an unrelated class. Added classified slots expand the plan's eligible classes; an unclassified slot uses the other classified steps, and a wholly unclassified plan shows an empty state until classes are selected. These are planning candidates requiring model/configuration compatibility review.
