import {beforeEach,describe,it,expect,vi} from 'vitest';
import {webcrypto} from 'node:crypto';
import {defaults,validate,normalize} from '../src/shared/settings.js';
import {newDoc,heads,encodeDoc,decodeRemote,digest,assertQuota,SETTINGS,HISTORY} from '../src/shared/sync';
import {Store} from '../src/background/store';
let local:Record<string,any>,remote:Record<string,any>;
function area(data:()=>Record<string,any>){return {get:async(key:any)=>{const d=data();if(key===null)return structuredClone(d);const ks=typeof key==='string'?[key]:key;return structuredClone(Object.fromEntries(ks.filter((k:string)=>k in d).map((k:string)=>[k,d[k]])));},set:async(value:any)=>Object.assign(data(),structuredClone(value)),remove:async(keys:string[])=>{for(const k of keys)delete data()[k];}};}
beforeEach(()=>{local={};remote={};vi.stubGlobal('crypto',webcrypto);vi.stubGlobal('chrome',{storage:{local:area(()=>local),sync:area(()=>remote)}});});
const settings=(word:string)=>validate({...defaults,rows:[word]});
describe('移行と個人情報',()=>{
 it('読み込んだ全設定を保持し認証情報を破棄',()=>{const input={...defaults,rows:['ABC'],aiConditions:['スポーツ'],aiInterests:['科学'],aiEnabled:true,aiThreshold:.8,aiConcurrency:5,token:'SECRET',key:'SECRET',gist:'SECRET'};const next=validate(input);expect(next.aiConcurrency).toBe(5);expect(next.aiEnabled).toBe(true);expect(next.aiThreshold).toBe(.8);expect(JSON.stringify(next)).not.toContain('SECRET');});
 it('中黒・全角・ダイアクリティカルマークを同一視',()=>expect(normalize('Ｃａｆé・Ａ',defaults,false)).toBe('cafea'));
 it('不正な設定を拒否',()=>expect(()=>validate({...defaults,aiThreshold:3})).toThrow());
});
describe('Chrome同期',()=>{
 it('日本語・エスケープ文字を分割し検証して復元',async()=>{const d=newDoc(settings('文\\"'.repeat(5000)),'a',[]),items=await encodeDoc(d,'a');assertQuota(items);expect(await decodeRemote(items)).toEqual([d]);});
 it('一部到着・改変を拒否',async()=>{const items=await encodeDoc(newDoc(settings('x'),'a',[]),'a');items['ynfp:a:0']='broken';await expect(decodeRemote(items)).rejects.toThrow('到着待ち');});
 it('初回端末は空の設定を送信せずクラウドを取り込む',async()=>{const d=newDoc(settings('remote'),'b',[]);remote=await encodeDoc(d,'b');await new Store().reconcile();expect(local[SETTINGS].rows).toEqual(['remote']);expect(Object.keys(remote)).toEqual(Object.keys(await encodeDoc(d,'b')));});
 it('競合は自動上書きせず残す',async()=>{const store=new Store();await store.save(settings('local'),'edit');remote=await encodeDoc(newDoc(settings('remote'),'b',[]),'b');await store.reconcile();expect((await store.state()).conflicts).toHaveLength(2);expect(local[SETTINGS].rows).toEqual(['local']);});
 it('選択した競合解決が他端末でも単一の最新版になる',async()=>{const store=new Store();await store.save(settings('local'),'edit');remote=await encodeDoc(newDoc(settings('remote'),'b',[]),'b');await store.reconcile();const s=await store.state();await store.resolve(s.conflicts.find(d=>d.settings.rows[0]==='remote'));expect(local[SETTINGS].rows).toEqual(['remote']);expect(heads(await decodeRemote(remote))).toHaveLength(1);expect(local[HISTORY][0].settings.rows).toEqual(['local']);});
 it('古い編集画面による上書きを拒否',async()=>{const store=new Store();await store.save(settings('a'),'edit');await expect(store.save(settings('b'),'edit',defaults)).rejects.toThrow('別の画面');});
 it('容量超過でもローカル設定と再送予定を保持',async()=>{const store=new Store();await store.save(settings('長'.repeat(40000)),'edit');await store.reconcile();expect(local[SETTINGS].rows[0]).toHaveLength(40000);expect((await store.state()).pending).toBe(true);expect((await store.state()).message).toContain('容量');expect(remote).toEqual({});});
 it('同期停止中は送信しない',async()=>{const store=new Store();await store.setEnabled(false);await store.save(settings('local'),'edit');await store.reconcile();expect(remote).toEqual({});});
 it('APIキーとキャッシュを同期しない',async()=>{local.yne_plus_jev_local_v1={key:'PRIVATE'};local.yne_plus_jev_cache_v1={text:'PRIVATE'};const store=new Store();await store.save(settings('public-setting'),'edit');await store.reconcile();expect(JSON.stringify(remote)).not.toContain('PRIVATE');});
 it('破損したクラウドにローカルを書き戻さない',async()=>{const store=new Store();await store.save(settings('keep'),'edit');remote={'ynfp:b:meta':{count:1,hash:'invalid'}};await store.reconcile();expect(local[SETTINGS].rows).toEqual(['keep']);expect(Object.keys(remote)).toHaveLength(1);});
});

