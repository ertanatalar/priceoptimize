# PriceOptimize.ai Pricing Data Model

This document maps the professional pricing dataset to the Django database.

## Data Groups

| Data group | Django model | Purpose |
| --- | --- | --- |
| Product master data | `Product` | SKU, product id, title, brand, category, unit, tax class and lifecycle status. |
| Cost and profitability | `ProductPricingProfile` | Cost, landed cost, COGS, shipping cost, minimum margin, MSRP and MAP price. |
| Transaction history | `TransactionRecord` | Order-level price, quantity, discount, channel and timestamp history. |
| Stock data | `StockSnapshot` | On-hand stock, reserved stock, lead time, warehouse and stockout status. |
| Competitor data | `CompetitorPriceSnapshot` | Competitor price, matched URL, stock status and crawl timestamp. |
| Promotion data | `Promotion` | Discount type, discount depth, date range and media support. |
| Channel metadata | `ChannelMetadata` | Channel currency, VAT mode, price limits and update limit. |
| Customer/account data | `CustomerAccountSignal` | Hashed account id, segment, region and contract flag. |
| External signals | `ExternalSignal` | Holiday, FX, weather, season, inflation and campaign signals. |
| Experiment data | `ExperimentObservation` | Variant, assignment time, holdout group and reason code. |

## Notes

- Customer identifiers should be stored as hashes, not raw personal data.
- The UI does not need to show every field immediately. These models create the foundation for CSV import, API import and advanced recommendations.
- `CompetitorPriceSnapshot.price` is the competitor price field. `captured_at` and `crawl_ts` can both be used depending on whether the data came from manual entry or an automated crawler.
