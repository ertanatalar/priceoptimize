const hashPattern = /^[a-f0-9]{64}$/;
const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

/** Offline review only. This module never connects to or writes a database. */
export function identityTransitionPlan(users, mappings) {
  if (!Array.isArray(users) || !Array.isArray(mappings) || mappings.length === 0) throw Error('A nonempty, explicitly verified mapping is required.');
  const byId = new Map();
  for (const user of users) {
    if (!uuidPattern.test(user.id) || !hashPattern.test(user.identity_subject_hash) || byId.has(user.id)) throw Error('Invalid or duplicate inventory identity.');
    byId.set(user.id, user);
  }
  const changed = new Set(), destinations = new Set();
  return mappings.map((mapping) => {
    const user = byId.get(mapping.userId);
    if (!user || user.status !== 'active') throw Error('An active existing user is required.');
    if (changed.has(user.id)) throw Error('Duplicate source mapping.');
    if (mapping.oldProvider !== user.identity_provider || mapping.oldSubjectHash !== user.identity_subject_hash) throw Error('Inventory changed; obtain a fresh snapshot.');
    if (mapping.newProvider !== 'auth0' || !hashPattern.test(mapping.newSubjectHash)) throw Error('A verified Auth0 subject hash is required.');
    if (typeof mapping.verificationReference !== 'string' || mapping.verificationReference.trim().length < 8) throw Error('An independently reviewed identity verification reference is required.');
    const destination = `${mapping.newProvider}:${mapping.newSubjectHash}`;
    if (destinations.has(destination) || users.some((u) => u.identity_provider === mapping.newProvider && u.identity_subject_hash === mapping.newSubjectHash)) throw Error('Destination identity is already linked.');
    changed.add(user.id); destinations.add(destination);
    return {
      userId: user.id,
      verificationReference: mapping.verificationReference.trim(),
      // Preserve the user UUID: memberships, legal records and tenant data stay attached.
      forward: { sql: "UPDATE users SET identity_provider=?,identity_subject_hash=? WHERE id=? AND identity_provider=? AND identity_subject_hash=? AND status='active'", params: [mapping.newProvider, mapping.newSubjectHash, user.id, user.identity_provider, user.identity_subject_hash] },
      rollback: { sql: "UPDATE users SET identity_provider=?,identity_subject_hash=? WHERE id=? AND identity_provider=? AND identity_subject_hash=? AND status='active'", params: [user.identity_provider, user.identity_subject_hash, user.id, mapping.newProvider, mapping.newSubjectHash] },
      requirements: ['Recheck the live source and destination in a transaction.', 'Require exactly one affected user row; rollback otherwise.', 'Record operator, verification reference and before/after identity hashes in an audit event in the same transaction.', 'Use rollback only after rechecking later identity changes; do not run blindly.'],
    };
  });
}

const TABLES = ['organizations', 'users', 'organization_memberships', 'subscriptions', 'legal_acceptances', 'clients', 'products', 'competitor_sources', 'observations', 'privacy_requests', 'erasure_records', 'audit_events', 'retention_policies', 'billing_accounts', 'billing_checkout_sessions', 'billing_webhook_events'];
const UPDATES = ['users', 'clients', 'products', 'competitor_sources', 'observations', 'subscriptions', 'legal_acceptances', 'billing_accounts', 'billing_checkout_sessions'];
export function runtimeGrantPlan({ database, username }) {
  // Names are restricted, not interpolated from arbitrary SQL or credentials.
  if (!/^[A-Za-z0-9_]{1,64}$/.test(database) || !/^[A-Za-z0-9_]{1,32}$/.test(username) || ['root','avnadmin'].includes(username.toLowerCase())) throw Error('Use a dedicated, validated runtime account and schema.');
  const account = `'${username}'@'%'`;
  return {
    account, database,
    preconditions: ['The account must already exist and have no global privileges, inherited roles or GRANT OPTION.', 'Review SHOW GRANTS and provider host matching before applying.', 'Do not apply to avnadmin/root or any account in active use.', 'This plan includes billing tables inspected at deployed commit 05c6dbe; reconcile with any newer deployed code before applying.'],
    statements: [
      ...TABLES.map((table) => `GRANT SELECT, INSERT ON \`${database}\`.\`${table}\` TO ${account};`),
      ...UPDATES.map((table) => `GRANT UPDATE ON \`${database}\`.\`${table}\` TO ${account};`),
      // Current collector expiry includes audit/erasure evidence; legal holds remain in SQL.
      ...['observations', 'audit_events', 'erasure_records'].map((table) => `GRANT DELETE ON \`${database}\`.\`${table}\` TO ${account};`),
    ],
    prohibited: ['CREATE', 'ALTER', 'DROP', 'FILE', 'GRANT OPTION', 'global privileges'],
    note: 'GRANT does not remove existing broad privileges. Verify the fresh account first. No password or CREATE USER is generated.',
  };
}
