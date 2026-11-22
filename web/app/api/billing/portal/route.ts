import { localeJson } from '@/lib/i18n-server';
import { rejectCrossOriginMutation } from '@/lib/request-security';
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

export async function POST(request: Request) {
  const rejected = rejectCrossOriginMutation(request);
  if (rejected) return rejected;
  const user = await getChatGPTUser();
  if (!user)
    return localeJson(request, { error: 'Oturum gerekli.' }, { status: 401 });
  if (!mysqlConfigured() || !paddleConfigured())
    return localeJson(request,
      { error: 'Faturalandırma sistemi hazır değil.' },
      { status: 503 },
    );
  const account = await getAccount(user);
  if (!account)
    return localeJson(request, { error: 'Hesap bulunamadı.' }, { status: 404 });
  if (
    account.scope !== 'organization' ||
    !['owner', 'admin'].includes(account.role)
  )
    return localeJson(request,
      { error: 'Bu işlem için yetkiniz yok.' },
      { status: 403 },
    );
  const rows = await query<BillingAccount>(
    `SELECT provider_customer_id AS customerId,provider_subscription_id AS subscriptionId FROM billing_accounts WHERE organization_id=? AND provider='paddle' LIMIT 1`,
    [account.organizationId],
  );
  const billing = rows[0];
  if (!billing?.customerId)
    return localeJson(request,
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
  return localeJson(request, { url: payload.data.urls.general.overview });
}

