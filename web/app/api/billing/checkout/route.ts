import { rejectCrossOriginMutation } from '@/lib/request-security';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { execute, mysqlConfigured } from '@/db/mysql';
import { getAccount } from '@/lib/account';
import {
  paddleConfigured,
  paddleEnvironment,
  starterPriceId,
  paddleApi,
} from '@/lib/billing';
import { isStarterMonthlyPrice } from '@/lib/billing-price';
import { uuid } from '@/lib/security';

export async function POST(request: Request) {
  const rejected = rejectCrossOriginMutation(request);
  if (rejected) return rejected;
  const user = await getChatGPTUser();
  if (!user)
    return Response.json({ error: 'Oturum gerekli.' }, { status: 401 });
  if (!mysqlConfigured())
    return Response.json(
      { error: 'MySQL bağlantısı yapılandırılmadı.' },
      { status: 503 },
    );
  if (!paddleConfigured())
    return Response.json(
      { error: 'Ödeme sistemi henüz etkinleştirilmedi.' },
      { status: 503 },
    );
  const account = await getAccount(user);
  if (!account)
    return Response.json({ error: 'Hesap bulunamadı.' }, { status: 404 });
  if (
    account.scope !== 'organization' ||
    !account.userId ||
    !['owner', 'admin'].includes(account.role)
  )
    return Response.json(
      {
        error:
          'Aboneliği yalnızca kuruluş sahibi veya yöneticisi başlatabilir.',
      },
      { status: 403 },
    );
  if (['active', 'past_due'].includes(account.subscriptionState))
    return Response.json(
      { error: 'Mevcut aboneliğinizi fatura portalından yönetin.' },
      { status: 409 },
    );

  const checkoutRef = uuid();
  const priceId = starterPriceId();
  try {
    const { data } = await paddleApi<{ data: Parameters<typeof isStarterMonthlyPrice>[0] }>(`/prices/${encodeURIComponent(priceId)}`);
    if (!isStarterMonthlyPrice(data)) return Response.json({ error: 'Aylık 29 USD paket fiyatı henüz doğrulanmadı. Lütfen destekle iletişime geçin.' }, { status: 503 });
  } catch {
    return Response.json({ error: 'Paket fiyatı doğrulanamadı. Lütfen daha sonra tekrar deneyin.' }, { status: 503 });
  }
  await execute(
    `INSERT INTO billing_checkout_sessions(id,organization_id,user_id,plan_code,provider_price_id,expires_at) VALUES(?,?,?,'starter',?,DATE_ADD(CURRENT_TIMESTAMP(3),INTERVAL 30 MINUTE))`,
    [checkoutRef, account.organizationId, account.userId, priceId],
  );
  return Response.json({
    provider: 'paddle',
    environment: paddleEnvironment(),
    clientToken: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN,
    priceId,
    checkoutRef,
    customerEmail: user.email,
  });
}

