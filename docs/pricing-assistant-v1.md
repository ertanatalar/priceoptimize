# PriceOptimize AI Pricing Assistant V1

This document describes the first SaaS-style pricing assistant layer added to the Django project.

## Goal

The assistant turns PriceOptimize AI from a one-off calculator into a pricing workflow:

1. Collect product, cost, current price, stock, competitor price, and sales data.
2. Build a deterministic price recommendation.
3. Explain why the recommendation was produced.
4. Keep an audit trail for recommendation creation and user decisions.
5. Keep product data separated by organization.

V1 does not update store prices automatically. It only recommends a price and records whether the user accepts or rejects it.

## Main URLs

- `/pricing-assistant/` login-only HTML assistant.
- `/api/products/<product_id>/pricing-profile/` read or update a pricing profile.
- `/api/products/<product_id>/competitor-prices/` list or add competitor prices.
- `/api/products/<product_id>/sales-snapshots/` add sales snapshots.
- `/api/products/<product_id>/recommendations/generate/` create a new recommendation.
- `/api/products/<product_id>/recommendations/` list recommendations for a product.
- `/api/recommendations/<recommendation_id>/` read one recommendation.
- `/api/recommendations/<recommendation_id>/accept/` accept a recommendation.
- `/api/recommendations/<recommendation_id>/reject/` reject a recommendation.

## Data Model

- `Organization`: tenant boundary.
- `OrganizationMembership`: user access to an organization.
- `Product`: merchant product.
- `ProductPricingProfile`: cost, current price, minimum margin, stock, and active flag.
- `CompetitorPriceSnapshot`: manual competitor price observations.
- `SalesSnapshot`: historical units and revenue by period.
- `PriceRecommendation`: recommended price, expected gross profit, confidence, reason, and status.
- `PricingAuditLog`: append-only audit record for important actions.

## Recommendation Rules

The engine is deterministic and deliberately conservative.

- It calculates the minimum allowed price from cost and minimum gross margin.
- It uses fresh competitor prices from the last 30 days.
- It compares the current price with the competitor median.
- It considers stock pressure and recent sales trend.
- It limits ordinary price changes using `PRICING_MAX_CHANGE_PERCENT`, default `5`.
- It never allows a recommendation below the minimum safe price.
- It returns a confidence score based on data availability.

## Safety And Access

- All assistant pages require login.
- API access is filtered through organization membership.
- Cross-tenant product or recommendation access returns `404`.
- Recommendation decisions are audited.
- The assistant page uses `noindex,nofollow` because it is a login-only workflow page.

## Important Environment Variable

`PRICING_MAX_CHANGE_PERCENT` controls the maximum normal price change per recommendation. Default: `5`.

Example:

```text
PRICING_MAX_CHANGE_PERCENT=5
```

## Known V1 Limits

- Competitor prices are entered manually.
- No billing or subscription gating yet.
- No real ecommerce integration yet.
- No automatic price write-back yet.
- No multi-user organization invitation UI yet.

## Suggested V2

- Add import from CSV or marketplace exports.
- Add scheduled recommendation checks.
- Add product-level recommendation history charts.
- Add paid plan limits.
- Add webhook or email notifications.
- Add Shopify/WooCommerce integrations after the recommendation loop is trusted.
