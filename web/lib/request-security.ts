import { translate, localeFromRequest } from '../../shared/i18n.mjs';
/** Browser mutation protection; API clients may omit Origin, browsers may not forge it. */
export function rejectCrossOriginMutation(request: Request): Response | null {
  if (request.headers.get('sec-fetch-site') === 'cross-site') {
    return Response.json({ error: translate(localeFromRequest(request), 'Geçersiz istek kaynağı.') }, { status: 403 });
  }
  const origin = request.headers.get('origin');
  if (origin) {
    // A reverse proxy may expose an internal HTTP URL to the application.
    // Trust the configured public address, never client-controlled proxy headers.
    let expectedOrigin: string;
    try {
      const publicUrl = new URL(process.env.PUBLIC_BASE_URL || request.url);
      if (!['https:', 'http:'].includes(publicUrl.protocol) || publicUrl.username || publicUrl.password) {
        throw new Error('Invalid public URL');
      }
      expectedOrigin = publicUrl.origin;
    } catch {
      return Response.json({ error: translate(localeFromRequest(request), 'Geçersiz istek kaynağı.') }, { status: 403 });
    }
    if (origin !== expectedOrigin) {
      return Response.json({ error: translate(localeFromRequest(request), 'Geçersiz istek kaynağı.') }, { status: 403 });
    }
  }
  return null;
}
