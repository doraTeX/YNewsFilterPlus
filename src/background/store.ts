import {SETTINGS,HISTORY,parseDoc,newDoc,heads,encodeDoc,decodeRemote,assertQuota,type Doc,type Settings} from '../shared/sync';
import {validate,defaults} from '../shared/settings.js';
const STATE='ynfp_sync_state';
type State={device:string;enabled:boolean;doc:Doc|null;pending:boolean;conflicts:Doc[];localConflictClock?:Doc['clock']|null;message:string};
export class Store{
 private chain=Promise.resolve();
 queue<T>(fn:()=>Promise<T>):Promise<T>{const result=this.chain.then(fn,fn);this.chain=result.then(()=>{},()=>{});return result;}
 async state():Promise<State>{
  const s:State=(await chrome.storage.local.get(STATE))[STATE]??{device:crypto.randomUUID(),enabled:true,doc:null,pending:false,conflicts:[],message:'Chrome同期の確認待ち'};
  // ローカルの同期履歴にも、新しい設定項目の既定値を補う。
  if(s.doc)s.doc=parseDoc(JSON.stringify(s.doc));
  s.conflicts=s.conflicts.map(d=>parseDoc(JSON.stringify(d)));
  return s;
 }
 async status(){
  const s=await this.state(),clock=s.localConflictClock===undefined?s.doc?.clock:s.localConflictClock;
  const conflictSources=s.conflicts.map(doc=>clock&&Object.keys(clock).length===Object.keys(doc.clock).length&&Object.keys(clock).every(key=>clock[key]===doc.clock[key])?'local':'cloud');
  return {enabled:s.enabled,message:s.message,conflicts:s.conflicts,conflictSources};
 }
 async remember(s:State){await chrome.storage.local.set({[STATE]:s});}
 async history(next:Settings,reason:string){
  const data=await chrome.storage.local.get([SETTINGS,HISTORY]),old=data[SETTINGS];
  if(!old||JSON.stringify(old)===JSON.stringify(next))return;
  const history=data[HISTORY]||[],last=history[0],now=Date.now();
  // 連続編集では開始前の設定を残し、最終編集時刻だけ更新する。
  // 時刻は永続化し、サービスワーカーが再起動しても同じまとまりとして扱う。
  const elapsed=now-(last?.lastChanged??last?.time);
  const grouped=['editor-save','chrome-sync'].includes(reason)&&last?.reason===reason&&elapsed>=0&&elapsed<5*60*1000;
  const entries=grouped?[{...last,lastChanged:now},...history.slice(1)]:[{time:now,lastChanged:now,reason,settings:old},...history];
  await chrome.storage.local.set({[HISTORY]:entries.slice(0,10)});
 }

 async save(value:unknown,reason:string,expected?:unknown){
  const settings=validate(value),current=(await chrome.storage.local.get(SETTINGS))[SETTINGS];
  if(expected!==undefined&&JSON.stringify(validate(current??defaults))!==JSON.stringify(validate(expected)))throw Error('別の画面で設定が更新されました。設定を開き直してください');
  if(JSON.stringify(current)===JSON.stringify(settings))return;
  const s=await this.state();await this.history(settings,reason);
  // 競合している他端末の版は、明示解決までは時計に取り込まない。
  s.doc=newDoc(settings,s.device,s.doc?[s.doc]:[]);s.pending=true;s.message='端末に保存しました。Chrome同期を待っています';
  await chrome.storage.local.set({[SETTINGS]:settings,[STATE]:s});
 }
 async reconcile(){
  const s=await this.state();await this.remember(s);if(!s.enabled)return;
  try{
   const all=await chrome.storage.sync.get(null),remote=await decodeRemote(all);
   if(s.pending&&s.doc){
    const items=await encodeDoc(s.doc,s.device),prefix='ynfp:'+s.device+':';
    const future={...all,...items};for(const k of Object.keys(future))if(k.startsWith(prefix)&&!(k in items))delete future[k];
    assertQuota(future);await chrome.storage.sync.set(items);
    const stale=Object.keys(all).filter(k=>k.startsWith(prefix)&&!(k in items));if(stale.length)await chrome.storage.sync.remove(stale);
    s.pending=false;
   }
   const candidates=heads([...remote,...(s.doc?[s.doc]:[])]);
   if(new Set(candidates.map(d=>JSON.stringify(d.settings))).size>1){s.conflicts=candidates;s.localConflictClock=s.doc?{...s.doc.clock}:null;s.message='設定が競合しています。内容を比較して採用する設定を選んでください';}
   else if(candidates.length){
    const chosen=candidates[0];s.conflicts=[];s.localConflictClock=null;
    // 同内容の並行更新は時計を結合する。次の編集時に全てを継承。
    const clock:Record<string,number>={};for(const d of candidates)for(const[k,v]of Object.entries(d.clock))clock[k]=Math.max(clock[k]||0,v);
    s.doc={...chosen,clock};await this.history(chosen.settings,'chrome-sync');await chrome.storage.local.set({[SETTINGS]:chosen.settings});
    s.message='Chrome同期領域と一致 · '+new Date().toLocaleTimeString()+'（他端末への到着はChromeの同期状態に依存）';
   }else s.message='Chrome同期は有効です。設定の入力を待っています';
   await this.remember(s);
  }catch(e){s.message=e instanceof Error?e.message:String(e);await this.remember(s);}
 }
 async setEnabled(enabled:boolean){const s=await this.state();s.enabled=enabled;s.message=enabled?'Chrome同期を確認しています':'Chrome同期は停止中です';await this.remember(s);}
 async resolve(value:unknown){
  const chosen=parseDoc(JSON.stringify(value)),s=await this.state();
  const remote=await decodeRemote(await chrome.storage.sync.get(null));const current=heads([...remote,...(s.doc?[s.doc]:[])]);
  if(JSON.stringify(current.map(doc=>JSON.stringify(doc)).sort())!==JSON.stringify(s.conflicts.map(doc=>JSON.stringify(doc)).sort()))throw Error('競合内容が変わりました。同期を確認して選び直してください');
  if(!current.some(d=>JSON.stringify(d)===JSON.stringify(chosen)))throw Error('選択された設定が見つかりません');
  await this.history(chosen.settings,'conflict-resolution');s.doc=newDoc(chosen.settings,s.device,current);s.pending=true;s.conflicts=[];s.localConflictClock=null;
  await chrome.storage.local.set({[SETTINGS]:chosen.settings,[STATE]:s});await this.reconcile();
 }
}
