# Labmate catalog review — 19 October 2026

The [Labmate catalog index](https://www.labmate.com/catalogs) contains 317 unique top-level category links. This was a focused review of selected nanomaterial-relevant equipment and 12 supplies/category pages, not a check of every product in all 317 categories. No Labmate make/model records existed in the starting ontology. The review therefore adds distinct **Labmate-branded market alternatives**, rather than transferring their photos or prices to another manufacturer.

## Eight models in seven existing M classes

| Model | Class | Published USD per unit | Technical catalog |
| --- | --- | ---: | --- |
| LMPT-303 potentiometric titrator | M63 | $8,812.50 | [Catalog](https://www.labmate.com/catalog/potentiometric-titrator/lmpt-303) |
| LMPT-304 potentiometric titrator | M63 | $13,250.00 | [Catalog](https://www.labmate.com/catalog/potentiometric-titrator/lmpt-304) |
| LMAMP-A100 automatic mortar and pestle | M81 | $3,700.00 | [Catalog](https://www.labmate.com/catalog/automatic-mortar-and-pestle/lmamp-a100) |
| LMHYR-A104 hydrothermal reactor, 50 mL | M05 | $1,175.00 | [Catalog](https://www.labmate.com/catalog/hydrothermal-reactor/lmhyr-a104) |
| LMJGR-A100 jacketed glass reactor, 0.5 L | M04 | $3,500.00 | [Catalog](https://www.labmate.com/catalog/jacketed-glass-reactor/lmjgr-a100) |
| LMUH-A102 ultrasonic homogenizer | M09 | $3,462.50 | [Catalog](https://www.labmate.com/catalog/ultrasonic-homogenizer/lmuh-a102) |
| LMVO-A501 vacuum oven, 50 L | M18 | $3,087.50 | [Catalog](https://www.labmate.com/catalog/vacuum-oven/lmvo-a501) |
| LMPBM-A100 planetary ball mill, supplier SKU A100 | M12 | $3,512.50 | [Catalog](https://www.labmate.com/catalog/planetary-ball-mill/a100) |

All eight have visually reviewed model-specific photo references and checked technical catalog links. No exact operating manual was verified; the app uses the technical specification fallback. The two LMPT models share one family card with separate variant chips, images, specifications and prices. This creates seven new cards, with no implied successor relationship.

Public model-specific pricing rows were checked separately from the site's repeated accessory panel. Dollar amounts are interpreted as USD using the supplier's [published payment terms](https://www.labmate.com/privacy-policy), which specify US dollars unless otherwise stated. These are supplier-published prices, **not MSRP or confirmed official list-price benchmarks**. Stock, lead time, accessory bundles, shipping, fees and tax are not established. Several catalogs specify 220 V/50 Hz; the price does not establish a US electrical configuration.

## Scientific and identity limits

M/P/N links are curator functional planning associations, not proof that these models were used in a cited study or experimentally validated for the process. In particular, P33 pH-stat feedback control and reagent compatibility must be checked for the titrators. Hardware ratings are not operating recipes or safe simultaneous setpoints.

The supplier has an own-brand commercial website. Independent confirmation of its manufacturing entity, longevity and common academic adoption remains pending, so **no green star is granted**. International Labmate publishing and CEM Discover LabMate references are not evidence for this supplier. No new models exactly match the designated Purdue roster; all retain `purdue_list=false`.

Inconsistent source units were withheld rather than corrected by guesswork: a mortar dimension stated in nm and a vacuum-pump pressure with questionable units. No flash-Joule apparatus was forced into induction-heating or SPS classes; bead mills and doctor-blade applicators were not assigned to incompatible existing categories.

## Materials and reproducibility

No exact existing ingredient or consumable offers/photos were added. The closest microscope slides are 25.4 × 76.2 mm, rather than the specified 25 × 75 mm, and their source page conflicts between 9,000 and 2,500 pieces. General centrifuge tubes and cell strainers do not fill reagent, PVDF membrane or particle-collection-filter gaps.

The [machine-readable audit](../catalog/labmate_catalog_review_2026-10-19.json) preserves exact supplier SKUs, class links, prices, photo checks, exclusions, Purdue review and semantic baseline hashes. **25 new source claims** are in the [Evidence register](evidence-register.md). Images are remotely linked with source rights retained. Raw supplier pages, images and PDFs are not redistributed; no private quote or NDA price list was requested.

All prior equipment rows, ingredient offers, recipe eligibility, process steps and private inventory are preserved. The catalog now has **1,121 model records, 957 family cards and 114 active M classes**. Regenerate with `python catalog_tools.py`, `python scripts/build_app_data.py` and `python scripts/build_usd_prices.py`.
