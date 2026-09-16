import { getChatGPTUser } from '@/app/chatgpt-auth';
import { mysqlConfigured, query } from '@/db/mysql';
import { getAccount } from '@/lib/account';
import { paddleApi, paddleConfigured } from '@/lib/billing';

type BillingAccount = {
  customerId: string | null;
  subscriptionId: string | null;
};

type PortalResponse = {
  data: { urls: { general: { overview: string } } };
};

export async function POST() {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json({ error: 'Oturum gerekli.' }, { status: 401 });
  if (!mysqlConfigured() || !paddleConfigured())
    return Response.json(
      { error: 'Faturalandırma sistemi hazır değil.' },
      { status: 503 },
    );
  const account = await getAccount(user);
  if (!account)
    return Response.json({ error: 'Hesap bulunamadı.' }, { status: 404 });
  if (
    account.scope !== 'organization' ||
    !['owner', 'admin'].includes(account.role)
  )
    return Response.json(
      { error: 'Bu işlem için yetkiniz yok.' },
      { status: 403 },
    );
  const rows = await query<BillingAccount>(
    `SELECT provider_customer_id AS customerId,provider_subscription_id AS subscriptionId FROM billing_accounts WHERE organization_id=? AND provider='paddle' LIMIT 1`,
    [account.organizationId],
  );
  const billing = rows[0];
  if (!billing?.customerId)
    return Response.json(
      { error: 'Yönetilecek ücretli abonelik bulunamadı.' },
      { status: 404 },
    );
  const payload = await paddleApi<PortalResponse>(
    `/customers/${encodeURIComponent(billing.customerId)}/portal-sessions`,
    {
      method: 'POST',
      body: JSON.stringify(
        billing.subscriptionId
          ? { subscription_ids: [billing.subscriptionId] }
          : {},
      ),
    },
  );
  return Response.json({ url: payload.data.urls.general.overview });
}
