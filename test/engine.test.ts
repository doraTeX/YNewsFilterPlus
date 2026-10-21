import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {defaults} from '../src/shared/settings.js';
import {startEngine} from '../src/content/engine.js';
let root:ShadowRoot,store:Record<string,any>,menus:Record<string,()=>void>,requests:any[];
beforeEach(()=>{
 vi.useFakeTimers();document.body.innerHTML='<main><ul><li><a href="https://news.yahoo.co.jp/articles/example-one">科学の新しい記事</a></li><li><a href="https://news.yahoo.co.jp/articles/example-two">文化の記事</a></li></ul></main>';
 store={yne_plus_settings_v2:{...defaults,rows:['科学']}};menus={};requests=[];
 const original=Element.prototype.attachShadow;vi.spyOn(Element.prototype,'attachShadow').mockImplementation(function(this:Element,o){const r=original.call(this,{...o,mode:'open'});if(this.parentElement?.tagName==='DIALOG')root=r;return r;});
 HTMLDialogElement.prototype.showModal=function(){this.open=true;};HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new Event('close'));};
 vi.spyOn(window,'confirm').mockReturnValue(true);
});
afterEach(()=>{vi.clearAllTimers();vi.useRealTimers();vi.restoreAllMocks();});
async function boot(){await startEngine({getValue:async(k:string,f:any)=>structuredClone(store[k]??f),setValue:async(k:string,v:any)=>{store[k]=structuredClone(v);},registerMenuCommand:async(n:string,f:()=>void)=>{menus[n]=f;},xmlHttpRequest:(r:any)=>requests.push(r),setClipboard:async()=>{}},{saveSettings:async(v:any)=>{store.yne_plus_settings_v2=structuredClone(v);},sync:async()=>{},syncStatus:async()=>({enabled:true,message:'同期済み',conflicts:[]}),setSyncEnabled:async()=>{},resolve:async()=>{},openReport:async()=>{},onSettingsChanged:()=>{}});menus['Y!News Filter Plus 設定']();await Promise.resolve();}
it('キーワード除外とChrome同期UIを持ち、Gist入力はない',async()=>{await boot();expect(document.querySelector('[data-yne-plus-hidden]')?.textContent).toContain('科学');expect(root.textContent).toContain('Chrome同期');expect(root.querySelector('[aria-label="Secret Gist"]')).toBeNull();expect(requests).toHaveLength(0);});
it('設定JSONを読み込みJev設定も移行する',async()=>{
 await boot();const file=root.querySelector<HTMLInputElement>('input[type=file]')!;
 Object.defineProperty(file,'files',{value:[{text:async()=>JSON.stringify({...defaults,rows:['文化'],aiConditions:['スポーツ'],aiInterests:['科学'],aiThreshold:.8,aiConcurrency:7})}]});
 await file.onchange!.call(file,new Event('change'));
 expect(store.yne_plus_settings_v2.rows).toEqual(['文化']);expect(store.yne_plus_settings_v2.aiConcurrency).toBe(7);expect(store.yne_plus_settings_v2.aiThreshold).toBe(.8);
 expect(document.querySelector('[data-yne-plus-hidden]')?.textContent).toContain('文化');
});
