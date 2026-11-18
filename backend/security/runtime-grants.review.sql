-- REVIEW ONLY. No credentials. Verify a new account has no inherited/global privileges.
-- Based on deployed commit 05c6dbe; review changes before running.
-- The account must already exist and have no global privileges, inherited roles or GRANT OPTION.
-- Review SHOW GRANTS and provider host matching before applying.
-- Do not apply to avnadmin/root or any account in active use.
-- This plan includes billing tables inspected at deployed commit 05c6dbe; reconcile with any newer deployed code before applying.

GRANT SELECT, INSERT ON `defaultdb`.`organizations` TO 'priceopt_runtime'@'%';
GRANT SELECT, INSERT ON `defaultdb`.`users` TO 'priceopt_runtime'@'%';
GRANT SELECT, INSERT ON `defaultdb`.`organization_memberships` TO 'priceopt_runtime'@'%';
GRANT SELECT, INSERT ON `defaultdb`.`subscriptions` TO 'priceopt_runtime'@'%';
GRANT SELECT, INSERT ON `defaultdb`.`legal_acceptances` TO 'priceopt_runtime'@'%';
GRANT SELECT, INSERT ON `defaultdb`.`clients` TO 'priceopt_runtime'@'%';
GRANT SELECT, INSERT ON `defaultdb`.`products` TO 'priceopt_runtime'@'%';
GRANT SELECT, INSERT ON `defaultdb`.`competitor_sources` TO 'priceopt_runtime'@'%';
GRANT SELECT, INSERT ON `defaultdb`.`observations` TO 'priceopt_runtime'@'%';
GRANT SELECT, INSERT ON `defaultdb`.`privacy_requests` TO 'priceopt_runtime'@'%';
GRANT SELECT, INSERT ON `defaultdb`.`erasure_records` TO 'priceopt_runtime'@'%';
GRANT SELECT, INSERT ON `defaultdb`.`audit_events` TO 'priceopt_runtime'@'%';
GRANT SELECT, INSERT ON `defaultdb`.`retention_policies` TO 'priceopt_runtime'@'%';
GRANT SELECT, INSERT ON `defaultdb`.`billing_accounts` TO 'priceopt_runtime'@'%';
GRANT SELECT, INSERT ON `defaultdb`.`billing_checkout_sessions` TO 'priceopt_runtime'@'%';
GRANT SELECT, INSERT ON `defaultdb`.`billing_webhook_events` TO 'priceopt_runtime'@'%';
GRANT UPDATE ON `defaultdb`.`users` TO 'priceopt_runtime'@'%';
GRANT UPDATE ON `defaultdb`.`clients` TO 'priceopt_runtime'@'%';
GRANT UPDATE ON `defaultdb`.`products` TO 'priceopt_runtime'@'%';
GRANT UPDATE ON `defaultdb`.`competitor_sources` TO 'priceopt_runtime'@'%';
GRANT UPDATE ON `defaultdb`.`observations` TO 'priceopt_runtime'@'%';
GRANT UPDATE ON `defaultdb`.`subscriptions` TO 'priceopt_runtime'@'%';
GRANT UPDATE ON `defaultdb`.`legal_acceptances` TO 'priceopt_runtime'@'%';
GRANT UPDATE ON `defaultdb`.`billing_accounts` TO 'priceopt_runtime'@'%';
GRANT UPDATE ON `defaultdb`.`billing_checkout_sessions` TO 'priceopt_runtime'@'%';
GRANT DELETE ON `defaultdb`.`observations` TO 'priceopt_runtime'@'%';
GRANT DELETE ON `defaultdb`.`audit_events` TO 'priceopt_runtime'@'%';
GRANT DELETE ON `defaultdb`.`erasure_records` TO 'priceopt_runtime'@'%';