it('ハイライト色をChrome同期し、旧設定には黄色を補う',async()=>{
 const {aiHighlightColor:_,...old}=defaults;
 expect(validate(old).aiHighlightColor).toBe('#fff3bf');
 expect(()=>validate({...defaults,aiHighlightColor:'red;display:none'})).toThrow();
 const store=new Store();
 await store.save(validate({...defaults,aiHighlightColor:'#D9F2F5'}),'edit');
 await store.reconcile();
 const docs=await decodeRemote(remote);
 expect(docs[0].settings.aiHighlightColor).toBe('#d9f2f5');
 local={};
 const second=new Store();
 await second.reconcile();
 expect(local[SETTINGS].aiHighlightColor).toBe('#d9f2f5');
});

it('旧設定に新しい既定値を補った編集でも進捗表示を保存できる',async()=>{
 const {aiHighlightColor:_,...old}=defaults;
 local[SETTINGS]={...old,aiShowProgress:false};
 const store=new Store();
 const baseline=validate(local[SETTINGS]);
 await store.save({...baseline,aiShowProgress:true},'editor-save',baseline);
 expect(local[SETTINGS].aiShowProgress).toBe(true);
});

it('すべての設定項目が保存・同期・別端末復元で維持される',async()=>{
 const changed=validate({version:1,rows:['一般語'],enabled:false,showPageChip:false,ignoreCase:false,normalization:'legacy',ignoreSeparators:true,legacyRate:true,aiConditions:['歴史'],aiInterests:['科学'],aiThreshold:.75,aiHighlightColor:'#ab12cd',aiEnabled:true,aiBodyEnabled:true,aiBodyLow:.2,aiDebug:true,aiShowProgress:false,aiConcurrency:8,aiRequestLimit:321});
 expect(Object.keys(changed).sort()).toEqual(Object.keys(defaults).sort());
 const store=new Store();await store.save(changed,'edit');await store.reconcile();
 expect(local[SETTINGS]).toEqual(changed);
 local={};await new Store().reconcile();expect(local[SETTINGS]).toEqual(changed);
});
it('旧形式のローカル同期履歴と同じクラウド設定を競合と誤認しない',async()=>{
 const store=new Store();await store.save(settings('維持'),'edit');await store.reconcile();
 delete local.ynfp_sync_state.doc.settings.aiHighlightColor;
 await store.reconcile();expect((await store.state()).conflicts).toEqual([]);
 expect(local[SETTINGS].rows).toEqual(['維持']);
});
it('同期通信の失敗後も保存した内容を保持して再送できる',async()=>{
 const store=new Store();await store.save(settings('新しい設定'),'edit');
 const send=vi.spyOn(chrome.storage.sync,'set').mockRejectedValueOnce(new Error('通信失敗'));
 await store.reconcile();expect((await store.state()).pending).toBe(true);expect(local[SETTINGS].rows).toEqual(['新しい設定']);
 send.mockRestore();await store.reconcile();expect((await store.state()).pending).toBe(false);
 expect((await decodeRemote(remote))[0].settings.rows).toEqual(['新しい設定']);
});
it('直列化した複数タブ保存では古い編集が新しい値を消さない',async()=>{
 const store=new Store();await store.save(settings('基準'),'edit');const baseline=local[SETTINGS];
 const results=await Promise.allSettled([store.queue(()=>store.save(settings('先の編集'),'edit',baseline)),store.queue(()=>store.save(settings('後の古い編集'),'edit',baseline))]);
 expect(results.map(r=>r.status)).toEqual(['fulfilled','rejected']);expect(local[SETTINGS].rows).toEqual(['先の編集']);
});

