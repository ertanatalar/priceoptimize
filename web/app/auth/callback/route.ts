import { encryptAuth0Session } from '@/app/chatgpt-auth';
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
    return Response.json({ error: 'Geçersiz veya süresi dolmuş giriş isteği.' }, { status: 400 });
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
  if (!tokenResponse.ok) return Response.json({ error: 'Oturum anahtarı alınamadı.' }, { status: 401 });
  const tokens = (await tokenResponse.json()) as { access_token?: string };
  if (!tokens.access_token) return Response.json({ error: 'Geçersiz oturum yanıtı.' }, { status: 401 });

  const profileResponse = await fetch(`https://${process.env.AUTH0_DOMAIN}/userinfo`, {
    headers: { authorization: `Bearer ${tokens.access_token}` },
  });
  if (!profileResponse.ok) return Response.json({ error: 'Kullanıcı bilgisi alınamadı.' }, { status: 401 });
  const profile = (await profileResponse.json()) as UserInfo;
  if (!profile.sub || !profile.email || profile.email_verified !== true) {
    return Response.json({ error: 'Doğrulanmış e-posta gerekli.' }, { status: 403 });
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
  return Response.redirect(new URL(safeReturnTo(transaction.returnTo), url.origin));
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

function safeReturnTo(value: string): string {
  if (!value.startsWith('/') || value.startsWith('//')) return '/';
  return value;
}
