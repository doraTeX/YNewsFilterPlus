import {connectionIdentity} from '../src/shared/ai.js';
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {defaults} from '../src/shared/settings.js';
import {startEngine} from '../src/content/engine.js';
const engineCleanups:Array<()=>void>=[];
let root:ShadowRoot,store:Record<string,any>,menus:Record<string,()=>void>,requests:any[],saveFailure:boolean;
beforeEach(()=>{
 vi.useFakeTimers();document.body.innerHTML='<main><ul><li><a href="https://news.yahoo.co.jp/articles/example-one">科学の新しい記事</a></li><li><a href="https://news.yahoo.co.jp/articles/example-two">文化の記事</a></li></ul></main>';
 saveFailure=false;store={yne_plus_settings_v2:{...defaults,rows:['科学']}};menus={};requests=[];
 const original=Element.prototype.attachShadow;vi.spyOn(Element.prototype,'attachShadow').mockImplementation(function(this:Element,o){const r=original.call(this,{...o,mode:'open'});if(this.parentElement?.tagName==='DIALOG')root=r;return r;});
 HTMLDialogElement.prototype.showModal=function(){this.open=true;};HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new Event('close'));};
 vi.spyOn(window,'confirm').mockReturnValue(true);
});
afterEach(()=>{for(const cleanup of engineCleanups.splice(0))cleanup();vi.clearAllTimers();vi.useRealTimers();vi.restoreAllMocks();});
async function boot(overrides:Record<string,any>={},gmOverrides:Record<string,any>={}){let alive=true;engineCleanups.push(()=>{alive=false;});await startEngine({getValue:async(k:string,f:any)=>structuredClone(store[k]??f),setValue:async(k:string,v:any)=>{store[k]=structuredClone(v);},registerMenuCommand:async(n:string,f:()=>void)=>{menus[n]=f;},xmlHttpRequest:(r:any)=>requests.push(r),setClipboard:async()=>{},...gmOverrides},{isConnected:()=>alive,saveSettings:async(v:any)=>{if(saveFailure)throw Error('テスト保存失敗');store.yne_plus_settings_v2=structuredClone(v);},sync:async()=>{},syncStatus:async()=>({enabled:true,message:'同期済み',conflicts:[]}),setSyncEnabled:async()=>{},resolve:async()=>{},openReport:async()=>{},updateBadge:async()=>{},onSettingsChanged:()=>{},...overrides});menus['Y!News Filter Plus 設定']();await Promise.resolve();}
async function closeSettings(){Array.from(root.querySelectorAll('button')).find(b=>b.textContent==='閉じる')!.click();await vi.advanceTimersByTimeAsync(1);}
it.each([false,true])('AI利用=%sの未判定記事を通常表示と未取得に分け、キーワード除外は保持する',async aiEnabled=>{
 Object.assign(store.yne_plus_settings_v2,{aiEnabled,aiConditions:['文化']});
 const report=vi.fn();await boot({openReport:report});
 Array.from(root.querySelectorAll('button')).find(b=>b.textContent==='判定詳細を表で開く')!.click();await vi.advanceTimersByTimeAsync(1);
 const table=new DOMParser().parseFromString(report.mock.calls.at(-1)![0],'text/html');
 expect(table.querySelectorAll('tbody tr.keyword-excluded-row')).toHaveLength(1);
 expect(table.querySelectorAll('tbody tr.pending-row')).toHaveLength(aiEnabled?1:0);
 expect(table.querySelectorAll('tbody tr.other-row')).toHaveLength(aiEnabled?0:1);
 expect(table.querySelector('[data-filter="other-row"]')!.parentElement!.textContent).toContain(`通常表示 (${aiEnabled?0:1})`);
});
it('キーワード除外とChrome同期UIを持ち、Gist入力はない',async()=>{await boot();expect(document.querySelector('[data-yne-plus-hidden]')?.textContent).toContain('科学');expect(root.textContent).toContain('Chrome同期');expect(root.querySelector('[aria-label="Secret Gist"]')).toBeNull();expect(requests).toHaveLength(0);});
it.each(['textarea','input[type="password"]','input[type="number"]'])('%sにフォーカス中はEscで閉じず、ボタンに移ったら保存後に閉じる',async selector=>{
 Object.assign(store.yne_plus_settings_v2,{aiEnabled:true});store.yne_plus_jev_local_v1={key:'test-key'};await boot();
 const panel=document.querySelector<HTMLDialogElement>('#yne-plus-ui')!,field=root.querySelector<HTMLElement>(selector)!;
 field.focus();expect(root.activeElement).toBe(field);const event=new Event('cancel',{cancelable:true});panel.dispatchEvent(event);await vi.advanceTimersByTimeAsync(1);
 expect(event.defaultPrevented).toBe(true);expect(panel.isConnected).toBe(true);expect(panel.open).toBe(true);
 Array.from(root.querySelectorAll('button')).find(b=>b.textContent==='閉じる')!.focus();panel.dispatchEvent(new Event('cancel',{cancelable:true}));await vi.advanceTimersByTimeAsync(1);
 expect(panel.isConnected).toBe(false);
});
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
 const checkbox=root.querySelector<HTMLInputElement>('[aria-label="AIの進捗ツールチップを表示する"]')!;
 checkbox.checked=true;checkbox.dispatchEvent(new Event('change',{bubbles:true}));
 await closeSettings();
 await vi.advanceTimersByTimeAsync(600);
 expect(store.yne_plus_settings_v2.aiShowProgress).toBe(true);
 menus['Y!News Filter Plus 設定']();
 expect(root.querySelector<HTMLInputElement>('[aria-label="AIの進捗ツールチップを表示する"]')!.checked).toBe(true);
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
 await closeSettings();
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

