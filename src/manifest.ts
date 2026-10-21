import {defineManifest} from '@crxjs/vite-plugin';
export default defineManifest({
 manifest_version:3,name:'Y!News Filter Plus',version:'0.1.0',
 description:'Yahoo!ニュースをキーワードとJevによる関連性判定でハイライト・除外。設定をChrome同期。Yahoo! JAPAN非公式。',
 icons:{16:'icons/icon16.png',48:'icons/icon48.png',128:'icons/icon128.png'},
 action:{default_title:'Y!News Filter Plus 設定'},
 options_page:'src/dashboard/index.html',
 background:{service_worker:'src/background/index.ts',type:'module'},
 content_scripts:[{matches:['https://*.yahoo.co.jp/*'],js:['src/content/index.ts'],run_at:'document_idle'}],
 permissions:['storage','alarms','clipboardWrite'],
 host_permissions:['https://*.yahoo.co.jp/*','https://api.typesafe.ai/*']
});
