export async function verifyPaddleSignature(
  rawBody: string,
  signatureHeader: string | null,
  nowSeconds = Math.floor(Date.now() / 1000),
) {
  const secret = process.env.PADDLE_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return false;
  const values = new Map<string, string[]>();
  for (const part of signatureHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 1) continue;
    const key = part.slice(0, separator);
    const value = part.slice(separator + 1);
    values.set(key, [...(values.get(key) ?? []), value]);
  }
  const timestamp = values.get('ts')?.[0];
  const signatures = values.get('h1') ?? [];
  if (!timestamp || !signatures.length || !/^\d+$/.test(timestamp))
    return false;
  // Paddle SDKs use five seconds by default. A 30-second window tolerates
  // ordinary server clock skew while still preventing replay attempts.
  if (Math.abs(nowSeconds - Number(timestamp)) > 30) return false;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const expected = new Uint8Array(
    await crypto.subtle.sign(
      'HMAC',
      key,
      new TextEncoder().encode(`${timestamp}:${rawBody}`),
    ),
  );
  return signatures.some((candidate) =>
    constantTimeHexEqual(expected, candidate),
  );
}

function constantTimeHexEqual(expected: Uint8Array, candidate: string) {
  if (!/^[a-f\d]{64}$/i.test(candidate)) return false;
  const actual = Uint8Array.from(candidate.match(/.{2}/g)!, (byte) =>
    Number.parseInt(byte, 16),
  );
  if (actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1)
    difference |= expected[index] ^ actual[index];
  return difference === 0;
}
