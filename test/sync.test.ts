import {beforeEach,describe,it,expect,vi} from 'vitest';
import {webcrypto} from 'node:crypto';
import {defaults,validate,normalize} from '../src/shared/settings.js';
import {newDoc,heads,encodeDoc,decodeRemote,assertQuota,SETTINGS,HISTORY} from '../src/shared/sync';
import {Store} from '../src/background/store';
let local:Record<string,any>,remote:Record<string,any>;
function area(data:()=>Record<string,any>){return {get:async(key:any)=>{const d=data();if(key===null)return structuredClone(d);const ks=typeof key==='string'?[key]:key;return structuredClone(Object.fromEntries(ks.filter((k:string)=>k in d).map((k:string)=>[k,d[k]])));},set:async(value:any)=>Object.assign(data(),structuredClone(value)),remove:async(keys:string[])=>{for(const k of keys)delete data()[k];}};}
beforeEach(()=>{local={};remote={};vi.stubGlobal('crypto',webcrypto);vi.stubGlobal('chrome',{storage:{local:area(()=>local),sync:area(()=>remote)}});});
const settings=(word:string)=>validate({...defaults,rows:[word]});
describe('移行と個人情報',()=>{
 it('ユーザースクリプトの全設定を保持し認証情報を破棄',()=>{const input={...defaults,rows:['ABC'],aiConditions:['スポーツ'],aiInterests:['科学'],aiEnabled:true,aiThreshold:.8,aiConcurrency:5,token:'SECRET',key:'SECRET',gist:'SECRET'};const next=validate(input);expect(next.aiConcurrency).toBe(5);expect(next.aiEnabled).toBe(true);expect(next.aiThreshold).toBe(.8);expect(JSON.stringify(next)).not.toContain('SECRET');});
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
