import { query, mysqlConfigured } from '@/db/mysql';
import { sha256 } from '@/lib/security';
import { normalizeLocale } from '../../../i18n-shared/i18n.mjs';
import { localeJson } from '@/lib/i18n-server';
import { safeRelativeReturnPath, encryptAuth0Session } from '@/app/chatgpt-auth';
import { cookies } from 'next/headers';

const TRANSACTION_COOKIE = 'po_auth_tx';
const SESSION_COOKIE = 'po_session';

type Transaction = {
  state: string;
  nonce: string;
  verifier: string;
  returnTo: string;
  callbackUrl: string;
};

type UserInfo = {
  sub?: string;
  email?: string;
  name?: string;
  email_verified?: boolean;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookieStore = await cookies();
  const transaction = readTransaction(cookieStore.get(TRANSACTION_COOKIE)?.value);
  cookieStore.delete(TRANSACTION_COOKIE);
  if (!code || !state || !transaction || !constantTimeEqual(state, transaction.state)) {
    return localeJson(request, { error: 'Geçersiz veya süresi dolmuş giriş isteği.' }, { status: 400 });
  }

  const tokenResponse = await fetch(`https://${process.env.AUTH0_DOMAIN}/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: process.env.AUTH0_CLIENT_ID,
      client_secret: process.env.AUTH0_CLIENT_SECRET,
      code,
      redirect_uri: transaction.callbackUrl,
      code_verifier: transaction.verifier,
    }),
  });
  if (!tokenResponse.ok) return localeJson(request, { error: 'Oturum anahtarı alınamadı.' }, { status: 401 });
  const tokens = (await tokenResponse.json()) as { access_token?: string };
  if (!tokens.access_token) return localeJson(request, { error: 'Geçersiz oturum yanıtı.' }, { status: 401 });

  const profileResponse = await fetch(`https://${process.env.AUTH0_DOMAIN}/userinfo`, {
    headers: { authorization: `Bearer ${tokens.access_token}` },
  });
  if (!profileResponse.ok) return localeJson(request, { error: 'Kullanıcı bilgisi alınamadı.' }, { status: 401 });
  const profile = (await profileResponse.json()) as UserInfo;
  if (!profile.sub || !profile.email || profile.email_verified !== true) {
    return localeJson(request, { error: 'Doğrulanmış e-posta gerekli.' }, { status: 403 });
  }

  const session = await encryptAuth0Session({
    sub: profile.sub,
    email: profile.email.toLowerCase(),
    name: profile.name,
    email_verified: profile.email_verified,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 8,
  });
  cookieStore.set(SESSION_COOKIE, session, {
    httpOnly: true,
    secure: url.protocol === 'https:',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8,
  });
  if (!cookieStore.get('po_locale') && mysqlConfigured()) {
    try {
      const rows=await query<{locale:string}>("SELECT locale FROM users WHERE identity_provider='auth0' AND identity_subject_hash=? AND status='active' LIMIT 1",[await sha256(profile.sub)]);
      if(rows[0])cookieStore.set('po_locale',normalizeLocale(rows[0].locale),{path:'/',secure:url.protocol==='https:',sameSite:'lax',maxAge:60*60*24*365});
    } catch { /* Login remains available if preference lookup fails. */ }
  }
  return Response.redirect(new URL(safeRelativeReturnPath(transaction.returnTo), process.env.PUBLIC_BASE_URL || url.origin));
}

function readTransaction(value: string | undefined): Transaction | null {
  try {
    if (!value) return null;
    const result = JSON.parse(decodeURIComponent(value)) as Transaction;
    return result.state && result.verifier && result.callbackUrl ? result : null;
  } catch {
    return null;
  }
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return result === 0;
}
