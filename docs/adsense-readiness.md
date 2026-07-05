# AdSense Readiness Notes

This project keeps the AdSense review flow production-safe and avoids showing ad code on low-value or non-publisher screens before approval.

## What Is Implemented

- Public pages load with title, meta description, canonical URL, and structured data where relevant.
- AdSense scripts are not rendered on public pages before approval.
- `ads.txt` does not use a fake publisher fallback in production.
- `robots.txt`, `sitemap.xml`, and `llms.txt` are available for search engines and AI crawlers.
- Privacy Policy, Terms of Use, and Cookie Policy pages include substantive explanations.
- Login and assistant-style workflows are separated from public editorial pages.

## Local Checks

Run the Django test suite:

```bash
python3 manage.py test
```

Run the AdSense smoke check:

```bash
python3 scripts/validate_adsense_readiness.py
```

Both commands should pass before pushing a review-related update.

## Render Environment

Production should include one of these:

```text
ADS_TXT_LINE=google.com, pub-1440594600782472, DIRECT, f08c47fec0942fa0
```

or:

```text
ADSENSE_CLIENT_ID=ca-pub-1440594600782472
```

Do not use placeholder publisher IDs such as `pub-0000000000000000`.

## Manual Review Checklist

- Open `https://www.priceoptimize.ai/ads.txt` and confirm the real publisher ID appears.
- Confirm AdSense reports `ads.txt` as authorized.
- Confirm Search Console can read `https://www.priceoptimize.ai/sitemap.xml`.
- Confirm policy pages are reachable from the site navigation.
- Request review only after the live site has finished deploying.
