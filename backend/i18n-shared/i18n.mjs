import tr from './locales/tr.json' with { type: 'json' };
import en from './locales/en.json' with { type: 'json' };
import de from './locales/de.json' with { type: 'json' };
import fr from './locales/fr.json' with { type: 'json' };
import it from './locales/it.json' with { type: 'json' };
import es from './locales/es.json' with { type: 'json' };
import pt from './locales/pt.json' with { type: 'json' };
export const locales = ['tr','en','de','fr','it','es','pt'];
export const languageNames = { tr:'Türkçe', en:'English', de:'Deutsch', fr:'Français', it:'Italiano', es:'Español', pt:'Português' };
export const intlLocales = { tr:'tr-TR', en:'en-GB', de:'de-DE', fr:'fr-FR', it:'it-IT', es:'es-ES', pt:'pt-PT' };
export const messages = { tr,en,de,fr,it,es,pt };
export function normalizeLocale(raw, fallback='tr') { const value=String(raw??'').toLowerCase().split(/[-_]/)[0]; return locales.includes(value)?value:fallback; }
export function localeFromRequest(request) {
  const cookie=request.headers.get('cookie')?.match(/(?:^|;\s*)po_locale=([^;]*)/)?.[1];
  if(cookie && locales.includes(cookie)) return cookie;
  const candidates=(request.headers.get('accept-language')||'').split(',').map((part,index)=>{const [tag,...params]=part.trim().split(';');const quality=params.find(p=>p.trim().startsWith('q='));return {tag,q:quality?Number(quality.trim().slice(2)):1,index};}).filter(x=>x.q>0).sort((a,b)=>b.q-a.q||a.index-b.index);
  for(const {tag} of candidates){const locale=normalizeLocale(tag,'');if(locale)return locale;}
  return 'tr';
}
const normalizeText=text=>String(text).replace(/\s+/g,' ').trim();
const escapeRegex=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const templates=Object.keys(tr).filter(key=>/\{\d+\}/.test(key)).map(key=>{
  const parts=key.split(/(\{\d+\})/); const indices=[];
  const regex=new RegExp('^'+parts.map(p=>/^\{\d+\}$/.test(p)?(indices.push(Number(p.slice(1,-1))),'(.+?)'):escapeRegex(p)).join('')+'$');
  return {key,regex,indices};
});
export function translate(locale, text, values=[]) {
  const catalog=messages[normalizeLocale(locale)]; const key=normalizeText(text);
  let translated=Object.hasOwn(catalog,key)?catalog[key]:undefined; let substitutions=values;
  if(translated===undefined && key.length<8192){
    for(const item of templates){const match=key.match(item.regex);if(match){translated=catalog[item.key];substitutions=[];item.indices.forEach((id,i)=>substitutions[id]=match[i+1]);break;}}
  }
  if(translated===undefined) return String(text);
  return translated.replace(/\{(\d+)\}/g,(token,index)=>substitutions[index]===undefined?token:String(substitutions[index]));
}
export function translateErrors(locale, value) {
  if(Array.isArray(value)) return value.map(v=>translateErrors(locale,v));
  if(!value||typeof value!=='object') return value;
  return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,typeof item==='string'&&['error','message','anomalyReason'].includes(key)?translate(locale,item):item&&typeof item==='object'?translateErrors(locale,item):item]));
}