it('履歴なしでもボタン操作への応答を表示して履歴欄に移動する',async()=>{
 await boot();Array.from(root.querySelectorAll('button')).find(b=>b.textContent==='保存履歴から復元')!.click();
 await vi.advanceTimersByTimeAsync(1);
 const list=root.querySelector('[aria-label="保存履歴"]')!;
 expect(list.textContent).toContain('保存履歴はありません');expect(root.activeElement).toBe(list);
});
it('保存履歴を一覧表示し選択した設定を復元できる',async()=>{
 store.yne_plus_settings_history_v2=[{time:Date.now(),settings:{...defaults,rows:['復元する語']}}];
 await boot();Array.from(root.querySelectorAll('button')).find(b=>b.textContent==='保存履歴から復元')!.click();await vi.advanceTimersByTimeAsync(1);
 const list=root.querySelector('[aria-label="保存履歴"]')!;
 expect(list.textContent).toContain('保存履歴（1件）');expect(root.activeElement).toBe(list);
 list.querySelector('details')!.open=true;list.querySelector<HTMLButtonElement>('button')!.click();await vi.advanceTimersByTimeAsync(1);
 expect(store.yne_plus_settings_v2.rows).toEqual(['復元する語']);
});

it('キャッシュ確認とは独立して変更したAPIキーを検証し認証エラーを赤字で維持する',async()=>{
 await boot();
 const key=root.querySelector<HTMLInputElement>('[aria-label="Jev APIキー"]')!;
 key.value='invalid-test-key';key.dispatchEvent(new Event('change',{bubbles:true}));
 await vi.advanceTimersByTimeAsync(1);
 expect(requests).toHaveLength(1);
 requests[0].onload({status:401,responseHeaders:''});await vi.advanceTimersByTimeAsync(10);
 const notice=Array.from(root.querySelectorAll('p')).find(p=>p.textContent?.includes('HTTP 401'))!;
 expect(notice).toBeDefined();expect(notice.style.color).toBe('rgb(180, 35, 24)');
 await vi.advanceTimersByTimeAsync(60000);
 expect(notice.textContent).toContain('HTTP 401');
 expect(store.yne_plus_jev_local_v1.stopped).toBe(true);
});

it.each(['chip','toolbar'])('通信エラーでも%s経由で閉じた後に設定を変更できる',async(source)=>{
 Object.assign(store.yne_plus_settings_v2,{aiEnabled:true,aiConditions:['科学']});
 store.yne_plus_jev_local_v1={key:'test-key'};
 await boot();await vi.advanceTimersByTimeAsync(1000);
 for(const request of requests)request.onerror({});
 await vi.advanceTimersByTimeAsync(1000);
 await closeSettings();
 if(source==='chip')document.getElementById('yne-plus-badge')!.click();
 else menus['Y!News Filter Plus 設定']();
 const dialog=document.querySelector<HTMLDialogElement>('#yne-plus-error-dialog')!;
 const content=dialog.firstElementChild!.shadowRoot!;
 expect(content.textContent).toContain('接続できません');
 const close=content.querySelector<HTMLButtonElement>('button')!;
 expect(close.textContent).toBe('閉じて設定を開く');close.click();
 expect(document.querySelector('#yne-plus-error-dialog')).toBeNull();
 expect(document.querySelector<HTMLDialogElement>('#yne-plus-ui')!.open).toBe(true);
 const area=root.querySelector<HTMLTextAreaElement>('textarea')!;
 area.value='変更できる';area.dispatchEvent(new Event('input',{bubbles:true}));
 await vi.advanceTimersByTimeAsync(600);
 expect(store.yne_plus_settings_v2.rows).toEqual(['変更できる']);
});


it('保存された停止状態を新しい通信エラーと区別し再開方法を示す',async()=>{
 Object.assign(store.yne_plus_settings_v2,{aiEnabled:true,aiConditions:['科学']});
 store.yne_plus_jev_local_v1={key:'test-key',stopped:true,failures:5,lastError:'Jev通信が完了しません。',lastErrorAt:'2026-10-21T23:31:27.696Z'};
 await boot();await vi.advanceTimersByTimeAsync(1000);
 expect(requests).toHaveLength(0);
 const content=document.querySelector('#yne-plus-error-dialog')!.firstElementChild!.shadowRoot!;
 expect(content.textContent).toContain('過去のエラーによりAIを停止');
 expect(content.textContent).toContain('最後のエラー日時');
 expect(content.textContent).toContain('再試行');
});
it('完了通知が来ない場合は権限不足と断定せず35秒で終了する',async()=>{
 Object.assign(store.yne_plus_settings_v2,{aiEnabled:true,aiConditions:['科学']});
 store.yne_plus_jev_local_v1={key:'test-key'};
 await boot();await vi.advanceTimersByTimeAsync(36000);
 expect(root.textContent).toContain('完了通知を35秒以内');
 expect(root.textContent).toContain('原因は特定できていません');
 expect(store.yne_plus_jev_local_v1.lastError).toBeUndefined();
 expect(store.yne_plus_jev_local_v1.stopped).not.toBe(true);
});


