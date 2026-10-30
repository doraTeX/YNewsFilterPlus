// ツールバーから、表示中の設定専用タブだけを開き直す。
export async function openExistingSettingsPage(tab:{id?:number;url?:string}){
 if(tab.id===undefined||!tab.url)return false;
 try{
  const current=new URL(tab.url),expected=new URL(chrome.runtime.getURL('src/dashboard/index.html'));
  if(current.protocol!==expected.protocol||current.host!==expected.host||current.pathname!==expected.pathname||current.searchParams.has('embedded'))return false;
  return (await chrome.runtime.sendMessage({type:'OPEN_SETTINGS_PAGE',tabId:tab.id}))?.opened===true;
 }catch{return false;}
}
export async function listenForSettingsOpen(open:()=>void){
 try{
  if(typeof chrome==='undefined'||!chrome.runtime?.onMessage?.addListener||!chrome.tabs?.getCurrent)return ()=>{};
  const tabId=(await chrome.tabs.getCurrent())?.id;if(tabId===undefined)return ()=>{};
  const event=chrome.runtime.onMessage,id=chrome.runtime.id;
  const listener=(message:any,sender:chrome.runtime.MessageSender,respond:(value:unknown)=>void)=>{
   if(message?.type!=='OPEN_SETTINGS_PAGE'||message.tabId!==tabId||sender.id!==id)return false;
   open();respond({opened:true});return false;
  };
  event.addListener(listener);return ()=>{try{event.removeListener(listener);}catch{}};
 }catch{return ()=>{};}
}
