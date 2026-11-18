/** Browser mutation protection; API clients may omit Origin, browsers may not forge it. */
export function rejectCrossOriginMutation(request: Request): Response | null {
  if (request.headers.get('sec-fetch-site') === 'cross-site') {
    return Response.json({ error: 'Geçersiz istek kaynağı.' }, { status: 403 });
  }
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ error: 'Geçersiz istek kaynağı.' }, { status: 403 });
  }
  return null;
}