it('エラー画面から再試行すると設定画面を開かず停止を解除し通信を再開する',async()=>{
 Object.assign(store.yne_plus_settings_v2,{aiEnabled:true,aiConditions:['科学']});
 store.yne_plus_jev_local_v1={key:'test-key',stopped:true,failures:5,blockedUntil:Date.now()+600000,lastError:'通信エラー'};
 const settings=structuredClone(store.yne_plus_settings_v2);
 await boot();await vi.advanceTimersByTimeAsync(1000);
 expect(requests).toHaveLength(0);
 const content=document.querySelector('#yne-plus-error-dialog')!.firstElementChild!.shadowRoot!;
 const retry=Array.from(content.querySelectorAll('button')).find(b=>b.textContent==='再試行')!;
 retry.click();retry.click();await vi.advanceTimersByTimeAsync(1000);
 expect(document.querySelector('#yne-plus-error-dialog')).toBeNull();
 expect(document.querySelector('#yne-plus-ui')).toBeNull();
 expect(store.yne_plus_jev_local_v1).toMatchObject({key:'test-key',stopped:false,failures:0,blockedUntil:0,lastError:''});
 expect(store.yne_plus_settings_v2).toEqual(settings);
 expect(requests).toHaveLength(1);
 requests[0].onload({status:200,responseText:JSON.stringify({answers:{q0:{noul:.9}}}),responseHeaders:''});
 await vi.advanceTimersByTimeAsync(1000);
 expect(document.querySelectorAll('[data-yne-plus-hidden]')).toHaveLength(2);
});

it('接続先を切り替えてもJevの保存済みキーを別サービスに引き継がない',async()=>{
 store.yne_plus_jev_local_v1={key:'jev-only'};await boot();
 const provider=root.querySelector<HTMLSelectElement>('[aria-label="利用するAI"]')!;
 provider.value='openai';provider.dispatchEvent(new Event('change',{bubbles:true}));await vi.advanceTimersByTimeAsync(10);
 expect(store.yne_plus_jev_local_v1.profiles.openai.key).toBe('');
 expect(store.yne_plus_jev_local_v1.profiles.jev.key).toBe('jev-only');
 expect(root.querySelector<HTMLInputElement>('[aria-label="OpenAI APIキー"]')!.placeholder).not.toContain('登録済み');
 provider.value='jev';provider.dispatchEvent(new Event('change',{bubbles:true}));await vi.advanceTimersByTimeAsync(10);
 expect(root.querySelector<HTMLInputElement>('[aria-label="Jev APIキー"]')!.placeholder).toContain('登録済み');
});

it.each([
 ['clef',403,'Workers AI',true],
 ['openai',429,'請求設定',false],
] as const)('%s HTTP %sの保存とエラー画面が接続先に合う',async(provider,status,advice,focusKey)=>{
 Object.assign(store.yne_plus_settings_v2,{aiEnabled:true,aiConditions:['科学']});
 store.yne_plus_jev_local_v1={provider,profiles:{[provider]:{key:'test-key',accountId:'a'.repeat(32),model:provider==='clef'?'clef':'gpt-6-luna'}}};
 await boot();await vi.advanceTimersByTimeAsync(1000);
 for(const request of requests)request.onload({status,responseText:JSON.stringify({error:{code:'insufficient_quota'}})});
 await vi.advanceTimersByTimeAsync(100);
 expect(store.yne_plus_jev_local_v1.stopped).toBe(true);expect(store.yne_plus_jev_local_v1.errorProvider).toBe(provider);
 await closeSettings();menus['Y!News Filter Plus 設定']();
 const content=document.querySelector('#yne-plus-error-dialog')!.firstElementChild!.shadowRoot!;
 expect(content.textContent).toContain(advice);
 expect(content.querySelector('button')!.textContent).toBe(focusKey?'閉じてAPIキーを設定':'閉じて設定を開く');
});

it('遅れて完了したキャッシュ読み込みが新しいハイライトを取り消さない',async()=>{
 Object.assign(store.yne_plus_settings_v2,{aiEnabled:true,aiInterests:['文化']});
 store.yne_plus_jev_local_v1={key:'test-key'};
 let hold=false,release:()=>void=()=>{},waiting=false;
 await boot({}, {getValue:async(k:string,f:any)=>{
  const snapshot=structuredClone(store[k]??f);
  if(hold&&k==='yne_plus_jev_cache_v1'){hold=false;waiting=true;return new Promise(resolve=>{release=()=>resolve(snapshot);});}
  return snapshot;
 }});
 await vi.advanceTimersByTimeAsync(1000);expect(requests.length).toBeGreaterThan(0);
 const removed:string[]=[];const original=Element.prototype.removeAttribute;
 vi.spyOn(Element.prototype,'removeAttribute').mockImplementation(function(this:Element,name){if(name==='data-yne-plus-highlight')removed.push(this.textContent||'');return original.call(this,name);});
 hold=true;window.dispatchEvent(new Event('focus'));await vi.advanceTimersByTimeAsync(1);expect(waiting).toBe(true);
 for(const request of requests)request.onload({status:200,responseText:JSON.stringify({answers:{q0:{noul:.95}}})});
 await vi.advanceTimersByTimeAsync(200);
 release();await vi.advanceTimersByTimeAsync(500);
 expect(document.querySelector('[data-yne-plus-highlight]')).not.toBeNull();
 expect(removed).toEqual([]);
});

