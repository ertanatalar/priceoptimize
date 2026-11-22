import test from 'node:test';import assert from 'node:assert/strict';
import { composePriceEmail, clientNotificationLocale } from './email-i18n.mjs';
import { locales, translate } from '../shared/i18n.mjs';
test('all seven email languages preserve customer, merchant, price and currency data',()=>{
 for(const locale of locales){const email=composePriceEmail(locale,'Yeni müşteri',['Mağaza: 1200 → 1100 TRY'],{price:1100,currency:'TRY',merchant:'Mağaza'});assert.equal(email.subject,translate(locale,'Rakip fiyat değişikliği: {0}',['Yeni müşteri']));assert.ok(email.text.includes('Yeni müşteri'));assert.ok(email.text.includes('Mağaza'));assert.ok(email.text.includes('TRY'));assert.ok(email.text.includes(translate(locale,'Merhaba,')));}
});
test('recipient locale lookup is scoped by organization and client',async()=>{
 const pool={execute:async(sql,params)=>{assert.deepEqual(params,[7,'org1']);assert.match(sql,/m.organization_id=c.organization_id/);assert.match(sql,/a.organization_id=c.organization_id/);return [[{locale:'de-DE'}]];}};
 assert.equal(await clientNotificationLocale(pool,'org1',7),'de');
});
