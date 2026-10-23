const disconnectedMessage='拡張機能が更新または再読み込みされました。このページを再読み込みしてください。';
let disconnected=false;
function invalidate(){
 disconnected=true;
 if(document.getElementById('ynfp-reload-notice'))return;
 const notice=document.createElement('div');notice.id='ynfp-reload-notice';notice.setAttribute('role','alert');
 notice.style.cssText='position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483647;background:#fff3bf;color:#172b42;padding:12px 18px;border:1px solid #b58b00;border-radius:8px;font:14px/1.6 system-ui;box-shadow:0 2px 12px #0003';
 notice.textContent=disconnectedMessage;
 (document.body||document.documentElement).append(notice);
}
function isConnected(){
 if(disconnected)return false;
 try{if(chrome.runtime.id)return true;}catch{}
 invalidate();return false;
}
async function call(type:string,values:Record<string,unknown>={}){
 if(!isConnected())throw Error(disconnectedMessage);
 try{
  const r=await chrome.runtime.sendMessage({type,...values});
  if(!r?.ok)throw Object.assign(Error(r?.error||'拡張機能との接続が切れました。ページを再読み込みしてください'),r?.details||{});return r.value;
 }catch(e){
  if(/Extension context invalidated/i.test(String(e))||!isConnected()){invalidate();throw Error(disconnectedMessage);}
  throw e;
 }
}
const menus=new Map<string,()=>void>();
export const GM={
 getValue:(key:string,fallback:unknown)=>call('GET',{key,fallback}),
 setValue:(key:string,value:unknown)=>call('SET',{key,value}),
 registerMenuCommand:async(name:string,fn:()=>void)=>{menus.set(name,fn);},
 setClipboard:async(text:string)=>{await navigator.clipboard.writeText(text);},
 xmlHttpRequest:(r:any)=>{void call('NETWORK',{request:{method:r.method,url:r.url,data:r.data,timeout:r.timeout,connection:r.connection}}).then(value=>r.onload?.(value),e=>e.message==='timeout'?r.ontimeout?.():r.onerror?.(e));}
};
export const bridge={
 isConnected,
 requestAIOrigin:(provider:string,baseUrl:string)=>call('AI_PERMISSION',{provider,baseUrl}),
 listAIModels:(baseUrl:string)=>call('AI_MODELS',{baseUrl}),
 updateBadge:(count:number,error='')=>call('BADGE',{count,error}),
 saveSettings:(value:unknown,reason:string,expected?:unknown)=>call('SAVE',{value,reason,expected}),
 sync:()=>call('SYNC'),syncStatus:()=>call('SYNC_STATUS'),setSyncEnabled:(enabled:boolean)=>call('SYNC_ENABLED',{enabled}),
 resolve:(doc:unknown)=>call('RESOLVE',{doc}),openReport:(html:string)=>call('REPORT',{html}),
 onSettingsChanged:(fn:()=>void)=>chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&(changes.yne_plus_settings_v2||changes.yne_plus_jev_local_v1))fn();})
};
chrome.runtime.onMessage.addListener((m,_sender,respond)=>{if(m.type==='OPEN_SETTINGS'){const open=menus.get('Y!News Filter Plus 設定');open?.();respond({opened:!!open});}});