it('記事識別情報の変化による解除と再付与を同じURLの表示ログに残す',async()=>{
 Object.assign(store.yne_plus_settings_v2,{aiEnabled:true,aiInterests:['文化']});
 store.yne_plus_jev_local_v1={key:'test-key'};
 const copy=vi.fn();await boot({}, {setClipboard:copy});await vi.advanceTimersByTimeAsync(1000);
 for(const request of [...requests])request.onload({status:200,responseText:JSON.stringify({answers:{q0:{noul:.97}}})});
 await vi.advanceTimersByTimeAsync(200);
 const card=document.querySelector('[data-yne-plus-highlight]')!,link=card.querySelector('a')!;
 const original=link.textContent;link.textContent=original+' 7';await vi.advanceTimersByTimeAsync(200);
 expect(card.hasAttribute('data-yne-plus-highlight')).toBe(false);
 link.textContent=original;await vi.advanceTimersByTimeAsync(200);
 expect(card.hasAttribute('data-yne-plus-highlight')).toBe(true);
 Array.from(root.querySelectorAll('button')).find(b=>b.textContent==='判定詳細をTSVでコピー')!.click();await vi.advanceTimersByTimeAsync(1);
 const tsv=copy.mock.calls.at(-1)![0];
 expect(tsv).toContain('表示変更ログ');expect(tsv).toContain('記事識別情報が変更');
 expect(tsv).toContain('ハイライト解除：現在の記事識別情報に対応する有効な判定なし');
 expect(tsv).toContain('ハイライト付与：判定値=[0.97]');
});
it('記事要素の差し替えと外部からの属性解除を記録して判定結果を再適用する',async()=>{
 Object.assign(store.yne_plus_settings_v2,{aiEnabled:true,aiInterests:['文化']});
 store.yne_plus_jev_local_v1={key:'test-key'};
 const copy=vi.fn();await boot({}, {setClipboard:copy});await vi.advanceTimersByTimeAsync(1000);
 for(const request of [...requests])request.onload({status:200,responseText:JSON.stringify({answers:{q0:{noul:.97}}})});await vi.advanceTimersByTimeAsync(200);
 const card=document.querySelector('[data-yne-plus-highlight]')!;
 card.removeAttribute('data-yne-plus-highlight');await vi.advanceTimersByTimeAsync(200);
 expect(card.hasAttribute('data-yne-plus-highlight')).toBe(true);
 const replacement=card.cloneNode(true) as Element;replacement.removeAttribute('data-yne-plus-highlight');card.replaceWith(replacement);
 await vi.advanceTimersByTimeAsync(200);expect(replacement.hasAttribute('data-yne-plus-highlight')).toBe(true);
 Array.from(root.querySelectorAll('button')).find(b=>b.textContent==='判定詳細をTSVでコピー')!.click();await vi.advanceTimersByTimeAsync(1);
 const tsv=copy.mock.calls.at(-1)![0];
 expect(tsv).toContain('直前のscanと異なるハイライト属性を検出：なし');
 expect(tsv).toContain('記事要素がDOMから取り外された');expect(tsv).toContain('同じURLの新しい記事要素を検出');
});

it('Yahooの記事カードでコメント件数が遅れて追加・更新されても黄色を外さず再問い合わせしない',async()=>{
 const title='中国政府系ハッカー「Storm―0940」AI悪用し侵入 3時間で接続権限を奪取';
 document.body.innerHTML=`<main><ul><li data-ual-view-type="list"><div><a href="https://news.yahoo.co.jp/articles/storm"><div><img></div><div><div class="headline">${title}</div><div><div class="metadata"><span class="publisher">産経新聞</span><time>10/23(金) 8:52</time></div></div></div></a></div></li></ul></main>`;
 Object.assign(store.yne_plus_settings_v2,{rows:[],aiEnabled:true,aiInterests:['AI']});store.yne_plus_jev_local_v1={key:'test-key'};
 await boot();await vi.advanceTimersByTimeAsync(1000);
 for(const request of [...requests])request.onload({status:200,responseText:JSON.stringify({answers:{q0:{noul:.94}}})});
 await vi.advanceTimersByTimeAsync(200);
 const card=document.querySelector('li')!;expect(card.hasAttribute('data-yne-plus-highlight')).toBe(true);
 const count=requests.length,removed=vi.spyOn(card,'removeAttribute');
 const comment=document.createElement('span');comment.textContent='6';document.querySelector('.metadata')!.prepend(comment);
 await vi.advanceTimersByTimeAsync(300);
 comment.textContent='7';document.querySelector('time')!.textContent='3時間前';
 await vi.advanceTimersByTimeAsync(300);
 expect(card.hasAttribute('data-yne-plus-highlight')).toBe(true);expect(removed).not.toHaveBeenCalledWith('data-yne-plus-highlight');expect(requests).toHaveLength(count);
 expect(JSON.parse(requests[0].data).state.news_text).toBe(title);
 // 本当の見出し変更は再判定する。記事中の数字もそのまま使う。
 document.querySelector('.headline')!.textContent=title+' 続報';await vi.advanceTimersByTimeAsync(300);
 expect(card.hasAttribute('data-yne-plus-highlight')).toBe(false);expect(requests.length).toBeGreaterThan(count);
});


it.each(['jev','clef','openai'])('%sの未設定をピンク背景と注意書き・エラー状況で示す',async provider=>{
 store.yne_plus_jev_local_v1={provider};await boot();
 const section=root.querySelector<HTMLElement>('.jev-section')!;
 expect(section.querySelector('summary')!.textContent).toContain('AIによるハイライト/除外判定');
 expect(section.style.backgroundColor).toBe('rgb(255, 240, 243)');
 expect(section.querySelector(':scope > [role=alert]')!.textContent).toBe('利用AIが未設定のため機能しません');
 expect(section.querySelector('fieldset [role=alert]')!.textContent).toContain('キーワード設定は適用されません');
 expect(section.textContent).not.toContain('確認完了。未判定の記事はありません');
 expect(section.textContent).not.toContain('この端末のみ');
});
it('設定済みAIでは未設定警告を消し、キー削除時に復元する',async()=>{
 store.yne_plus_jev_local_v1={key:'test-key'};
 Object.assign(store.yne_plus_settings_v2,{aiEnabled:true});await boot();
 const section=root.querySelector<HTMLElement>('.jev-section')!,warning=section.querySelector<HTMLElement>(':scope > [role=alert]')!;
 expect(warning.hidden).toBe(true);expect(section.style.backgroundColor).toBe('');
 Array.from(root.querySelectorAll('button')).find(b=>b.textContent==='APIキーを削除')!.click();await vi.advanceTimersByTimeAsync(200);
 expect(warning.hidden).toBe(false);expect(section.style.backgroundColor).toBe('rgb(255, 240, 243)');
 expect(section.querySelector('fieldset [role=alert]')!.textContent).toContain('利用AIが未設定');
});
it('設定済みでも認証エラーで停止中ならブロック全体をエラー表示にする',async()=>{
 store.yne_plus_jev_local_v1={key:'test-key',stopped:true,lastError:'HTTP 401 認証失敗'};
 await boot();const section=root.querySelector<HTMLElement>('.jev-section')!;
 expect(section.style.backgroundColor).toBe('rgb(255, 240, 243)');
 expect(section.querySelector(':scope > [role=alert]')!.textContent).toContain('利用AIのエラー');
 expect(section.querySelector('fieldset [role=alert]')!.textContent).toContain('HTTP 401');
});

