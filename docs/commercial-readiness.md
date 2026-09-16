# Commercial MVP release gates

Price Optimizer may be used with a small number of named pilot customers while the items marked **Blocker** are completed. It must not be marketed as ISO 27001 certified or as automatically supporting every marketplace.

## Technical gates

- [x] Tenant-scoped MySQL queries and server-side write roles
- [x] Auth0 email/password and Google authentication
- [x] Thirty-day trial enforcement
- [x] Price anomaly filtering and evidence-preserving collection errors
- [x] Six-hour monitor workflow committed to the production branch
- [x] Automated backend tests and production web build in CI
- [x] Health endpoint that includes the MySQL dependency
- [x] Automated expiry of observations, audit events, and erasure evidence without legal hold
- [ ] **Blocker:** configure and verify `MONITOR_API_TOKEN` in GitHub Actions, then record a successful manual run
- [ ] **Blocker:** configure a verified Resend sending domain and complete an external-recipient delivery test
- [ ] **Blocker:** verify Aiven automated backups, point-in-time recovery, restore procedure, encryption, EU region, MFA, and least-privilege credentials
- [ ] **Blocker:** add production error tracking, uptime alerts, and an owner/on-call destination
- [x] Paddle checkout, signed/idempotent subscription webhooks, customer invoice/cancellation portal, and failed-payment access state implemented
- [ ] **Blocker for paid self-service:** create/approve the Paddle account and Starter price, configure Render secrets, then pass sandbox and live payment acceptance tests
- [ ] **Blocker for protected marketplaces:** contract an authorized data provider/API; browser-assisted checks are not unattended monitoring
- [ ] Add Apple sign-in only if it remains a launch requirement

## Customer and legal gates

- [ ] **Blocker:** publish controller/company identity, contact details, Terms of Service, Privacy Notice, cookie/session notice, subprocessor list, and international-transfer mechanism
- [ ] **Blocker:** sign provider DPAs and customer data-processing terms where required
- [ ] **Blocker:** document and test access, correction, export, erasure, incident, and complaint workflows
- [ ] **Blocker:** define support hours, monitoring coverage, data freshness promise, exclusions, and service limits in the sales contract
- [ ] **Blocker:** obtain legal review for KVKK, GDPR, VERBIS, tax, invoicing, and consumer/business sales scope
- [ ] Do not claim ISO/IEC 27001 certification until an accredited certificate covers the service and operating organization

## Pilot acceptance test

Before adding the first paying customer, run one end-to-end test with a separate customer email:

1. Sign up and accept the current legal documents.
2. Create a customer, product group, and at least three competitor URLs.
3. Complete one successful cloud check and one browser-assisted check.
4. Confirm the 25% anomaly rule excludes the anomalous price from best-price results.
5. Confirm a real price change generates one email and an unchanged price generates none.
6. Export the customer's data, submit a privacy request, and erase a disposable test account.
7. Restore a database backup into an isolated environment and confirm deleted data re-enters the erasure process.
