const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');const ts=require('typescript');
const i18n=require('../../shared/i18n.mjs');
const root=path.resolve(__dirname,'..');
function load(file,mocks={}){const source=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const module={exports:{}};vm.runInNewContext(source,{module,exports:module.exports,require:name=>{if(name in mocks)return mocks[name];if(name.endsWith('shared/i18n.mjs'))return i18n;throw Error('Unexpected import '+name);},Request,Response,Headers,URL,process:{env:{}},console});return module.exports;}
const localeResponse=(request,body,init)=>Response.json(i18n.translateErrors(i18n.localeFromRequest(request),body),init);
function localeHarness(account=null){const writes=[];const policy=load('lib/request-security.ts');return {writes,route:load('app/api/locale/route.ts',{
 '@/lib/request-security':policy,'@/lib/i18n-server':{localeJson:localeResponse},
 '@/app/chatgpt-auth':{getChatGPTUser:async()=>account?{}:null},'@/lib/account':{getAccount:async()=>account},
 '@/db/mysql':{mysqlConfigured:()=>true,execute:async(sql,params)=>writes.push({sql,params})},
})};}
const preferenceRequest=(locale,headers={})=>new Request('https://app.test/api/locale',{method:'POST',headers:{'content-type':'application/json',origin:'https://app.test',...headers},body:JSON.stringify({locale,organizationId:'foreign-org'})});
test('all seven catalogs are complete and preserve indexed placeholders',()=>{
 const keys=Object.keys(i18n.messages.tr).sort();
 for(const locale of i18n.locales){const messages=i18n.messages[locale];assert.deepEqual(Object.keys(messages).sort(),keys);for(const key of keys){assert.equal(typeof messages[key],'string');assert.ok(messages[key].trim());assert.deepEqual((messages[key].match(/\{\d+\}/g)||[]).sort(),(key.match(/\{\d+\}/g)||[]).sort(),locale+': '+key);}}
});
test('cookie preference wins; regional languages and Accept-Language weights resolve safely',()=>{
 assert.equal(i18n.localeFromRequest(new Request('https://app.test',{headers:{cookie:'po_locale=fr','accept-language':'de-DE,de;q=0.9'}})),'fr');
 assert.equal(i18n.localeFromRequest(new Request('https://app.test',{headers:{'accept-language':'ja;q=1,pt-BR;q=0.8,en;q=0.2'}})),'pt');
 assert.equal(i18n.localeFromRequest(new Request('https://app.test',{headers:{cookie:'po_locale=../../evil','accept-language':'en;q=0,de;q=0.5'}})),'de');
 assert.equal(i18n.normalizeLocale('__proto__'),'tr');
});
test('error localization preserves currency, user names and all arbitrary user data',()=>{
 const name='Yeni müşteri';assert.ok(i18n.translate('de','{0} müşterisini sil',[name]).includes(name));
 const result=i18n.translateErrors('en',{error:'Geçersiz istek kaynağı.',productName:'Yeni müşteri',merchant:'Fiyatlandırma',currency:'TRY'});
 assert.notEqual(result.error,'Geçersiz istek kaynağı.');assert.equal(result.productName,name);assert.equal(result.merchant,'Fiyatlandırma');assert.equal(result.currency,'TRY');
 assert.equal(i18n.translate('en','__proto__'),'__proto__');
 assert.ok(i18n.translate('de','Paketiniz en fazla 50 aktif rakip link içerir. İçe aktarma kaydedilmedi; mevcut linklerinizi azaltın.').includes('50'));
});
test('anonymous language selection sets only a validated long-lived locale cookie',async()=>{
 const h=localeHarness();for(const locale of i18n.locales){const response=await h.route.POST(preferenceRequest(locale));assert.equal(response.status,200);assert.match(response.headers.get('set-cookie'),new RegExp('po_locale='+locale+';'));assert.match(response.headers.get('set-cookie'),/SameSite=Lax; Secure/);}
 assert.equal(h.writes.length,0);assert.equal((await h.route.POST(preferenceRequest('xx'))).status,400);assert.equal((await h.route.POST(preferenceRequest('de',{origin:'https://evil.test'}))).status,403);
});
test('owner preferences update only the authenticated user and organization',async()=>{
 const h=localeHarness({scope:'organization',role:'owner',userId:'u1',organizationId:'org1'});assert.equal((await h.route.POST(preferenceRequest('it'))).status,200);assert.equal(h.writes.length,2);assert.deepEqual(h.writes.map(w=>Array.from(w.params)),[['it-IT','u1'],['it-IT','org1']]);
 const member=localeHarness({scope:'organization',role:'analyst',userId:'u2',organizationId:'org1'});await member.route.POST(preferenceRequest('es'));assert.equal(member.writes.length,1);assert.match(member.writes[0].sql,/UPDATE users/);
});
test('portal recipient language cannot update organization or other client preferences',async()=>{
 const h=localeHarness({scope:'client',role:'viewer',userId:null,organizationId:'org1',clientId:7});await h.route.POST(preferenceRequest('pt'));assert.equal(h.writes.length,1);assert.match(h.writes[0].sql,/INSERT INTO audit_events/);assert.deepEqual(Array.from(h.writes[0].params),['org1','7','pt-PT']);
});
test('language redirect cannot send a visitor to a third-party origin',async()=>{
 const route=load('app/language/route.ts');for(const returnTo of ['https://evil.test','//evil.test','/\\evil.test']){const response=await route.GET(new Request('https://app.test/language?locale=de&returnTo='+encodeURIComponent(returnTo)));assert.equal(response.headers.get('location'),'https://app.test/');}
 const response=await route.GET(new Request('https://app.test/language?locale=fr&returnTo=%2Fpricing'));assert.equal(response.headers.get('location'),'https://app.test/pricing');assert.match(response.headers.get('set-cookie'),/po_locale=fr/);
});
test('server translators remain request-local with no shared mutable locale',async()=>{
 const make=locale=>load('lib/i18n-server.ts',{'next/headers':{cookies:async()=>({get:()=>({value:locale})}),headers:async()=>new Headers()}}).getTranslator();
 const [de,fr]=await Promise.all([make('de'),make('fr')]);assert.equal(de.t('Fiyatlandırma'),i18n.messages.de.Fiyatlandırma);assert.equal(fr.t('Fiyatlandırma'),i18n.messages.fr.Fiyatlandırma);assert.notEqual(de.t('Fiyatlandırma'),fr.t('Fiyatlandırma'));
});
test('extension uses the same catalogs and injected page readers stay self-contained',()=>{
 const file=path.join(root,'public/price-optimizer-browser-extension/i18n.js');const extension=vm.runInNewContext(fs.readFileSync(file,'utf8')+'; PO_I18N;',{navigator:{language:'en-US'}});
 for(const locale of i18n.locales){extension.setLocale(locale);for(const key of Object.keys(i18n.messages.tr))assert.equal(extension.t(key),i18n.translate(locale,key));}
 for(const script of ['popup.js','background.js']){const source=fs.readFileSync(path.join(root,'public/price-optimizer-browser-extension',script),'utf8');const ast=ts.createSourceFile(script,source,ts.ScriptTarget.Latest,true);const extractor=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='extractPageOffer');assert.ok(extractor);assert.doesNotMatch(extractor.getText(ast),/\bPO_I18N\b|\bt\(/);}
});
test('public pages, dashboard and capture contain no untranslated Turkish JSX text or labels',()=>{
 function list(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?list(path.join(dir,e.name)):e.name.endsWith('.tsx')?[path.join(dir,e.name)]:[]);}
 for(const file of [...list(path.join(root,'app')),path.join(root,'components/public-site.tsx')]){const source=fs.readFileSync(file,'utf8');const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);function walk(node){if(ts.isJsxText(node))assert.doesNotMatch(node.text,/[çğıöşüÇĞİÖŞÜ]/,file);if(ts.isJsxAttribute(node)&&node.initializer&&ts.isStringLiteral(node.initializer)&&['title','intro','label','detail','description','placeholder','aria-label','alt'].includes(node.name.getText(ast)))assert.doesNotMatch(node.initializer.text,/[çğıöşüÇĞİÖŞÜ]/,file+': '+node.getText(ast));ts.forEachChild(node,walk);}walk(ast);}
});
