import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {defaults} from '../src/shared/settings.js';
import {startEngine} from '../src/content/engine.js';
let root:ShadowRoot,store:Record<string,any>,menus:Record<string,()=>void>,requests:any[],saveFailure:boolean;
beforeEach(()=>{
 vi.useFakeTimers();document.body.innerHTML='<main><ul><li><a href="https://news.yahoo.co.jp/articles/example-one">科学の新しい記事</a></li><li><a href="https://news.yahoo.co.jp/articles/example-two">文化の記事</a></li></ul></main>';
 saveFailure=false;store={yne_plus_settings_v2:{...defaults,rows:['科学']}};menus={};requests=[];
 const original=Element.prototype.attachShadow;vi.spyOn(Element.prototype,'attachShadow').mockImplementation(function(this:Element,o){const r=original.call(this,{...o,mode:'open'});if(this.parentElement?.tagName==='DIALOG')root=r;return r;});
 HTMLDialogElement.prototype.showModal=function(){this.open=true;};HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new Event('close'));};
 vi.spyOn(window,'confirm').mockReturnValue(true);
});
afterEach(()=>{vi.clearAllTimers();vi.useRealTimers();vi.restoreAllMocks();});
async function boot(){await startEngine({getValue:async(k:string,f:any)=>structuredClone(store[k]??f),setValue:async(k:string,v:any)=>{store[k]=structuredClone(v);},registerMenuCommand:async(n:string,f:()=>void)=>{menus[n]=f;},xmlHttpRequest:(r:any)=>requests.push(r),setClipboard:async()=>{}},{saveSettings:async(v:any)=>{if(saveFailure)throw Error('テスト保存失敗');store.yne_plus_settings_v2=structuredClone(v);},sync:async()=>{},syncStatus:async()=>({enabled:true,message:'同期済み',conflicts:[]}),setSyncEnabled:async()=>{},resolve:async()=>{},openReport:async()=>{},updateBadge:async()=>{},onSettingsChanged:()=>{}});menus['Y!News Filter Plus 設定']();await Promise.resolve();}
it('キーワード除外とChrome同期UIを持ち、Gist入力はない',async()=>{await boot();expect(document.querySelector('[data-yne-plus-hidden]')?.textContent).toContain('科学');expect(root.textContent).toContain('Chrome同期');expect(root.querySelector('[aria-label="Secret Gist"]')).toBeNull();expect(requests).toHaveLength(0);});
it('設定JSONを読み込みJev設定も移行する',async()=>{
 await boot();const file=root.querySelector<HTMLInputElement>('input[type=file]')!;
 Object.defineProperty(file,'files',{value:[{text:async()=>JSON.stringify({...defaults,rows:['文化'],aiConditions:['スポーツ'],aiInterests:['科学'],aiThreshold:.8,aiConcurrency:7})}]});
 await file.onchange!.call(file,new Event('change'));
 expect(store.yne_plus_settings_v2.rows).toEqual(['文化']);expect(store.yne_plus_settings_v2.aiConcurrency).toBe(7);expect(store.yne_plus_settings_v2.aiThreshold).toBe(.8);
 expect(document.querySelector('[data-yne-plus-hidden]')?.textContent).toContain('文化');
});

it('初回の未保存状態でフォーカスが戻ってもエラーにしない',async()=>{
 store={};const warn=vi.spyOn(console,'warn');await boot();window.dispatchEvent(new Event('focus'));for(let i=0;i<10;i++)await Promise.resolve();expect(warn).not.toHaveBeenCalled();expect(root.querySelector<HTMLTextAreaElement>('textarea')!.value).toBe('');
});

it('ページ上のチップを設定で非表示にできる',async()=>{
 store.yne_plus_settings_v2.showPageChip=false;await boot();expect(document.getElementById('yne-plus-overlay')!.style.display).toBe('none');expect(document.querySelector('[data-yne-plus-hidden]')?.textContent).toContain('科学');
});

it('色選択で記事背景のCSSと保存設定が更新される',async()=>{
 await boot();
 const color=root.querySelector<HTMLInputElement>('input[type=color]')!;
 color.value='#293170';color.dispatchEvent(new Event('input',{bubbles:true}));
 expect(Array.from(document.head.querySelectorAll('style')).some(s=>s.textContent?.includes('background-color:#293170!important'))).toBe(true);
 await vi.advanceTimersByTimeAsync(600);
 expect(store.yne_plus_settings_v2.aiHighlightColor).toBe('#293170');
 expect(Array.from(document.head.querySelectorAll('style')).some(s=>s.textContent?.includes('background-color:#293170!important'))).toBe(true);
});

it('進捗表示をOFFからONにして閉じても保存される',async()=>{
 store.yne_plus_settings_v2.aiShowProgress=false;
 await boot();
 const checkbox=root.querySelector<HTMLInputElement>('[aria-label="Jevの進捗ツールチップを表示する"]')!;
 checkbox.checked=true;checkbox.dispatchEvent(new Event('change',{bubbles:true}));
 document.querySelector('dialog')!.close();
 await vi.advanceTimersByTimeAsync(600);
 expect(store.yne_plus_settings_v2.aiShowProgress).toBe(true);
 menus['Y!News Filter Plus 設定']();
 expect(root.querySelector<HTMLInputElement>('[aria-label="Jevの進捗ツールチップを表示する"]')!.checked).toBe(true);
});

