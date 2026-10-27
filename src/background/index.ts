import {Store} from './store';
import {TabDebug} from './tab-debug';
import {updateToolbarBadge} from './badge';
import {SETTINGS,HISTORY} from '../shared/sync';
import {defaults} from '../shared/settings.js';
import {YAHOO_HOSTS} from '../shared/hosts';
import {AI_LOCAL,connectionOrigin,migrateRetiredAI} from '../shared/ai.js';
import {network} from './network';
const store=new Store();
const tabDebug=new TabDebug(chrome.storage.session,'ynfp_debug:');
const keys=new Set([SETTINGS,HISTORY,AI_LOCAL,'yne_plus_jev_cache_v1','yne_plus_v1']);
const ready=store.queue(async()=>{
 const local=(await chrome.storage.local.get(AI_LOCAL))[AI_LOCAL];
 if(local){const migrated=migrateRetiredAI(local);if(migrated!==local)await chrome.storage.local.set({[AI_LOCAL]:migrated});}
 const cacheKey='yne_plus_jev_cache_v1',cache=(await chrome.storage.local.get(cacheKey))[cacheKey];
 if(cache){const kept=Object.fromEntries(Object.entries(cache).filter(([key])=>{try{return JSON.parse(JSON.parse(key.split('|article-intro-')[0])[1])[0]!=='ollaya';}catch{return true;}}));if(Object.keys(kept).length!==Object.keys(cache).length)await chrome.storage.local.set({[cacheKey]:kept});}
 return store.reconcile();
});
function schedule(){void chrome.alarms.create('sync-retry',{delayInMinutes:0.5});}
chrome.alarms.onAlarm.addListener(a=>{if(a.name==='sync-retry')void store.queue(()=>store.reconcile());});
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='sync'&&Object.keys(changes).some(k=>k.startsWith('ynfp:')))schedule();});
chrome.runtime.onStartup.addListener(()=>{void store.queue(()=>store.reconcile());});
chrome.runtime.onInstalled.addListener(()=>{void chrome.alarms.create('sync-periodic',{periodInMinutes:5});});
chrome.alarms.onAlarm.addListener(a=>{if(a.name==='sync-periodic')void store.queue(()=>store.reconcile());});
chrome.action.onClicked.addListener(tab=>{if(tab.id!==undefined)void chrome.tabs.sendMessage(tab.id,{type:'OPEN_SETTINGS'}).then(r=>{if(!r?.opened)return chrome.runtime.openOptionsPage();}).catch(()=>chrome.runtime.openOptionsPage());else void chrome.runtime.openOptionsPage();});
function allowed(sender:chrome.runtime.MessageSender){
 if(sender.id!==chrome.runtime.id||!sender.url)return false;
 const u=new URL(sender.url);return u.origin===new URL(chrome.runtime.getURL('/')).origin||(u.protocol==='https:'&&YAHOO_HOSTS.includes(u.hostname));
}
async function handle(m:any,sender:chrome.runtime.MessageSender){
 if(m.type==='AI_PERMISSION')return chrome.permissions.request({origins:[connectionOrigin(m.provider)]});
 if(m.type==='BADGE')return updateToolbarBadge(m.count,sender,m.error);
 await ready;
 switch(m.type){
 case 'DEBUG_GET':case 'DEBUG_SET':{
  let tabId=sender.tab?.id;
  if(tabId===undefined&&sender.url?.startsWith(chrome.runtime.getURL(''))&&Number.isInteger(m.tabId))tabId=m.tabId;
  if(tabId===undefined)return {enabled:false,available:false};
  if(m.type==='DEBUG_SET'){if(typeof m.enabled!=='boolean')throw Error('デバッグ設定は真偽値で指定してください');await tabDebug.set(tabId,m.enabled);}
  return {enabled:await tabDebug.get(tabId),available:true};
 }
 case 'GET':if(!keys.has(m.key))throw Error('保存キーが不正です');return (await chrome.storage.local.get(m.key))[m.key]??m.fallback;
 case 'SET':if(!keys.has(m.key)||m.key===SETTINGS||m.key===HISTORY)throw Error('保存キーが不正です');await chrome.storage.local.set({[m.key]:m.value});return null;
 case 'SAVE':await store.queue(async()=>{if(m.reason==='migration'&&JSON.stringify(m.value)===JSON.stringify(defaults)&&!(await chrome.storage.local.get(SETTINGS))[SETTINGS])return;await store.save(m.value,m.reason,m.expected);});schedule();return null;
 case 'SYNC':await store.queue(()=>store.reconcile());return null;
 case 'SYNC_STATUS':{const s=await store.queue(()=>store.state());return {enabled:s.enabled,message:s.message,conflicts:s.conflicts};}
 case 'SYNC_ENABLED':if(typeof m.enabled!=='boolean')throw Error('同期設定が不正です');await store.queue(async()=>{await store.setEnabled(m.enabled);await store.reconcile();});return null;
 case 'RESOLVE':await store.queue(()=>store.resolve(m.doc));return null;
 case 'NETWORK':return network(m);
 case 'REPORT':{if(typeof m.html!=='string'||m.html.length>5_000_000)throw Error('表が大きすぎます');const id=crypto.randomUUID();await chrome.storage.session.set({['report:'+id]:m.html});await chrome.tabs.create({url:chrome.runtime.getURL('src/report/index.html')+'?id='+id});return null;}
 default:throw Error('未対応の操作です');
 }
}
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
 if(!allowed(sender))return false;
 void handle(message,sender).then(value=>respond({ok:true,value}),e=>respond({ok:false,details:{provider:e?.provider,kind:e?.kind,status:e?.status,stop:e?.stop,advice:e?.advice,focusKey:e?.focusKey,scope:e?.scope},error:e?.name==='AbortError'?'timeout':e instanceof Error?e.message:'処理に失敗しました'}));return true;
});

chrome.tabs.onUpdated.addListener((tabId,change)=>{if(change.status==='loading'){void chrome.action.setBadgeText({tabId,text:''}).catch(()=>{});void chrome.action.setTitle({tabId,title:'Y!News Filter Plus'}).catch(()=>{});}});

chrome.tabs.onRemoved.addListener(tabId=>{void tabDebug.forget(tabId).catch(()=>{});});
