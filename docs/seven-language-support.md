# Seven-language support

Supported locales: tr, en, de, fr, it, es and pt (Portuguese formatting: pt-PT). All use the same 29 USD/month, 50-link plan and 30-day/10-link trial. Locale selection does not convert currencies or translate customer-entered product/merchant names.

## Request and account behavior

- Root layout resolves a validated po_locale cookie, then supported Accept-Language preferences; legacy/default fallback is Turkish. The selected language is rendered on the server, including html lang, metadata and legal pages.
- POST /api/locale validates the language and request origin. Anonymous preferences are cookie-only. Authenticated users update their own users.locale; an owner can update their own organization's default_locale. Portal recipients record a client-scoped preference in audit_events. No schema migration is needed.
- Language choice is restored from the existing user record at Auth0 callback if the browser has no language cookie. Auth0 authorization receives ui_locales; the tenant must permit those languages for its hosted screens. This does not change authentication permissions or MFA.
- GET /language supports safe, same-origin return paths for shared links and extension capture; it only sets the language cookie.
- HTML pages and localized API results vary by Cookie/Accept-Language and are private/no-store. No global mutable server locale is used.
- New legal acceptances include the selected locale in the recorded document version/evidence. Existing acceptance records are preserved.

## Translation and notification sources

shared/locales/*.json is the single catalog for UI, public/legal text, errors and notifications. Values keep indexed placeholders. The shared translation helper only translates display/error fields, preserving names, URL/CSV protocol keys, currencies and observation values.

Email locale precedence is client-scoped preference, verified recipient account in the same organization, then organization default. Backend composePriceEmail formats localized plain-text messages; tests do not send actual emails. Auth0 verification/security emails and Paddle receipts remain provider-managed; provider templates/settings must support the requested language. Paddle checkout receives the selected locale when checkout is enabled.

## Browser extension

Version 0.3.0 includes seven popup languages, translated batch messages and Chrome manifest locale metadata. Dashboard queue exports include locale. Popup language can be changed explicitly, and capture navigation passes the locale through /language. Injected product-page extractors stay self-contained and do not depend on extension translation globals. Permissions are unchanged.

After editing shared catalogs run:

    node tools/build-extension-i18n.cjs

Then rebuild web/public/price-optimizer-browser-extension.zip from that folder (preserve manifest.json at ZIP root). Existing unpacked installations need a user reload/update to use the new extension assets.

## Verification

CI runs security/tenant isolation, preference validation, translation key/placeholder parity, SSR locale isolation, display-vs-user-data preservation, safe locale redirects, JSX translation coverage, extension parity and backend notification composition. Browser QA covers language switching and persistence on pricing/legal pages. No live payment, customer email, or customer observation needs to be created for localization tests.

## 22 November 2026 verification

All seven catalogs contain 504 display messages with exact key/placeholder parity. Local checks: 25 backend tests (including localized notification composition), 24 web security/localization/import tests, 7 web unit tests, TypeScript and production build passed. Browser QA verified switching Turkish→German and navigation to German legal pages without losing preference; 42 anonymous page responses across all seven locales returned the requested html language. No live email or payment was sent.

Auth0's public login currently rendered Turkish and English, but de/fr/it/es/pt requests fell back to English. Correct-tenant management access was attempted and stopped at MFA; no MFA setting was changed or bypassed. The tenant owner must complete the open Auth0 Dashboard challenge before the remaining five hosted-login languages can be enabled. Application UI and service notification translations are independent of this external setting.
