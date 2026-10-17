# MSRP estimation policy

Rule requested by the project owner on 2026-10-16, in priority order:

1. Display a recorded explicit model MSRP when available.
2. Otherwise use the closest documented older model’s MSRP benchmark × 1.20. A checked direct-successor/new-generation relationship is required; a similar name or newer web page is insufficient. If an intermediate generation is unpriced, search earlier documented generations.
3. Otherwise use 1.20 × the lowest qualifying price in the M category through 0.80 × the highest qualifying price in that category.

Formula outputs display **Estimated MSRP***, currency and evidence. They are planning estimates, not manufacturer quotes. The configuration is `webapp/app/data/msrp-policy.json`.

Pending the owner’s optional clarification, explicit MSRP and official manufacturer **list prices** qualify as benchmarks. List-price sources retain that label and never become explicit MSRP. Starting, sale, generic published, used and inferred prices do not anchor estimates. An amount, currency, dated URL and configuration scope are required for list-price evidence. Set `benchmark_policy` to `explicit_msrp_only` for the narrower policy.

Prices are calculated within one currency, without exchange-rate conversion. A record’s published currency is preferred, then USD, then the sole available currency; ambiguous other currencies remain unavailable. Duplicate make/model records cannot multiply a benchmark. Explicit MSRP takes precedence over list prices for duplicate identities; otherwise the latest reviewed date wins.

If 120% of the minimum exceeds 80% of the maximum, the interval is **unavailable** with status `inverted_range`. This includes a single nonzero category benchmark. Endpoints are never swapped or replaced with historical judgment bands. Missing anchors produce `no_benchmarks`. A separately sourced manufacturer price may still be displayed with its original label.

Category membership spans configurations and may include components. Each record retains its equipment subtype, price scope and exclusions; the owner’s category formula is not evidence that models or configurations are interchangeable. Review those fields when budgeting a process.

The offline Python builder and app/CSV import calculation use the same rule. Generated outputs:

- `catalog/equipment_msrp_estimates.csv`: every model, including unavailable results, source URLs and benchmark IDs.
- `catalog/category_price_estimates.csv`: category-level results.
- `catalog/msrp_rule_review_2026-10-16.json`: policy and reproducible calculation audit.

At this revision: 52 model records have formula estimates, 745 have no qualifying benchmark, 60 have inverted intervals and one has explicit MSRP. The 71 separately published manufacturer prices include other price types and therefore do not all qualify as anchors. Existing saved-process price snapshots remain historical; newly assigned equipment uses the current calculation.

Earlier analyst ranges and component overrides are archived in `catalog/legacy_*_2026-10-16.csv`. They are excluded from the current app seed and imports. Regenerate with `python scripts/build_app_data.py`; tests compare offline and browser results for every model.
