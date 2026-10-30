import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {webcrypto} from 'node:crypto';
let session:Record<string,any>,message:any,removed:any,updated:any;
function area(data:Record<string,any>){return {get:vi.fn(async(keys:any)=>keys==null?structuredClone(data):structuredClone(Object.fromEntries((typeof keys==='string'?[keys]:keys).filter((key:string)=>key in data).map((key:string)=>[key,data[key]])))),set:vi.fn(async(value:any)=>{Object.assign(data,structuredClone(value));}),remove:vi.fn(async(keys:string|string[])=>{for(const key of typeof keys==='string'?[keys]:keys)delete data[key];})};}
const sender={id:'test-extension',url:'https://news.yahoo.co.jp/',tab:{id:1}};
async function send(payload:any,from:any=sender){return new Promise<any>((resolve,reject)=>message(payload,from,(reply:any)=>reply.ok?resolve(reply.value):reject(Error(reply.error))));}
beforeEach(async()=>{
 vi.resetModules();session={};vi.stubGlobal('crypto',webcrypto);
 vi.stubGlobal('chrome',{
  runtime:{id:'test-extension',getURL:(path:string)=>'chrome-extension://test-extension/'+path,onMessage:{addListener:(fn:any)=>{message=fn;}},onStartup:{addListener:vi.fn()},onInstalled:{addListener:vi.fn()}},
  storage:{local:area({}),session:area(session),sync:area({}),onChanged:{addListener:vi.fn()}},
  action:{onClicked:{addListener:vi.fn()},setBadgeText:vi.fn(async()=>{}),setTitle:vi.fn(async()=>{})},
  alarms:{create:vi.fn(async()=>{}),onAlarm:{addListener:vi.fn()}},
  tabs:{onRemoved:{addListener:(fn:any)=>{removed=fn;}},onUpdated:{addListener:(fn:any)=>{updated=fn;}}}
 });await import('../src/background/index');await send({type:'DEBUG_GET'});
});
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});
it('継続出力は同じタブのリロードで維持し、新しいタブや終了後には引き継がない',async()=>{
 expect(await send({type:'DEBUG_GET'})).toEqual({enabled:false,available:true});
 await send({type:'DEBUG_SET',enabled:true,tabId:999});expect(session['ynfp_debug:999']).toBeUndefined();
 updated(1,{status:'loading'});expect((await send({type:'DEBUG_GET'})).enabled).toBe(true);
 expect((await send({type:'DEBUG_GET'},{...sender,tab:{id:2}})).enabled).toBe(false);
 expect(chrome.storage.local.set).not.toHaveBeenCalledWith(expect.objectContaining({aiDebug:true}));expect(chrome.storage.sync.set).not.toHaveBeenCalled();
 removed(1);await vi.waitFor(()=>expect(session['ynfp_debug:1']).toBeUndefined());expect((await send({type:'DEBUG_GET'})).enabled).toBe(false);
});
it('単独の拡張設定画面は指定タブを扱い、対象のない画面と不正な値は許可しない',async()=>{
 const own={id:'test-extension',url:'chrome-extension://test-extension/src/dashboard/index.html'};
 expect(await send({type:'DEBUG_GET'},own)).toEqual({enabled:false,available:false});
 await send({type:'DEBUG_SET',tabId:2,enabled:true},own);expect(session['ynfp_debug:2']).toBe(true);
 await expect(send({type:'DEBUG_SET',enabled:'true'})).rejects.toThrow('真偽値');
});


it('設定専用タブからツールバーを押すと同じページへ開く要求を送る',async()=>{
 Object.assign(chrome.runtime,{sendMessage:vi.fn(async()=>({opened:true})),openOptionsPage:vi.fn(async()=>{})});Object.assign(chrome.tabs,{sendMessage:vi.fn(async()=>({opened:false}))});
 const action=vi.mocked(chrome.action.onClicked.addListener).mock.calls[0][0];action({id:7,url:'chrome-extension://test-extension/src/dashboard/index.html'} as any);
 await vi.waitFor(()=>expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({type:'OPEN_SETTINGS_PAGE',tabId:7}));expect(chrome.tabs.sendMessage).not.toHaveBeenCalled();expect(chrome.runtime.openOptionsPage).not.toHaveBeenCalled();
});