it('連続編集を1履歴にまとめ、5分空いた編集は別履歴にする',async()=>{
 const clock=vi.spyOn(Date,'now');let now=1000000;clock.mockImplementation(()=>now);
 try{
 local[SETTINGS]=settings('開始前');
 for(let i=0;i<20;i++){now+=1000;await new Store().save(settings('入力'+i),'editor-save');}
 expect(local[HISTORY]).toHaveLength(1);expect(local[HISTORY][0].settings.rows).toEqual(['開始前']);
 expect(local[SETTINGS].rows).toEqual(['入力19']);
 now+=300000;await new Store().save(settings('次の編集'),'editor-save');
 expect(local[HISTORY]).toHaveLength(2);expect(local[HISTORY][0].settings.rows).toEqual(['入力19']);
 await new Store().save(settings('インポート'),'json-import');
 expect(local[HISTORY]).toHaveLength(3);expect(local[HISTORY][0].settings.rows).toEqual(['次の編集']);
 await new Store().save(settings('復元'),'history-restore');
 expect(local[HISTORY]).toHaveLength(4);expect(local[HISTORY][0].settings.rows).toEqual(['インポート']);
 for(let i=0;i<12;i++)await new Store().save(settings('置換'+i),'json-import');
 expect(local[HISTORY]).toHaveLength(10);
 }finally{clock.mockRestore();}
});

it('旧設定や旧同期データのaiDebugを無視し、以後の同期・書き出し対象にも含めない',async()=>{
 const legacy={...defaults,rows:['保持する語'],aiDebug:true};expect(validate(legacy)).not.toHaveProperty('aiDebug');
 const raw=JSON.stringify({schema:1,clock:{old:1},settings:legacy});const decoded=await decodeRemote({'ynfp:old:0':raw,'ynfp:old:meta':{count:1,hash:await digest(raw)}});expect(decoded[0].settings.rows).toEqual(['保持する語']);expect(decoded[0].settings).not.toHaveProperty('aiDebug');
 const encoded=await encodeDoc({schema:1,clock:{old:1},settings:legacy as any},'old');expect(JSON.stringify(encoded)).not.toContain('aiDebug');
});


it('競合候補の並び順やローカル由来の時計を含むクラウド版を誤認せずタグ用の区分を返す',async()=>{
 const store=new Store(),save=async(word:string)=>{await store.save(settings(word),'edit');};await save('base');await store.reconcile();const parent=(await store.state()).doc!;
 await save('local');remote={...remote,...await encodeDoc(newDoc(settings('cloud'),'other',[parent]),'other')};await store.reconcile();
 const status=await store.status(),sources=Object.fromEntries(status.conflicts.map((doc,i)=>[doc.settings.rows[0],status.conflictSources[i]]));
 expect(sources).toEqual({local:'local',cloud:'cloud'});const chosen=status.conflicts.find(doc=>doc.settings.rows[0]==='cloud')!;await store.resolve(chosen);expect((await store.status()).conflictSources).toEqual([]);expect(local[SETTINGS].rows).toEqual(['cloud']);
});
it('競合表示後に編集しても表示中のローカル候補をクラウドへ変えない',async()=>{
 const store=new Store(),save=async(word:string)=>{await store.save(settings(word),'edit');};await save('local');remote=await encodeDoc(newDoc(settings('cloud'),'other',[]),'other');await store.reconcile();
 await save('edited');const status=await new Store().status();expect(status.conflictSources[status.conflicts.findIndex(doc=>doc.settings.rows[0]==='local')]).toBe('local');
});
it('ローカル候補がない複数の競合はすべてクラウドと表示する',async()=>{
 remote={...await encodeDoc(newDoc(settings('a'),'device-a',[]),'device-a'),...await encodeDoc(newDoc(settings('b'),'device-b',[]),'device-b')};const store=new Store();await store.reconcile();expect((await store.status()).conflictSources).toEqual(['cloud','cloud']);
});
it('区分記録のない旧競合状態ではローカル版の時計を使う',async()=>{
 const store=new Store(),save=async(word:string)=>{await store.save(settings(word),'edit');};await save('local');remote=await encodeDoc(newDoc(settings('cloud'),'other',[]),'other');await store.reconcile();
 const state=await store.state();delete state.localConflictClock;await store.remember(state);const status=await store.status();expect(status.conflictSources[status.conflicts.findIndex(doc=>doc.settings.rows[0]==='local')]).toBe('local');
});


it('並び順だけの違いは許容しても、候補が更新されれば採用を拒否する',async()=>{
 const store=new Store();await store.save(settings('local'),'edit');const cloud=newDoc(settings('cloud'),'other',[]);remote=await encodeDoc(cloud,'other');await store.reconcile();const old=(await store.status()).conflicts.find(doc=>doc.settings.rows[0]==='cloud')!;
 remote={...remote,...await encodeDoc(newDoc(settings('new-cloud'),'other',[cloud]),'other')};
 await expect(store.resolve(old)).rejects.toThrow('競合内容が変わりました');expect(local[SETTINGS].rows).toEqual(['local']);
});
