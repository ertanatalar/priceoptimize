import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getAccount } from '@/lib/account';
import { execute, mysqlConfigured } from '@/db/mysql';
import { rejectCrossOriginMutation } from '@/lib/request-security';
import { localeJson } from '@/lib/i18n-server';
import { intlLocales, locales } from '../../../i18n-shared/i18n.mjs';
export async function POST(request:Request){
  const rejected=rejectCrossOriginMutation(request);if(rejected)return rejected;
  let body:{locale?:string};try{body=await request.json();}catch{return localeJson(request,{error:'Geçersiz JSON.'},{status:400});}
  if(!body.locale||!locales.includes(body.locale))return localeJson(request,{error:'Dil tercihi kaydedilemedi.'},{status:400});
  const locale=body.locale;
  const user=await getChatGPTUser();
  if(user&&mysqlConfigured()){
    const account=await getAccount(user);
    const tag=intlLocales[locale as keyof typeof intlLocales];
    if(account?.userId)await execute('UPDATE users SET locale=? WHERE id=?',[tag,account.userId]);
    if(account?.scope==='organization'&&account.role==='owner')await execute(`INSERT INTO audit_events(organization_id,actor_user_id,event_type,object_type,object_id,outcome,metadata_json,retention_until) VALUES(?,?,'locale.preference','organization',?,'success',JSON_OBJECT('locale',?),DATE_ADD(CURRENT_TIMESTAMP(3),INTERVAL 1095 DAY))`,[account.organizationId,account.userId,account.organizationId,tag]);
    if(account?.scope==='client'&&account.clientId)await execute(`INSERT INTO audit_events(organization_id,actor_user_id,event_type,object_type,object_id,outcome,metadata_json,retention_until) VALUES(?,NULL,'locale.preference','client',?,'success',JSON_OBJECT('locale',?),DATE_ADD(CURRENT_TIMESTAMP(3),INTERVAL 1095 DAY))`,[account.organizationId,String(account.clientId),tag]);
  }
  const response=localeJson(request,{locale});response.headers.set('Set-Cookie',`po_locale=${locale}; Path=/; Max-Age=31536000; SameSite=Lax${new URL(request.url).protocol==='https:'?'; Secure':''}`);return response;
}