it.each(['clef','clef-flash'])('利用AI %s を表とTSVに表示し、未判定・通常キーワードを区別する',async(model)=>{
 Object.assign(store.yne_plus_settings_v2,{aiEnabled:true,aiInterests:['文化']});
 store.yne_plus_jev_local_v1={provider:'clef',profiles:{clef:{key:'secret-token',accountId:'a'.repeat(32),model}}};
 const copy=vi.fn(),report=vi.fn();await boot({openReport:report},{setClipboard:copy});
 const click=async(label:string)=>{Array.from(root.querySelectorAll('button')).find(b=>b.textContent===label)!.click();await vi.advanceTimersByTimeAsync(1);};
 await click('判定詳細をTSVでコピー');
 expect(copy.mock.calls.at(-1)![0]).toContain('不使用（未取得）');expect(copy.mock.calls.at(-1)![0]).not.toContain(`Cloudflare Clef / ${model}（未判定）`);
 await vi.advanceTimersByTimeAsync(1000);
 expect(requests.length).toBeGreaterThan(0);
 for(const request of [...requests])request.onload({status:200,responseText:JSON.stringify({success:true,result:{answers:{q0:{noul:.97}}}})});
 await vi.advanceTimersByTimeAsync(200);
 await click('判定詳細をTSVでコピー');
 const tsv=copy.mock.calls.at(-1)![0];
 expect(tsv).toContain('利用AI');expect(tsv).toContain(`Cloudflare Clef / ${model}\t`);
 expect(tsv).toContain('不使用（通常キーワード）');expect(tsv).not.toContain('secret-token');expect(tsv).not.toContain('a'.repeat(32));
 await click('判定詳細を表で開く');
 expect(report.mock.calls.at(-1)![0]).toContain('<th scope="col">利用AI</th>');
 expect(report.mock.calls.at(-1)![0]).toContain(`<td>Cloudflare Clef / ${model}</td>`);
});

it('キャッシュ消去は確認し、キャンセルなら保持、承認なら消去完了を表示する',async()=>{
 const cached={saved:{time:Date.now(),scores:[.9]}};store.yne_plus_jev_cache_v1=cached;
 store.yne_plus_settings_v2.aiEnabled=true;store.yne_plus_jev_local_v1={key:'test-key'};
 await boot();
 const button=Array.from(root.querySelectorAll('button')).find(b=>b.textContent==='判定キャッシュを消去')!;
 vi.mocked(window.confirm).mockReturnValue(false);
 button.click();await vi.advanceTimersByTimeAsync(1);
 expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('判定キャッシュをクリアしてよろしいですか？'));
 expect(store.yne_plus_jev_cache_v1).toEqual(cached);
 vi.mocked(window.confirm).mockReturnValue(true);
 button.click();await vi.advanceTimersByTimeAsync(1);
 expect(store.yne_plus_jev_cache_v1).toEqual({});
 expect(root.textContent).toContain('判定キャッシュを消去しました。');expect(button.disabled).toBe(false);
});

it('回答拒否が5件以上でも警告や停止を出さず、ほかの記事を判定し同じ拒否を自動再送しない',async()=>{
 document.body.innerHTML='<main><ul>'+Array.from({length:7},(_,i)=>`<li><a href="https://news.yahoo.co.jp/articles/article-${i}">科学の記事${i}</a></li>`).join('')+'</ul></main>';
 Object.assign(store.yne_plus_settings_v2,{rows:[],aiEnabled:true,aiInterests:['科学'],aiConcurrency:1});
 store.yne_plus_jev_local_v1={provider:'openai',profiles:{openai:{key:'test'}}};
 const copy=vi.fn();await boot({}, {setClipboard:copy});await vi.advanceTimersByTimeAsync(1000);
 for(let i=0;i<7;i++){
  expect(requests).toHaveLength(i+1);
  requests[i].onload({status:200,responseText:JSON.stringify({answers:[i<6?{name:'q0',type:'refusal'}:{name:'q0',type:'predicate',probability:.95}]})});
  await vi.advanceTimersByTimeAsync(100);
 }
 expect(document.querySelectorAll('[data-yne-plus-highlight]')).toHaveLength(1);
 expect(store.yne_plus_jev_local_v1.stopped).not.toBe(true);expect(store.yne_plus_jev_local_v1.failures||0).toBe(0);
 expect(document.querySelector('#yne-plus-error-dialog')).toBeNull();
 expect(root.querySelector<HTMLElement>('.jev-section')!.style.backgroundColor).toBe('');
 expect(root.textContent).toContain('失敗 0／回答なし 6');
 Array.from(root.querySelectorAll('button')).find(b=>b.textContent==='判定詳細をTSVでコピー')!.click();await vi.advanceTimersByTimeAsync(1);
 expect(copy.mock.calls.at(-1)![0]).toContain('回答なし。この記事の処理をスキップしました。');
 window.dispatchEvent(new Event('focus'));await vi.advanceTimersByTimeAsync(5000);
 expect(requests).toHaveLength(7);
 expect(Object.keys(store.yne_plus_jev_cache_v1||{})).toHaveLength(1);
});