it('保存失敗時は閉じずに入力を残し、再操作で保存できる',async()=>{
 await boot();const area=root.querySelector<HTMLTextAreaElement>('textarea')!;
 area.value='保存する語';area.dispatchEvent(new Event('input',{bubbles:true}));saveFailure=true;
 await vi.advanceTimersByTimeAsync(600);
 const close=Array.from(root.querySelectorAll('button')).find(b=>b.textContent==='閉じる')!;
 close.click();await vi.advanceTimersByTimeAsync(10);
 expect(document.querySelector('dialog')!.open).toBe(true);expect(area.value).toBe('保存する語');
 expect(store.yne_plus_settings_v2.rows).toEqual(['科学']);
 saveFailure=false;close.click();await vi.advanceTimersByTimeAsync(10);
 expect(store.yne_plus_settings_v2.rows).toEqual(['保存する語']);expect(document.querySelector('dialog')).toBeNull();
});
it('入力直後の閉じる操作で最後の変更を保存する',async()=>{
 await boot();const area=root.querySelector<HTMLTextAreaElement>('textarea')!;
 area.value='最後の編集';area.dispatchEvent(new Event('input',{bubbles:true}));
 Array.from(root.querySelectorAll('button')).find(b=>b.textContent==='閉じる')!.click();
 await vi.advanceTimersByTimeAsync(10);
 expect(store.yne_plus_settings_v2.rows).toEqual(['最後の編集']);expect(document.querySelector('dialog')).toBeNull();
});

it('件数チップOFFでも進捗ONなら通信中の進捗を表示し完了で消す',async()=>{
 Object.assign(store.yne_plus_settings_v2,{showPageChip:false,aiShowProgress:true,aiEnabled:true,aiConditions:['科学']});
 store.yne_plus_jev_local_v1={key:'test-key'};
 await boot();await vi.advanceTimersByTimeAsync(1000);
 expect(requests.length).toBeGreaterThan(0);
 expect(document.getElementById('yne-plus-badge')!.style.display).toBe('none');
 expect(document.getElementById('yne-plus-overlay')!.style.display).toBe('block');
 expect(document.getElementById('yne-plus-progress')!.style.display).toBe('block');
 for(const request of requests)request.onload({status:200,responseText:JSON.stringify({answers:{q0:{noul:0.1}},usage:{input_tokens:1,output_tokens:1}})});
 await vi.advanceTimersByTimeAsync(1000);
 expect(document.getElementById('yne-plus-progress')!.style.display).toBe('none');
 expect(document.getElementById('yne-plus-overlay')!.style.display).toBe('none');
});
it('認証エラーでは進捗設定に関係なく赤バツを表示する',async()=>{
 Object.assign(store.yne_plus_settings_v2,{aiShowProgress:false,aiEnabled:true,aiConditions:['科学']});
 store.yne_plus_jev_local_v1={key:'test-key'};
 await boot();await vi.advanceTimersByTimeAsync(1000);
 for(const request of requests)request.onload({status:401,responseHeaders:''});
 await vi.advanceTimersByTimeAsync(1000);
 expect(document.getElementById('yne-plus-error')!.style.display).toBe('block');
 expect(document.getElementById('yne-plus-error')!.title).toContain('401');
 expect(document.getElementById('yne-plus-busy')!.style.display).toBe('none');
});

it.each(['chip','toolbar'])('認証エラーの%sクリックで対処を示し、閉じるとAPIキー欄へ移動',async(source)=>{
 Object.assign(store.yne_plus_settings_v2,{aiEnabled:true,aiConditions:['科学']});
 store.yne_plus_jev_local_v1={key:'test-key'};
 await boot();await vi.advanceTimersByTimeAsync(1000);
 for(const request of requests)request.onload({status:401,responseHeaders:''});
 await vi.advanceTimersByTimeAsync(1000);
 document.querySelector<HTMLDialogElement>('#yne-plus-ui')!.close();
 if(source==='chip')document.getElementById('yne-plus-badge')!.click();
 else menus['Y!News Filter Plus 設定']();
 const dialog=document.querySelector<HTMLDialogElement>('#yne-plus-error-dialog')!;
 expect(dialog.open).toBe(true);
 const content=dialog.firstElementChild!.shadowRoot!;
 expect(content.textContent).toContain('HTTP 401');expect(content.textContent).toContain('有効なキーを入力し直して');
 content.querySelector<HTMLButtonElement>('button')!.click();
 expect(document.querySelector('#yne-plus-error-dialog')).toBeNull();
 expect(root.activeElement).toBe(root.querySelector('[aria-label="Jev APIキー"]'));
 expect(document.querySelector<HTMLDialogElement>('#yne-plus-ui')!.open).toBe(true);
});
