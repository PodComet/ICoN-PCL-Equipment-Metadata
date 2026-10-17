# Components, formulations and process pricing

Reviewed 17 October 2026. The database has 41 literature-scoped formulation examples and an explicit not-applicable record for the P43 thermocycler control demonstration. Its 248 component occurrences retain the source role, batch basis, dose/concentration, source locator and omissions. They include production ingredients, solvents, gases, washes and supporting materials where reported in the reviewed method. These are representative examples for broad process classes, not an exhaustive set of recipes or universal operating procedures.

In **Processes**, choose **Choose materials**, select a **Documented formulation**, then **Use formulation & amounts**. Replacing existing inputs is an explicit button action. Materials and amounts remain editable; changes are labelled as modifications to the source example. Custom materials and free-text amounts remain supported. Save the workflow to preserve inputs and a dated budget snapshot; JSON exports contain the full price basis.

## Reproducible CSV data

- `catalog/component_formulations.csv`: one example per P class, batch/scale, output label, source and academic reference IDs.
- `catalog/formulation_components.csv`: ordered material rows, original roles, quantities, concentration, consumption scope and reviewed eligible market offer IDs.
- `catalog/component_offers.csv`: 42 dated pack quotes with seller, manufacturer, SKU, grade, chemical form, pack amount, currency and product-photo attribution.
- `catalog/component_review_2026-10-17.json`: source research and unresolved gaps.
- `component_tools.py`: offline validation/export; the normal `scripts/build_app_data.py` build regenerates `webapp/app/data/components.json`.

JSON list columns in CSV use proper CSV quoting. Never infer an eligible offer solely from a name or CAS number: hydration, stock concentration, purity/grade, polymer molecular weight and substrate dimensions can change suitability. Add every academic article used as evidence to the reference library and link its formulation to the reference ID. Manufacturer and seller pages remain purchasing/documentation evidence, not academic articles.

## Overall process price

The displayed overall amount is the equipment total plus the cumulative estimated consumption cost of the selected material rows, all in USD. A reused physical instrument is charged once across process steps; materials are counted once per input row, rather than once per instrument occurrence. The equipment hierarchy and project MSRP rules remain intact.

Material use is prorated from an eligible dated pack price: selected absolute quantity / quoted pack quantity × pack price. Compatible mass, liquid-volume and piece units are supported. Molar amounts can be priced against mass packs only with a sourced molecular weight for the correct identity. The app does not silently use a liquid density, replace a stock solution with a powder, or treat gas flow, concentration, pressure, thickness or a range as a consumed amount. The supplier pack price remains visible separately from the estimated portion used.

Unknown amounts, missing quotes, incompatible grades, ambiguous source values, reusable targets and unallocated stock preparations stay uncosted. A **known subtotal** with an uncosted count is a partial figure, not a claim that omitted inputs cost $0. New workflow snapshots retain the quote/SKU, original currency, date, source, conversion and selected amount. Editing a plan invalidates its old budget snapshot until it is saved again. Clearing equipment preserves selected materials and their costs.

The combined total includes capital equipment and one selected formulation batch; it is not an amortized production cost. Shipping, taxes, hazmat, utilities, labour and installation are excluded. Photos may show supplier packaging or a clearly labelled structure illustration; they do not depict the actual experimental batch. 28 quote-linked images are currently available. Conflicting supplier images were withheld.

## Explicit gaps

Many papers provide only ratios/concentrations or omit wash volumes and target/gas consumption. P23 and P26 do not establish a fixed universal batch. P34 preserves a potentially ambiguous printed sodium-nitrate amount without silently correcting its units; P40 preserves a hydrate/formula inconsistency and does not assign it a verified price. The Moringa extract stock, multistage P25 loading, P27 reusable chips and shared PDMS kit are scoped to avoid double counting. Prices are US market snapshots checked on the stated date, not guaranteed quotes.