it.each(['jev','openai','clef'])('%sの記事単位の失敗は警告・全体待機なしで続行する',async(provider)=>{
 Object.assign(store.yne_plus_settings_v2,{rows:[],aiEnabled:true,aiInterests:['科学'],aiConcurrency:1});
 store.yne_plus_jev_local_v1={provider,profiles:{[provider]:{key:'test',accountId:'a'.repeat(32)}}};
 await boot();await vi.advanceTimersByTimeAsync(1000);
 expect(requests).toHaveLength(1);
 requests[0].onload({status:413,responseText:'{}'});await vi.advanceTimersByTimeAsync(100);
 expect(requests).toHaveLength(2);
 const answers=provider==='openai'?[{name:'q0',type:'predicate',probability:.95}]:{q0:{noul:.95}};
 requests[1].onload({status:200,responseText:JSON.stringify(provider==='clef'?{success:true,result:{answers}}:{answers})});await vi.advanceTimersByTimeAsync(100);
 expect(document.querySelectorAll('[data-yne-plus-highlight]')).toHaveLength(1);
 expect(store.yne_plus_jev_local_v1.stopped).not.toBe(true);expect(store.yne_plus_jev_local_v1.blockedUntil||0).toBe(0);
 expect(document.querySelector('#yne-plus-error-dialog')).toBeNull();
 expect(root.querySelector<HTMLElement>('.jev-section')!.style.backgroundColor).toBe('');
 window.dispatchEvent(new Event('focus'));await vi.advanceTimersByTimeAsync(5000);expect(requests).toHaveLength(2);
});

it.each(['jev','openai','clef'])('%sの認証失敗は全体を停止する',async(provider)=>{
 Object.assign(store.yne_plus_settings_v2,{rows:[],aiEnabled:true,aiInterests:['科学'],aiConcurrency:1});
 store.yne_plus_jev_local_v1={provider,profiles:{[provider]:{key:'test',accountId:'a'.repeat(32)}}};
 await boot();await vi.advanceTimersByTimeAsync(1000);
 requests[0].onload({status:401,responseText:'{}'});await vi.advanceTimersByTimeAsync(1000);
 expect(requests).toHaveLength(1);expect(store.yne_plus_jev_local_v1.stopped).toBe(true);
 expect(root.querySelector<HTMLElement>('.jev-section')!.style.backgroundColor).not.toBe('');
});

it('AIを利用していない未取得行にプルダウンのAI名を表示しない',async()=>{
 store.yne_plus_settings_v2.aiConditions=['文化'];store.yne_plus_settings_v2.aiEnabled=false;
 store.yne_plus_jev_local_v1={provider:'clef',profiles:{clef:{key:'secret-token',accountId:'a'.repeat(32),model:'clef-flash'}}};
 const copy=vi.fn();await boot({},{setClipboard:copy});Array.from(root.querySelectorAll('button')).find(b=>b.textContent==='判定詳細をTSVでコピー')!.click();await vi.advanceTimersByTimeAsync(1);
 const text=copy.mock.calls.at(-1)![0];expect(text).toContain('不使用（AI判定OFF）');expect(text).toContain('不使用（通常キーワード）');expect(text).not.toContain('Cloudflare Clef / clef-flash');expect(requests).toHaveLength(0);
});
it('実際に送信して応答待ちの行は送信したAIと判定結果なしを表示する',async()=>{
 Object.assign(store.yne_plus_settings_v2,{aiEnabled:true,aiConditions:['文化']});store.yne_plus_jev_local_v1={provider:'clef',profiles:{clef:{key:'secret-token',accountId:'a'.repeat(32),model:'clef-flash'}}};
 const copy=vi.fn();await boot({},{setClipboard:copy});await vi.advanceTimersByTimeAsync(1000);expect(requests.length).toBeGreaterThan(0);Array.from(root.querySelectorAll('button')).find(b=>b.textContent==='判定詳細をTSVでコピー')!.click();await vi.advanceTimersByTimeAsync(1);expect(copy.mock.calls.at(-1)![0]).toContain('Cloudflare Clef / clef-flash（判定結果なし）');
});
it('AIがOFFでも取得済みキャッシュのある行は実際の判定元を表示する',async()=>{
 Object.assign(store.yne_plus_settings_v2,{aiEnabled:false,aiConditions:['文化']});const local={provider:'clef',profiles:{clef:{key:'secret-token',accountId:'a'.repeat(32),model:'clef-flash'}}};store.yne_plus_jev_local_v1=local;
 const key=JSON.stringify([5,connectionIdentity(local),'https://news.yahoo.co.jp/articles/example-two','文化の記事',['文化'],1]);store.yne_plus_jev_cache_v1={[key]:{time:Date.now(),scores:[.95]}};
 const copy=vi.fn(),report=vi.fn();await boot({openReport:report},{setClipboard:copy});Array.from(root.querySelectorAll('button')).find(b=>b.textContent==='判定詳細をTSVでコピー')!.click();await vi.advanceTimersByTimeAsync(1);expect(copy.mock.calls.at(-1)![0]).toContain('Cloudflare Clef / clef-flash\t');expect(copy.mock.calls.at(-1)![0]).toContain('保存済みキャッシュ');expect(requests).toHaveLength(0);
 Array.from(root.querySelectorAll('button')).find(b=>b.textContent==='判定詳細を表で開く')!.click();await vi.advanceTimersByTimeAsync(1);
 const table=new DOMParser().parseFromString(report.mock.calls.at(-1)![0],'text/html');
 expect(table.querySelectorAll('tbody tr.other-row')).toHaveLength(1);
 expect(table.querySelectorAll('tbody tr.pending-row,tbody tr.highlight-row,tbody tr.excluded-row')).toHaveLength(0);
 expect(document.querySelector('[data-yne-plus-hidden]')!.textContent).toContain('科学');
});

