import type { ChatGPTUser } from '@/app/chatgpt-auth';
import { execute, query } from '@/db/mysql';
import { sha256 } from '@/lib/security';

export type AccountContext = {
  userId: string | null;
  organizationId: string;
  organizationName: string;
  role: 'owner' | 'admin' | 'analyst' | 'viewer';
  scope: 'organization' | 'client';
  clientId: number | null;
  subscriptionState: 'trialing' | 'active' | 'past_due' | 'cancelled' | 'expired';
  trialEndsAt: string;
  trialDaysRemaining: number;
};

export async function getAccount(user: ChatGPTUser): Promise<AccountContext | null> {
  const subjectHash = await sha256(user.userId);
  const rows = await query<AccountContext & { trialEndsAt: string }>(`
    SELECT u.id AS userId,o.id AS organizationId,o.name AS organizationName,m.role,
           'organization' AS scope,NULL AS clientId,
           s.state AS subscriptionState,s.trial_ends_at AS trialEndsAt,
           GREATEST(0,CEIL(TIMESTAMPDIFF(SECOND,CURRENT_TIMESTAMP(3),s.trial_ends_at)/86400)) AS trialDaysRemaining
    FROM users u
    JOIN organization_memberships m ON m.user_id=u.id
    JOIN organizations o ON o.id=m.organization_id AND o.status='active'
    JOIN subscriptions s ON s.organization_id=o.id
    WHERE u.identity_provider=? AND u.identity_subject_hash=? AND u.status='active'
    ORDER BY m.created_at LIMIT 1
  `, [user.identityProvider, subjectHash]);
  let account = rows[0];
  if (!account && user.emailVerified) {
    const emailRows = await query<AccountContext & { trialEndsAt: string }>(`
      SELECT u.id AS userId,o.id AS organizationId,o.name AS organizationName,m.role,
             'organization' AS scope,NULL AS clientId,
             s.state AS subscriptionState,s.trial_ends_at AS trialEndsAt,
             GREATEST(0,CEIL(TIMESTAMPDIFF(SECOND,CURRENT_TIMESTAMP(3),s.trial_ends_at)/86400)) AS trialDaysRemaining
      FROM users u
      JOIN organization_memberships m ON m.user_id=u.id
      JOIN organizations o ON o.id=m.organization_id AND o.status='active'
      JOIN subscriptions s ON s.organization_id=o.id
      WHERE LOWER(u.email)=? AND u.status='active'
      ORDER BY m.created_at LIMIT 1
    `, [user.email.trim().toLowerCase()]);
    account = emailRows[0];
  }
  if (!account) {
    const email = user.email.trim().toLowerCase();
    const portalRows = await query<AccountContext & { trialEndsAt: string; notificationVerified: number }>(`
      SELECT NULL AS userId,o.id AS organizationId,o.name AS organizationName,'viewer' AS role,
             'client' AS scope,c.id AS clientId,s.state AS subscriptionState,s.trial_ends_at AS trialEndsAt,
             GREATEST(0,CEIL(TIMESTAMPDIFF(SECOND,CURRENT_TIMESTAMP(3),s.trial_ends_at)/86400)) AS trialDaysRemaining,
             (c.notification_email_verified_at IS NOT NULL) AS notificationVerified
      FROM clients c
      JOIN organizations o ON o.id=c.organization_id AND o.status='active'
      JOIN subscriptions s ON s.organization_id=o.id
      WHERE LOWER(c.notification_email)=? AND c.active=TRUE AND c.deleted_at IS NULL
      ORDER BY c.created_at LIMIT 1
    `, [email]);
    account = portalRows[0];
    if (account && !portalRows[0].notificationVerified) {
      await execute(`UPDATE clients SET notification_email_verified_at=CURRENT_TIMESTAMP(3) WHERE id=? AND organization_id=? AND notification_email_verified_at IS NULL`, [account.clientId, account.organizationId]);
    }
  }
  if (!account) return null;
  if (account.subscriptionState === 'trialing' && new Date(account.trialEndsAt).getTime() <= Date.now()) {
    await execute(`UPDATE subscriptions SET state='expired' WHERE organization_id=? AND state='trialing' AND trial_ends_at<=CURRENT_TIMESTAMP(3)`, [account.organizationId]);
    return { ...account, subscriptionState: 'expired', trialDaysRemaining: 0 };
  }
  return account;
}

export function assertWritable(account: AccountContext) {
  if (!['trialing', 'active'].includes(account.subscriptionState)) throw new TrialExpiredError();
  if (account.scope !== 'organization' || !['owner', 'admin', 'analyst'].includes(account.role)) throw new ForbiddenError();
}

export class TrialExpiredError extends Error {}
export class ForbiddenError extends Error {}
