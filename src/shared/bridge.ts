async function call(type:string,values:Record<string,unknown>={}){
 const r=await chrome.runtime.sendMessage({type,...values});if(!r?.ok)throw Error(r?.error||'拡張機能との接続が切れました。ページを再読み込みしてください');return r.value;
}
const menus=new Map<string,()=>void>();
export const GM={
 getValue:(key:string,fallback:unknown)=>call('GET',{key,fallback}),
 setValue:(key:string,value:unknown)=>call('SET',{key,value}),
 registerMenuCommand:async(name:string,fn:()=>void)=>{menus.set(name,fn);},
 setClipboard:async(text:string)=>{await navigator.clipboard.writeText(text);},
 xmlHttpRequest:(r:any)=>{void call('NETWORK',{request:{method:r.method,url:r.url,data:r.data,timeout:r.timeout}}).then(value=>r.onload?.(value),e=>e.message==='timeout'?r.ontimeout?.():r.onerror?.(e));}
};
export const bridge={
 saveSettings:(value:unknown,reason:string,expected?:unknown)=>call('SAVE',{value,reason,expected}),
 sync:()=>call('SYNC'),syncStatus:()=>call('SYNC_STATUS'),setSyncEnabled:(enabled:boolean)=>call('SYNC_ENABLED',{enabled}),
 resolve:(doc:unknown)=>call('RESOLVE',{doc}),openReport:(html:string)=>call('REPORT',{html}),
 onSettingsChanged:(fn:()=>void)=>chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.yne_plus_settings_v2)fn();})
};
chrome.runtime.onMessage.addListener((m,_sender,respond)=>{if(m.type==='OPEN_SETTINGS'){const open=menus.get('Y!News Filter Plus 設定');open?.();respond({opened:!!open});}});