it('チップの一時停止・設定画面・メニューが連動し、非表示とハイライトをまとめて解除・再開する',async()=>{
 Object.assign(store.yne_plus_settings_v2,{aiEnabled:true,aiInterests:['文化']});store.yne_plus_jev_local_v1={key:'test-key'};
 await boot();await vi.advanceTimersByTimeAsync(1000);
 for(const request of [...requests])request.onload({status:200,responseText:JSON.stringify({answers:{q0:{noul:.95}}})});
 await vi.advanceTimersByTimeAsync(200);
 expect(document.querySelector('[data-yne-plus-hidden]')).not.toBeNull();expect(document.querySelector('[data-yne-plus-highlight]')).not.toBeNull();
 const overlay=document.getElementById('yne-plus-overlay')!,host=overlay.querySelector<HTMLElement>('[data-pause-control]')!,pause=host.shadowRoot!.querySelector('button')!;
 const footer=root.querySelector<HTMLButtonElement>('.footer button')!,saved=structuredClone(store.yne_plus_settings_v2);
 expect(host.hidden).toBe(true);overlay.dispatchEvent(new Event('mouseenter'));expect(host.hidden).toBe(false);
 expect(pause.getAttribute('aria-label')).toBe('除外/ハイライトを一時停止');pause.click();
 expect(document.querySelector('[data-yne-plus-hidden]')).toBeNull();expect(document.querySelector('[data-yne-plus-highlight]')).toBeNull();
 expect(document.getElementById('yne-plus-badge')!.textContent).toBe('一時停止中');expect(pause.getAttribute('aria-pressed')).toBe('true');expect(pause.title).toBe('除外/ハイライトを再開');expect(footer.textContent).toBe('除外/ハイライトを再開');
 const before=requests.length;await vi.advanceTimersByTimeAsync(1000);expect(requests).toHaveLength(before);
 footer.click();expect(pause.getAttribute('aria-pressed')).toBe('false');expect(footer.textContent).toBe('除外/ハイライトを一時停止');
 expect(document.querySelector('[data-yne-plus-hidden]')).not.toBeNull();expect(document.querySelector('[data-yne-plus-highlight]')).not.toBeNull();
 menus['Y!News Filter Plus 除外/ハイライト 一時停止／再開']();expect(footer.textContent).toBe('除外/ハイライトを再開');expect(pause.getAttribute('aria-pressed')).toBe('true');
 pause.click();expect(footer.textContent).toBe('除外/ハイライトを一時停止');expect(pause.getAttribute('aria-pressed')).toBe('false');
 expect(store.yne_plus_settings_v2).toEqual(saved);
 overlay.dispatchEvent(new Event('mouseleave'));expect(host.hidden).toBe(true);
});

it.each(['off','no-conditions','paused','filter-off'])('AI非使用の%sは通常表示に分類し、表・TSV・未判定件数を揃える',async mode=>{
 Object.assign(store.yne_plus_settings_v2,{aiEnabled:mode!=='off',aiConditions:mode==='no-conditions'?[]:['文化'],enabled:mode!=='filter-off'});store.yne_plus_jev_local_v1={key:'test-key'};
 const report=vi.fn(),copy=vi.fn();await boot({openReport:report},{setClipboard:copy});
 if(mode==='paused')menus['Y!News Filter Plus 除外/ハイライト 一時停止／再開']();
 await vi.advanceTimersByTimeAsync(1);
 Array.from(root.querySelectorAll('button')).find(b=>b.textContent==='判定詳細を表で開く')!.click();await vi.advanceTimersByTimeAsync(1);
 const table=new DOMParser().parseFromString(report.mock.calls.at(-1)![0],'text/html'),keyword=mode==='paused'||mode==='filter-off'?0:1;
 expect(table.querySelectorAll('tbody tr')).toHaveLength(2);expect(table.querySelectorAll('tbody .keyword-excluded-row')).toHaveLength(keyword);expect(table.querySelectorAll('tbody .other-row')).toHaveLength(2-keyword);expect(table.querySelectorAll('tbody .pending-row')).toHaveLength(0);
 const pending=Array.from(root.querySelectorAll('.usage-table tr')).find(row=>row.querySelector('th')?.textContent?.trim()==='未判定')!;expect(pending.querySelector('td')!.textContent).toBe('0 件');
 expect(table.querySelector('tbody')!.textContent).not.toMatch(/未取得|未判定/);
 Array.from(root.querySelectorAll('button')).find(b=>b.textContent==='判定詳細をTSVでコピー')!.click();await vi.advanceTimersByTimeAsync(1);
 const tsv=copy.mock.calls.at(-1)![0];expect(tsv).not.toMatch(/未取得|未判定/);expect(tsv).toContain('対象外');
 const label=mode==='off'?'AI判定OFF':mode==='no-conditions'?'条件未設定':mode==='paused'?'一時停止中':'フィルターOFF';expect(tsv).toContain('不使用（'+label+'）');expect(requests).toHaveLength(0);
});
it('AI条件が空の状態からハイライト条件だけを入力すると、通常表示から判定待ち・ハイライトへ切り替わる',async()=>{
 Object.assign(store.yne_plus_settings_v2,{aiEnabled:true,aiConditions:[],aiInterests:[]});store.yne_plus_jev_local_v1={key:'test-key'};
 const report=vi.fn();await boot({openReport:report});
 const table=async()=>{Array.from(root.querySelectorAll('button')).find(b=>b.textContent==='判定詳細を表で開く')!.click();await vi.advanceTimersByTimeAsync(1);return new DOMParser().parseFromString(report.mock.calls.at(-1)![0],'text/html');};
 expect((await table()).querySelectorAll('tbody .other-row')).toHaveLength(1);expect(requests).toHaveLength(0);
 store.yne_plus_settings_v2.aiInterests=['文化'];window.dispatchEvent(new Event('focus'));await vi.advanceTimersByTimeAsync(500);
 expect(requests.length).toBeGreaterThan(0);expect((await table()).querySelectorAll('tbody .pending-row')).toHaveLength(1);
 for(const request of [...requests])request.onload({status:200,responseText:JSON.stringify({answers:{q0:{noul:.95}}})});await vi.advanceTimersByTimeAsync(200);
 expect((await table()).querySelectorAll('tbody .highlight-row')).toHaveLength(1);expect(document.querySelector('[data-yne-plus-highlight]')).not.toBeNull();
});

