import {defineManifest} from '@crxjs/vite-plugin';
import {YAHOO_HOSTS} from './shared/hosts';
const yahooMatches=YAHOO_HOSTS.map(h=>`https://${h}/*`);
export default defineManifest({
 manifest_version:3,name:'Y!News Filter Plus',version:'0.1.2',
 description:'Yahoo!ニュースの記事を、キーワード、またはJevによる関連性判定によってハイライト・除外します。Yahoo! JAPAN非公式の拡張です。',
 homepage_url:'https://github.com/doraTeX/YNewsFilterPlus',
 minimum_chrome_version:'110', // chrome.action.setBadgeTextColor が110以降
 icons:{16:'icons/icon16.png',48:'icons/icon48.png',128:'icons/icon128.png'},
 action:{default_title:'Y!News Filter Plus 設定'},
 options_page:'src/dashboard/index.html',
 background:{service_worker:'src/background/index.ts',type:'module'},
 content_scripts:[{matches:yahooMatches,js:['src/content/index.ts'],run_at:'document_idle'}],
 permissions:['storage','alarms','clipboardWrite'],
 host_permissions:[...yahooMatches,'https://api.typesafe.ai/*']
});
