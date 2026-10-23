import {mkdirSync,rmSync,readFileSync,writeFileSync,readdirSync,statSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
const pkg=JSON.parse(readFileSync('package.json','utf8'));
const dist=resolve(process.argv[2]||'dist'),release=resolve('release');mkdirSync(release,{recursive:true});
const zip=join(release,`ynews-filter-plus-${pkg.version}.zip`);
const manifest=JSON.parse(readFileSync(join(dist,'manifest.json'),'utf8'));
if(manifest.name!=='Y!News Filter Plus'||manifest.version!==pkg.version)throw Error('名前・バージョンが一致しません');
function walk(dir){return readdirSync(dir).flatMap(n=>{const f=join(dir,n);return statSync(f).isDirectory()?walk(f):[f];});}
for(const f of walk(dist)){
 if(!/\.(?:js|html|json|txt)$/.test(f))continue;
 const text=readFileSync(f,'utf8');
 if(/github_pat_[A-Za-z0-9_]+|gh[pousr]_[A-Za-z0-9]+|\/Users\/|api\.github\.com|gist\.github\.com/.test(text))throw Error('配布物に不要な接続先・個人情報の候補があります: '+f);
}
rmSync(zip,{force:true});execFileSync('zip',['-qr',zip,'.','-x','*.DS_Store'],{cwd:dist});
writeFileSync(zip+'.sha256',createHash('sha256').update(readFileSync(zip)).digest('hex')+'  '+zip.split('/').pop()+'\n');
console.log('配布ZIPを作成しました: '+zip);
