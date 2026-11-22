import { cookies, headers } from 'next/headers';
import { localeFromRequest, normalizeLocale, translate, translateErrors } from '../../shared/i18n.mjs';
export async function getTranslator() {
  const cookieStore=await cookies();
  const requestHeaders=await headers();
  const locale=normalizeLocale(cookieStore.get('po_locale')?.value, '')||localeFromRequest(new Request('https://app.local',{headers:requestHeaders}));
  return {locale,t:(text:string,values:unknown[]=[])=>translate(locale,text,values)};
}
export function localeJson(request:Request,payload:unknown,init?:ResponseInit) {
  const response=Response.json(translateErrors(localeFromRequest(request),payload),init);
  response.headers.set('Cache-Control','private, no-store');
  response.headers.set('Vary','Cookie, Accept-Language');
  return response;
}
