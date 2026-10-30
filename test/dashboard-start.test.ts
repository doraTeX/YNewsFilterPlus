import {it,expect,vi,afterEach} from 'vitest';
const mocks=vi.hoisted(()=>({start:vi.fn()}));
vi.mock('../src/content/engine.js',()=>({startEngine:mocks.start}));vi.mock('../src/shared/bridge',()=>({GM:{},bridge:{}}));
afterEach(()=>{window.dispatchEvent(new Event('pagehide'));vi.unstubAllGlobals();vi.restoreAllMocks();document.body.replaceChildren();});
it('専用ページの初期化待ちでもツールバー要求を保持し、同じ設定画面を開く',async()=>{
 vi.resetModules();document.body.innerHTML='<button id="open">設定を開く</button>';let listener:any,release!:()=>void;const open=vi.fn();
 vi.stubGlobal('chrome',{runtime:{id:'test',onMessage:{addListener:(fn:any)=>{listener=fn;},removeListener:vi.fn()}},tabs:{getCurrent:async()=>({id:7})}});
 mocks.start.mockImplementation(async(adapter:any)=>{await new Promise<void>(resolve=>{release=resolve;});await adapter.registerMenuCommand('Y!News Filter Plus 設定',open);});await import('../src/dashboard/main');await vi.waitFor(()=>expect(listener).toBeTypeOf('function'));
 const respond=vi.fn();listener({type:'OPEN_SETTINGS_PAGE',tabId:7},{id:'test'},respond);expect(open).not.toHaveBeenCalled();expect(respond).toHaveBeenCalledWith({opened:true});release();await vi.waitFor(()=>expect(open).toHaveBeenCalledOnce());document.querySelector<HTMLButtonElement>('#open')!.click();expect(open).toHaveBeenCalledTimes(2);
});
