-- Price Optimizer MySQL 8 schema
-- Privacy by design: no passwords, postal addresses, phone numbers, payment card data,
-- special-category data, or raw IP addresses are stored by this application.

CREATE TABLE IF NOT EXISTS organizations (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  code VARCHAR(49) NOT NULL,
  default_locale VARCHAR(10) NOT NULL DEFAULT 'tr-TR',
  data_region VARCHAR(24) NOT NULL DEFAULT 'eu',
  status ENUM('active','suspended','deleted') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  deleted_at TIMESTAMP(3) NULL,
  UNIQUE KEY uq_organizations_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY,
  identity_provider VARCHAR(32) NOT NULL DEFAULT 'chatgpt',
  identity_subject_hash CHAR(64) NOT NULL,
  email VARCHAR(254) NOT NULL,
  email_verified_at TIMESTAMP(3) NULL,
  locale VARCHAR(10) NOT NULL DEFAULT 'tr-TR',
  status ENUM('active','blocked','deleted') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  last_login_at TIMESTAMP(3) NULL,
  deleted_at TIMESTAMP(3) NULL,
  UNIQUE KEY uq_users_identity (identity_provider, identity_subject_hash),
  KEY ix_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS organization_memberships (
  organization_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  role ENUM('owner','admin','analyst','viewer') NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (organization_id, user_id),
  CONSTRAINT fk_membership_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_membership_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS subscriptions (
  organization_id CHAR(36) PRIMARY KEY,
  state ENUM('trialing','active','past_due','cancelled','expired') NOT NULL DEFAULT 'trialing',
  trial_started_at TIMESTAMP(3) NOT NULL,
  trial_ends_at TIMESTAMP(3) NOT NULL,
  plan_code VARCHAR(40) NOT NULL DEFAULT 'trial',
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_subscription_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  KEY ix_subscription_trial_end (trial_ends_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS legal_acceptances (
  id CHAR(36) PRIMARY KEY,
  organization_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  document_type ENUM('privacy_notice','terms','dpa','marketing') NOT NULL,
  document_version VARCHAR(32) NOT NULL,
  lawful_basis VARCHAR(48) NOT NULL,
  accepted BOOLEAN NOT NULL,
  accepted_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  withdrawn_at TIMESTAMP(3) NULL,
  evidence_hash CHAR(64) NOT NULL,
  CONSTRAINT fk_acceptance_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_acceptance_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  KEY ix_acceptance_subject (user_id, document_type, accepted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS clients (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  organization_id CHAR(36) NOT NULL,
  code VARCHAR(49) NOT NULL,
  name VARCHAR(160) NOT NULL,
  notification_email VARCHAR(254) NULL,
  notification_email_verified_at TIMESTAMP(3) NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  deleted_at TIMESTAMP(3) NULL,
  CONSTRAINT fk_clients_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  UNIQUE KEY uq_clients_org_code (organization_id, code),
  KEY ix_clients_org_active (organization_id, active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS products (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  organization_id CHAR(36) NOT NULL,
  client_id BIGINT UNSIGNED NOT NULL,
  sku VARCHAR(120) NOT NULL,
  name VARCHAR(240) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'TRY',
  max_price_drop_pct DECIMAL(5,2) NOT NULL DEFAULT 25.00,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at TIMESTAMP(3) NULL,
  CONSTRAINT fk_products_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_products_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  UNIQUE KEY uq_products_client_sku (client_id, sku),
  KEY ix_products_org_active (organization_id, active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS competitor_sources (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  organization_id CHAR(36) NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  merchant VARCHAR(160) NOT NULL,
  url TEXT NOT NULL,
  url_hash CHAR(64) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  deleted_at TIMESTAMP(3) NULL,
  CONSTRAINT fk_sources_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_sources_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  UNIQUE KEY uq_sources_product_url (product_id, url_hash),
  KEY ix_sources_org_active (organization_id, active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS observations (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  organization_id CHAR(36) NOT NULL,
  source_id BIGINT UNSIGNED NOT NULL,
  price DECIMAL(18,4) NULL,
  currency CHAR(3) NULL,
  in_stock BOOLEAN NULL,
  checked_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  error_code VARCHAR(80) NULL,
  is_price_anomaly BOOLEAN NOT NULL DEFAULT FALSE,
  anomaly_reason VARCHAR(500) NULL,
  reference_price DECIMAL(18,4) NULL,
  drop_pct DECIMAL(7,3) NULL,
  retention_until TIMESTAMP(3) NOT NULL,
  CONSTRAINT fk_observations_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_observations_source FOREIGN KEY (source_id) REFERENCES competitor_sources(id) ON DELETE CASCADE,
  KEY ix_observations_org_time (organization_id, checked_at),
  KEY ix_observations_source_time (source_id, checked_at),
  KEY ix_observations_retention (retention_until)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS privacy_requests (
  id CHAR(36) PRIMARY KEY,
  organization_id CHAR(36) NOT NULL,
  requester_user_id CHAR(36) NULL,
  requester_email VARCHAR(254) NOT NULL,
  request_type ENUM('access','rectification','erasure','restriction','portability','objection') NOT NULL,
  jurisdiction ENUM('GDPR','KVKK','both') NOT NULL DEFAULT 'both',
  status ENUM('received','verifying','processing','completed','rejected') NOT NULL DEFAULT 'received',
  due_at TIMESTAMP(3) NOT NULL,
  completed_at TIMESTAMP(3) NULL,
  resolution_note VARCHAR(1000) NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_privacy_request_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_privacy_request_user FOREIGN KEY (requester_user_id) REFERENCES users(id) ON DELETE SET NULL,
  KEY ix_privacy_request_due (status, due_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS erasure_records (
  id CHAR(36) PRIMARY KEY,
  organization_id CHAR(36) NOT NULL,
  subject_reference_hash CHAR(64) NOT NULL,
  method ENUM('delete','anonymize','destroy') NOT NULL,
  scope VARCHAR(240) NOT NULL,
  legal_hold BOOLEAN NOT NULL DEFAULT FALSE,
  performed_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  retain_until TIMESTAMP(3) NOT NULL,
  CONSTRAINT fk_erasure_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  KEY ix_erasure_retention (retain_until)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_events (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  organization_id CHAR(36) NOT NULL,
  actor_user_id CHAR(36) NULL,
  event_type VARCHAR(100) NOT NULL,
  object_type VARCHAR(80) NOT NULL,
  object_id VARCHAR(120) NULL,
  outcome ENUM('success','denied','failure') NOT NULL,
  metadata_json JSON NULL,
  occurred_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  retention_until TIMESTAMP(3) NOT NULL,
  CONSTRAINT fk_audit_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_audit_actor FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL,
  KEY ix_audit_org_time (organization_id, occurred_at),
  KEY ix_audit_retention (retention_until)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS retention_policies (
  organization_id CHAR(36) NOT NULL,
  data_category VARCHAR(80) NOT NULL,
  retention_days INT UNSIGNED NOT NULL,
  legal_basis VARCHAR(160) NOT NULL,
  action ENUM('delete','anonymize','review') NOT NULL,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (organization_id, data_category),
  CONSTRAINT fk_retention_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS security_incidents (
  id CHAR(36) PRIMARY KEY,
  organization_id CHAR(36) NOT NULL,
  severity ENUM('low','medium','high','critical') NOT NULL,
  status ENUM('open','contained','resolved') NOT NULL DEFAULT 'open',
  detected_at TIMESTAMP(3) NOT NULL,
  summary VARCHAR(500) NOT NULL,
  personal_data_involved BOOLEAN NOT NULL DEFAULT FALSE,
  authority_notification_due_at TIMESTAMP(3) NULL,
  resolved_at TIMESTAMP(3) NULL,
  CONSTRAINT fk_incident_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  KEY ix_incidents_status (organization_id, status, severity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
