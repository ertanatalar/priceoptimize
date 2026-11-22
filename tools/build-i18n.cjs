const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..');
// Render isolates each service root. Keep generated runtime copies inside both.
for(const service of ['web','backend'])fs.cpSync(path.join(root,'shared'),path.join(root,service,'i18n-shared'),{recursive:true});
require('./build-extension-i18n.cjs');
