// デバッグ出力はタブIDごとのブラウザセッション状態。通常設定・同期には保存しない。
export class TabDebug{
 private pending=new Map<number,Promise<void>>();
 constructor(private storage:{get:(key:string)=>Promise<Record<string,unknown>>;set:(value:Record<string,unknown>)=>Promise<unknown>;remove:(key:string)=>Promise<unknown>},private prefix:string){}
 async get(tabId:number){await this.pending.get(tabId)?.catch(()=>{});return (await this.storage.get(this.prefix+tabId))[this.prefix+tabId]===true;}
 set(tabId:number,enabled:boolean){
  const key=this.prefix+tabId,previous=this.pending.get(tabId)||Promise.resolve();
  const run=previous.catch(()=>{}).then(async()=>{if(enabled)await this.storage.set({[key]:true});else await this.storage.remove(key);});
  this.pending.set(tabId,run);return run.finally(()=>{if(this.pending.get(tabId)===run)this.pending.delete(tabId);});
 }
 forget(tabId:number){return this.set(tabId,false);}
}