it('連続Escでcancelが取り消せずcloseが発生しても、入力とフォーカスを保持し保存失敗時に閉じない',async()=>{
 await boot();const dialog=document.querySelector<HTMLDialogElement>('#yne-plus-ui')!,area=root.querySelector<HTMLTextAreaElement>('textarea')!;
 area.value='保存前の入力';area.dispatchEvent(new Event('input',{bubbles:true}));area.focus();saveFailure=true;
 dialog.dispatchEvent(new Event('cancel',{cancelable:true}));dialog.dispatchEvent(new Event('cancel',{cancelable:false}));dialog.close();
 expect(dialog.open).toBe(true);expect(dialog.isConnected).toBe(true);expect(root.activeElement).toBe(area);expect(area.value).toBe('保存前の入力');
 await vi.advanceTimersByTimeAsync(600);const close=Array.from(root.querySelectorAll('button')).find(b=>b.textContent==='閉じる')!;close.click();await vi.advanceTimersByTimeAsync(1);
 expect(dialog.open).toBe(true);expect(area.value).toBe('保存前の入力');expect(root.textContent).toContain('テスト保存失敗');
 saveFailure=false;close.click();await vi.advanceTimersByTimeAsync(1);expect(dialog.isConnected).toBe(false);expect(store.yne_plus_settings_v2.rows).toEqual(['保存前の入力']);
});
it('保存待ち中にネイティブのcloseが割り込んでも、保存完了までダイアログを保持する',async()=>{
 let finish!:(value?:unknown)=>void;
 await boot({saveSettings:async(next:any)=>{await new Promise(resolve=>finish=resolve);store.yne_plus_settings_v2=structuredClone(next);}});
 const dialog=document.querySelector<HTMLDialogElement>('#yne-plus-ui')!,area=root.querySelector<HTMLTextAreaElement>('textarea')!,close=Array.from(root.querySelectorAll('button')).find(b=>b.textContent==='閉じる')!;
 area.value='保存待ちの入力';area.dispatchEvent(new Event('input',{bubbles:true}));close.focus();dialog.dispatchEvent(new Event('cancel',{cancelable:false}));
 for(let i=0;i<20;i++)await Promise.resolve();expect(finish).toBeTruthy();dialog.close();expect(dialog.open).toBe(true);expect(dialog.isConnected).toBe(true);
 finish();await vi.advanceTimersByTimeAsync(1);expect(dialog.isConnected).toBe(false);expect(store.yne_plus_settings_v2.rows).toEqual(['保存待ちの入力']);
});

it.each(['button','native'])('接続切れ後の未保存画面を%sで閉じ、保存の再試行を止める',async mode=>{
 let connected=true;const save=vi.fn(async()=>{throw Error('Extension context invalidated.');});await boot({isConnected:()=>connected,saveSettings:save});
 const dialog=document.querySelector<HTMLDialogElement>('#yne-plus-ui')!,area=root.querySelector<HTMLTextAreaElement>('textarea')!;
 area.value='切断後の入力';area.dispatchEvent(new Event('input',{bubbles:true}));connected=false;
 if(mode==='button')await closeSettings();else dialog.close();
 expect(dialog.isConnected).toBe(false);await vi.advanceTimersByTimeAsync(1000);expect(save).not.toHaveBeenCalled();
});
it('保存が応答しなくても接続切れ後の閉じる操作で退出できる',async()=>{
 let connected=true,reject!:(e:Error)=>void;await boot({isConnected:()=>connected,saveSettings:()=>new Promise((_,fail)=>{reject=fail;})});
 const dialog=document.querySelector<HTMLDialogElement>('#yne-plus-ui')!,area=root.querySelector<HTMLTextAreaElement>('textarea')!;
 area.value='保存中の入力';area.dispatchEvent(new Event('input',{bubbles:true}));await closeSettings();expect(reject).toBeTruthy();expect(dialog.isConnected).toBe(true);
 connected=false;await closeSettings();expect(dialog.isConnected).toBe(false);reject(Error('Extension context invalidated.'));await vi.advanceTimersByTimeAsync(1000);expect(document.querySelector('#yne-plus-ui')).toBeNull();
});
