import { getChatGPTUser } from '@/app/chatgpt-auth';
import { execute, mysqlConfigured } from '@/db/mysql';
import { getAccount } from '@/lib/account';
import {
  paddleConfigured,
  paddleEnvironment,
  starterPriceId,
} from '@/lib/billing';
import { uuid } from '@/lib/security';

export async function POST() {
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
