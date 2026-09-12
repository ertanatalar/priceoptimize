import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';

export type ChatGPTUser = {
  userId: string;
  displayName: string;
  email: string;
  fullName: string | null;
  identityProvider: 'auth0' | 'chatgpt';
  emailVerified: boolean;
};

const USER_ID_HEADER = 'oai-authenticated-user-id';
const USER_EMAIL_HEADER = 'oai-authenticated-user-email';
const USER_FULL_NAME_HEADER = 'oai-authenticated-user-full-name';
const USER_FULL_NAME_ENCODING_HEADER =
  'oai-authenticated-user-full-name-encoding';
const PERCENT_ENCODED_UTF8 = 'percent-encoded-utf-8';
const SIGN_IN_PATH = '/signin-with-chatgpt';
const SIGN_OUT_PATH = '/signout-with-chatgpt';
const CALLBACK_PATH = '/callback';
const AUTH0_SESSION_COOKIE = 'po_session';

type Auth0Session = {
  sub: string;
  email: string;
  name?: string;
  email_verified?: boolean;
  exp: number;
};

export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  const auth0User = await getAuth0User();
  if (auth0User) return auth0User;

  const requestHeaders = await headers();
  const userId = requestHeaders.get(USER_ID_HEADER);
  const email = requestHeaders.get(USER_EMAIL_HEADER);
  if (!userId || !email) return null;

  const encodedFullName = requestHeaders.get(USER_FULL_NAME_HEADER);
  const fullName =
    encodedFullName &&
    requestHeaders.get(USER_FULL_NAME_ENCODING_HEADER) === PERCENT_ENCODED_UTF8
      ? safeDecodeURIComponent(encodedFullName)
      : null;

  return {
    userId,
    displayName: fullName ?? email,
    email,
    fullName,
    identityProvider: 'chatgpt',
    emailVerified: true,
  };
}

export async function requireChatGPTUser(
  returnTo: string,
): Promise<ChatGPTUser> {
  const user = await getChatGPTUser();
  if (user) return user;

  redirect(auth0Configured() ? auth0SignInPath(returnTo) : chatGPTSignInPath(returnTo));
}

export function auth0Configured(): boolean {
  return Boolean(
    process.env.AUTH0_DOMAIN &&
      process.env.AUTH0_CLIENT_ID &&
      process.env.AUTH0_CLIENT_SECRET &&
      process.env.AUTH0_SECRET,
  );
}

export function auth0SignInPath(returnTo: string): string {
  const safeReturnTo = safeRelativeReturnPath(returnTo);
  return `/auth/login?returnTo=${encodeURIComponent(safeReturnTo)}`;
}

export function auth0SignOutPath(): string {
  return '/auth/logout';
}

async function getAuth0User(): Promise<ChatGPTUser | null> {
  if (!auth0Configured()) return null;
  const token = (await cookies()).get(AUTH0_SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await decryptSession(token);
  if (!session || session.exp <= Math.floor(Date.now() / 1000)) return null;
  return {
    userId: session.sub,
    displayName: session.name ?? session.email,
    email: session.email,
    fullName: session.name ?? null,
    identityProvider: 'auth0',
    emailVerified: session.email_verified === true,
  };
}

export async function encryptAuth0Session(session: Auth0Session): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await sessionKey();
  const plaintext = new TextEncoder().encode(JSON.stringify(session));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  return `${base64url(iv)}.${base64url(new Uint8Array(encrypted))}`;
}

async function decryptSession(token: string): Promise<Auth0Session | null> {
  try {
    const [ivPart, ciphertextPart] = token.split('.');
    if (!ivPart || !ciphertextPart) return null;
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64url(ivPart) },
      await sessionKey(),
      fromBase64url(ciphertextPart),
    );
    const value = JSON.parse(new TextDecoder().decode(plaintext)) as Auth0Session;
    return value.sub && value.email && Number.isFinite(value.exp) ? value : null;
  } catch {
    return null;
  }
}

async function sessionKey(): Promise<CryptoKey> {
  const secret = process.env.AUTH0_SECRET;
  if (!secret) throw new Error('AUTH0_SECRET yapılandırılmadı.');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function chatGPTSignInPath(returnTo: string): string {
  const safeReturnTo = safeRelativeReturnPath(returnTo);
  return `${SIGN_IN_PATH}?return_to=${encodeURIComponent(safeReturnTo)}`;
}

export function chatGPTSignOutPath(returnTo = '/'): string {
  const safeReturnTo = safeRelativeReturnPath(returnTo);
  return `${SIGN_OUT_PATH}?return_to=${encodeURIComponent(safeReturnTo)}`;
}

function safeRelativeReturnPath(value: string): string {
  if (!value.startsWith('/') || value.startsWith('//')) return '/';

  let url: URL;
  try {
    url = new URL(value, 'https://app.local');
  } catch {
    return '/';
  }
  if (url.origin !== 'https://app.local') return '/';
  if (isReservedAuthPath(url.pathname)) return '/';

  return `${url.pathname}${url.search}${url.hash}`;
}

function isReservedAuthPath(pathname: string): boolean {
  return (
    pathname === SIGN_IN_PATH ||
    pathname === SIGN_OUT_PATH ||
    pathname === CALLBACK_PATH
  );
}

function safeDecodeURIComponent(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}
