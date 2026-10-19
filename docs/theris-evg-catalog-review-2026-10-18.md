# Theris and EV Group catalogue review — 18 October 2026

Both companies receive owner-confirmed green stars. The official Theris pages identify a UK-based instrumentation manufacturer; EV Group's About and Imprint pages identify its Austrian headquarters and a history beginning in 1980. The star does not imply independent academic-adoption evidence, model compatibility, ownership or current availability.

## What changed

| Review | Existing entries reviewed | New named products/models | New model/configuration records | Newly pictured records | New numeric prices |
| --- | ---: | ---: | ---: | ---: | ---: |
| Theris | 3 | 8 | 8 | 7 | 0 |
| EV Group | 7 | 10 | 12 | 15, including 3 existing entries | 0 |

The resulting committed catalog contains 1,113 model/category records presented as 950 family cards, 114 active M classes, six retained X classes, 46 P routes and 263 ordered steps. The academic library remains at 76 references. Forty-six new readable evidence records bring the public register to 568 claims.

### Theris

The existing NanoStream S/T/V sources now have matched product pages, technical brochure links and corrected process descriptions. Their existing variant-specific illustrations remain scoped as renders or section drawings.

New products are NanoShell, MSF, TAS30, TAS60, the TAS RFI/TASRI ion-source series, SH300, NC400 and SMPL MH4i. TAS30/TAS60 and SH300/NC400 use variant families. The review preserves the difference between sources, accessories and full deposition systems.

| Class | Capability |
| --- | --- |
| M109 | Nanoparticle beam mass filters |
| M110 | RF atom sources for vacuum deposition |
| M111 | Broad-beam RF ion sources |
| M112 | UHV substrate stages and manipulators |
| M116 | Gas-phase nanoparticle core-shell coaters |

NanoShell cannot fill a complete M23 sputter-coater or M54 nanoparticle-generator slot. Neutral atom sources cannot replace complete M100 MBE systems. The SH300 image has a readable model label. Ion-source and SMPL photographs have family/detail scope; other adopted images are manufacturer renders. No exact NC400 standalone image was established.

The ion-source and sample-stage pages link an RF **atom** brochure. That document is excluded from their matched documentation. The general NanoStream brochure includes NanoShell, MSF and the named full systems; it is not an operating manual. Korvus HEXL is labeled as a third-party system and is not imported as a Theris-manufactured product.

Sources: [Theris product range](https://therisnano.com/products/), [Theris review ledger](../catalog/theris_review_2026-10-18.json).

### EV Group

The seven existing entries receive reviewed links and configuration notes. EVG610, EVG6200 NT and EVG7200 gain previously missing images. EVG6200's unresolved label is corrected to the documented **EVG6200 NT** using its stable equipment ID. EVG7300's duplicated brand prefix is removed. These corrections do not assert successor relationships.

Ten new named models are EVG101, EVG120, EVG150, EVG720, EVG7200 LA, HERCULES NIL, EVG770 NT, LITHOSCALE, EVG40 NT and EVG50. EVG150 and HERCULES NIL each retain separate 200 mm and 300 mm configuration records, with their own images and flyers. Standard EVG7200 and EVG7200 LA use one family with distinct configuration chips. The EVG620 NT mask-alignment and SmartNIL configurations share a platform family while retaining their process-specific limits.

| Class | Capability |
| --- | --- |
| M113 | Maskless optical lithography |
| M114 | Wafer overlay and film-thickness metrology |
| M115 | Wafer resist coating and development systems |

M115 keeps enclosed, multifunction processing platforms separate from bare M24 bench spinners and their price anchors. P06 has explicit maskless exposure, configured coating/bake and development alternatives, plus optional wafer metrology. P42 has configured coating/development alternatives. These are curator planning choices, not apparatus reported in the original articles or validated substitutions. EVG101 does not qualify for the combined coating/bake branch. LITHOSCALE's micrometre-scale feature capability does not establish nanoscale lateral resolution. EVG50's thickness measurements do not imply overlay capability or replace required SEM/AFM inspection.

EVG520 HE remains distributor-supported. No matched current official HE image or manual was established, and EVG520 IS is not substituted for it. Further bonding, maskless and metrology products are recorded as remaining survey gaps in the review ledger. Seventeen linked EVG brochures/flyers were verified as public PDFs; they remain distinct from operating manuals.

Sources: [EV Group products](https://www.evgroup.com/products), [company history](https://www.evgroup.com/company/about-evg), [EVG review ledger](../catalog/evg_review_2026-10-18.json).

## Prices, provenance and limits

No public numeric model prices were found in the reviewed pages/documents. Missing prices remain missing, with dated review status; no model price or MSRP benchmark was invented. Existing project estimates remain governed by the documented price policy.

Every new entry retains product/document/image source URLs, scope, a stable equipment ID and public evidence IDs. Original images/PDFs are not redistributed; linked manufacturer assets retain their attribution and rights. Empty model-bound position/fiber/direction templates are available for future manual extraction. Hardware limits are not converted into process setpoints or fabricated control interfaces.

All additions were compared with the supplied Purdue make/model list. No exact matches were found. Generic descriptions such as PVD do not establish asset identity, so no new Purdue flags or serials were inferred.

Reproduce the public views with `python catalog_tools.py`, `python scripts/build_app_data.py` and `python scripts/build_usd_prices.py`. The JSON ledgers preserve before/after equipment, family, lifecycle and process-requirement changes alongside earlier dated review snapshots.
