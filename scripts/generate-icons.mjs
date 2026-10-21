// 手動編集した128px版を原本として保持し、小さいサイズだけを生成する。
// 原本: public/icons/icon128.png（ビルド出力の dist 内では編集しない）。
import {copyFileSync, mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const icons=join(root,'public','icons');
const source=join(icons,'icon128.png');
for(const size of [16,48]){
 const output=join(icons,`icon${size}.png`);
 const result=spawnSync('sips',['--resampleHeightWidth',String(size),String(size),source,'--out',output],{encoding:'utf8'});
 if(result.error)throw result.error;
 if(result.status!==0)throw Error(result.stderr||result.stdout);
 console.log(`生成: ${output}`);
}
const store=join(root,'store-assets');
mkdirSync(store,{recursive:true});
copyFileSync(source,join(store,'icon-128.png'));
console.log('ストア用128px版は原本をそのままコピーしました。');
