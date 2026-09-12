import { auth0Configured } from '@/app/chatgpt-auth';
import { cookies } from 'next/headers';

const TRANSACTION_COOKIE = 'po_auth_tx';

export async function GET(request: Request) {
  if (!auth0Configured()) return Response.json({ error: 'Auth0 yapılandırılmadı.' }, { status: 503 });

  const url = new URL(request.url);
  const returnTo = safeReturnTo(url.searchParams.get('returnTo'));
  const state = randomToken();
  const nonce = randomToken();
  const verifier = randomToken(48);
  const challenge = await sha256Base64url(verifier);
  const callbackUrl = `${publicOrigin(url)}/auth/callback`;
  const transaction = encodeURIComponent(JSON.stringify({ state, nonce, verifier, returnTo, callbackUrl }));
  (await cookies()).set(TRANSACTION_COOKIE, transaction, {
    httpOnly: true,
    secure: url.protocol === 'https:',
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });

  const authorize = new URL(`https://${process.env.AUTH0_DOMAIN}/authorize`);
  authorize.searchParams.set('client_id', process.env.AUTH0_CLIENT_ID!);
  authorize.searchParams.set('response_type', 'code');
  authorize.searchParams.set('redirect_uri', callbackUrl);
  authorize.searchParams.set('scope', 'openid profile email');
  authorize.searchParams.set('state', state);
  authorize.searchParams.set('nonce', nonce);
  authorize.searchParams.set('code_challenge', challenge);
  authorize.searchParams.set('code_challenge_method', 'S256');
  return Response.redirect(authorize);
}

function publicOrigin(requestUrl: URL): string {
  const configured = process.env.PUBLIC_BASE_URL?.replace(/\/$/, '');
  return configured || requestUrl.origin;
}

function safeReturnTo(value: string | null): string {
  if (!value?.startsWith('/') || value.startsWith('//')) return '/';
  return value;
}

function randomToken(length = 32): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return base64url(bytes);
}

async function sha256Base64url(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return base64url(new Uint8Array(digest));
}

function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
