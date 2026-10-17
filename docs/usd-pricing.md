# USD equipment prices

The U.S.-focused interface displays equipment prices and process totals in USD. Non-USD source prices are converted using the committed ECB reference-rate snapshot in `catalog/currency_reference_rates.json`. The current snapshot is dated **2026-10-16**, accessed **2026-10-17**. [ECB reference exchange rates](https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html)

ECB rates are quoted as currency units per EUR. The conversion is:

`USD equivalent = source amount × (USD per EUR ÷ source-currency units per EUR)`

Source amounts, currencies, dates, configuration scope and URLs remain intact for attribution. A converted foreign MSRP is labeled **MSRP (USD equivalent)**; it does not establish a U.S. manufacturer MSRP or include taxes, shipping, duties or transaction fees. Conversion does not change sale/list/starting-price classifications or qualify an otherwise ineligible MSRP benchmark. The existing estimation policy remains separately documented.

New process price snapshots store USD values and the original quote, rate, source and rate date. Older saved native-currency snapshots are converted for USD totals when displayed. Already converted USD snapshots are not converted twice. Reused physical units are still counted once. Unknown currencies have an unavailable conversion and are counted as unpriced, rather than being treated as USD.

The catalog's CSV export adds explicit USD price columns while retaining source currency fields. The public `catalog/equipment_prices_usd.csv` report is reproducible with `python scripts/build_usd_prices.py`. Refresh rates by reviewing a newer official snapshot, committing it, regenerating app data and the report, testing and deploying. The app does not fetch changing exchange rates silently during a session.
