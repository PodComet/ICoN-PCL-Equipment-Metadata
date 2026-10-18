# Input scales, output quantities and component prices

Input amounts have source-aware metric scale selectors. Changing 200 mg to g preserves the physical amount (0.2 g); mass and volume cannot be interconverted without a separate density model. Original reported text remains visible. Concentrations and flow rates do not silently become batch doses.

The output card uses the selected process title. Material identity, quantity assessment and evidence ID remain separate. Four initial source-bound quantity models are stored in [output_quantity_models.json](../catalog/output_quantity_models.json): P03 carrier volume, P07 graphite mass, P17 PLGA-plus-drug core solids and P30 lignin mass. These are nominal volume or theoretical retention ceilings, **not measured product yields**. Mass recovery can be entered as an explicit user assumption and saved with the workflow. Quantities recalculate from compatible selected input amounts and use metric display units. Other routes remain unknown until a reviewed quantity model exists. Mismatched identities, rates, concentrations and missing quantities return no estimate. Instrument positions/fibers/directions do not yet infer conversion or recovery.

The equipment directory includes a searchable material/component table at its bottom. It shows latest verified pack quotes by seller/SKU/grade/form/amount, USD equivalents, comparison units, source and checked date. Different grades and pack sizes are retained. Pack quotes are distinct from prorated process consumption costs.

A local chat automation refreshes source-linked public component prices weekly on Monday at 09:00 in the user's configured local timezone. It retains dated prior quotes when a new value cannot be verified, records source gaps and meaningful changes, validates regenerated data, and publishes with the existing audience and inventory exclusions. Running the scheduled refresh requires the desktop automation host and connected tools to be available.


## Process links and pack expansion (2026-10-18)

The **Processes** column and P-category filter derive relevance from the canonical sourced formulation components, including reviewed offer aliases. Each P-code expands to the formulation role, scope and original method link. Searching also matches process codes and names. Different grades, forms and pack sizes remain separate; a shared material name or CAS number does not create a link. This association does not alter `eligible_offer_ids_json` or approve a purchase-grade substitution.

This update adds **21 new USD pack quotes for eight previously unquoted component identities**: cesium carbonate, 1-octadecene, titanium(IV) isopropoxide, titanium(IV) butoxide, oleic acid, tri-n-octylphosphine, L-cysteine and the Vybrant V22889 kit containing DiD. These extend price coverage of P05, P15, P27, P28, P44 and P45 using already cataloged academic methods. The P44 method is available from the ETH Zurich deMello Group [supporting information](https://www.demellogroup.ethz.ch/_files/ugd/43643b_8e327a49836c4ac2b66b7ab7c001eb9a.pdf), recorded as REF-0049CBFB6C6F. The cited method establishes formulation context; supplier pages establish present pack identity and price. No institution's current inventory, procurement endorsement or global laboratory ranking is inferred.

Primary supplier sources checked 2026-10-18:

| Component | Source | Pack quotes (USD) |
| --- | --- | --- |
| Cesium carbonate | [TCI C2160](https://www.tcichemicals.com/US/en/p/C2160) | 25 g $67; 100 g $162 |
| 1-Octadecene | [TCI O0008](https://www.tcichemicals.com/US/en/p/O0008) | 25 mL $17; 500 mL $48 |
| Titanium(IV) isopropoxide | [TCI T0133](https://www.tcichemicals.com/US/en/p/T0133) | 25 g $17; 500 g $49 |
| Titanium(IV) isopropoxide | [Santa Cruz sc-253704](https://www.scbt.com/p/titanium-iv-isopropoxide-546-68-9) | 100 g $47; 2 kg $188 |
| Titanium(IV) butoxide | [TCI B0742](https://www.tcichemicals.com/US/en/p/B0742) | 25 g $20; 100 g $37; 500 g $52 |
| Oleic acid | [TCI O0180](https://www.tcichemicals.com/US/en/p/O0180) | 5 mL $48; 25 mL $174 |
| Tri-n-octylphosphine | [TCI T0503](https://www.tcichemicals.com/US/en/p/T0503) | 25 mL $45; 100 mL $126; 500 mL $375 |
| L-Cysteine | [Sigma C7352](https://www.sigmaaldrich.com/US/en/product/sigma/c7352) | 10 mg $32.50; 25 g $78.50; 100 g $175; 1 kg $813 |
| Vybrant multicolor kit | [Fisher/Invitrogen V22889](https://www.fishersci.com/shop/products/molecular-probes-vybrant-multicolor-cell-labeling-kit/V22889) | 1 kit $462 |

The V22889 quote is for the complete kit, containing 1 mL each of DiO, DiI and DiD. It is **not** a 1 mL DiD price; no kit-cost allocation is inferred. New offers remain reference-only until exact formulation grade/form and consumed amount have been checked. Source doses and process budgets are unchanged. Read each row's price/compatibility notes for scope. Internally prepared intermediates and ambiguous source compositions remain unpriced.
