export class SourceQuotaError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// The subscription row serializes source imports for the same organization.
export async function lockSourceQuota(connection, organizationId) {
  if (typeof organizationId !== 'string' || !/^[a-f0-9-]{36}$/i.test(organizationId)) {
    throw new SourceQuotaError(400, 'Geçersiz kuruluş.');
  }
  const [[subscription]] = await connection.execute(
    `SELECT state,(trial_ends_at>CURRENT_TIMESTAMP(3)) AS trial_valid FROM subscriptions WHERE organization_id=? FOR UPDATE`,
    [organizationId],
  );
  if (!subscription || !['active', 'trialing'].includes(subscription.state) ||
    (subscription.state === 'trialing' && !subscription.trial_valid)) {
    throw new SourceQuotaError(402, 'Link eklemek için geçerli abonelik gereklidir.');
  }
  return subscription.state === 'trialing' ? 10 : 50;
}

export async function assertSourceQuota(connection, organizationId, limit) {
  const [[row]] = await connection.execute(
    `SELECT COUNT(*) AS used FROM competitor_sources WHERE organization_id=? AND active=TRUE AND deleted_at IS NULL`,
    [organizationId],
  );
  if (Number(row.used) > limit) {
    throw new SourceQuotaError(409, `Paketiniz en fazla ${limit} aktif rakip link içerir. İçe aktarma kaydedilmedi; mevcut linklerinizi azaltın.`);
  }
}
