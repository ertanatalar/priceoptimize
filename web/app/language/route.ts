import { locales, translate, localeFromRequest } from '../../../shared/i18n.mjs';
export async function GET(request:Request){
  const url=new URL(request.url);const locale=url.searchParams.get('locale')||'tr';
  if(!locales.includes(locale))return Response.json({error:translate(localeFromRequest(request),'Dil tercihi kaydedilemedi.')},{status:400});
  const raw=url.searchParams.get('returnTo')||'/';let path='/';
  if(raw.startsWith('/')&&!raw.startsWith('//')){const parsed=new URL(raw,'https://app.local');if(parsed.origin==='https://app.local')path=parsed.pathname+parsed.search+parsed.hash;}
  const response=new Response(null,{status:303,headers:{Location:new URL(path,process.env.PUBLIC_BASE_URL||url.origin).toString()}});
  response.headers.set('Set-Cookie',`po_locale=${locale}; Path=/; Max-Age=31536000; SameSite=Lax${url.protocol==='https:'?'; Secure':''}`);
  response.headers.set('Cache-Control','private, no-store');return response;
}
