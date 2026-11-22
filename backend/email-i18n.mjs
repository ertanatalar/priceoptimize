import { translate, normalizeLocale, intlLocales } from './i18n-shared/i18n.mjs';
export async function clientNotificationLocale(pool, organizationId, clientId) {
  const [[row]] = await pool.execute(`SELECT COALESCE(
    (SELECT JSON_UNQUOTE(JSON_EXTRACT(a.metadata_json,'$.locale')) FROM audit_events a WHERE a.organization_id=c.organization_id AND a.event_type='locale.preference' AND a.object_type='client' AND a.object_id=CAST(c.id AS CHAR) ORDER BY a.occurred_at DESC,a.id DESC LIMIT 1),
    (SELECT u.locale FROM users u JOIN organization_memberships m ON m.user_id=u.id AND m.organization_id=c.organization_id WHERE LOWER(u.email)=LOWER(c.notification_email) AND u.status='active' AND u.email_verified_at IS NOT NULL ORDER BY u.last_login_at DESC LIMIT 1),
    org.default_locale,'tr-TR') AS locale
    FROM clients c JOIN organizations org ON org.id=c.organization_id
    WHERE c.id=? AND c.organization_id=? AND c.active=TRUE AND c.deleted_at IS NULL LIMIT 1`,[clientId,organizationId]);
  return normalizeLocale(row?.locale);
}
export function composePriceEmail(locale, clientName, changes, best) {
  const t=(key,values=[])=>translate(locale,key,values);
  const number=value=>new Intl.NumberFormat(intlLocales[normalizeLocale(locale)],{maximumFractionDigits:2}).format(Number(value));
  const change=item=>{const m=String(item).match(/^(.*): ([0-9.]+) → ([0-9.]+) ([A-Z]{3})(;.*)?$/);return m?t(m[5]?'{0}: {1} → {2} {3}; aşırı düşüş filtresine takıldı':'{0}: {1} → {2} {3}',[m[1],number(m[2]),number(m[3]),m[4]]):t(item);};
  let text=t('Merhaba,')+'\n\n'+t('{0} için rakip fiyat takibinde değişiklik tespit edildi:',[clientName])+'\n\n'+changes.map(item=>'- '+change(item)).join('\n');
  if(best)text+='\n\n'+t('En iyi geçerli fiyat: {0} {1} ({2})',[number(best.price),best.currency,best.merchant]);
  text+='\n\n'+t('%25 veya üzerindeki aşırı düşüşler en iyi fiyat hesabına dahil edilmez.');
  return {subject:t('Rakip fiyat değişikliği: {0}',[clientName]),text};
}
