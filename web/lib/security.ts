export async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function uuid() {
  return crypto.randomUUID();
}

export const PRIVACY_VERSION = '2026-09-07';
export const TERMS_VERSION = '2026-09-07';
