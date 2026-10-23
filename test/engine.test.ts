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
 const checkbox=root.querySelector<HTMLInputElement>('[aria-label="AIの進捗ツールチップを表示する"]')!;
 checkbox.checked=true;checkbox.dispatchEvent(new Event('change',{bubbles:true}));
 document.querySelector('dialog')!.close();
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
 for(const request of requests)request.ontimeout();
 await vi.advanceTimersByTimeAsync(1000);
 document.querySelector<HTMLDialogElement>('#yne-plus-ui')!.close();
 if(source==='chip')document.getElementById('yne-plus-badge')!.click();
 else menus['Y!News Filter Plus 設定']();
 const dialog=document.querySelector<HTMLDialogElement>('#yne-plus-error-dialog')!;
 const content=dialog.firstElementChild!.shadowRoot!;
 expect(content.textContent).toContain('時間切れ');
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
 expect(store.yne_plus_jev_local_v1.lastError).toContain('完了通知を35秒以内');
 expect(store.yne_plus_jev_local_v1.lastError).toContain('原因は特定できていません');
 expect(store.yne_plus_jev_local_v1.lastError).not.toContain('接続許可を確認');
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
 document.querySelector<HTMLDialogElement>('#yne-plus-ui')!.close();menus['Y!News Filter Plus 設定']();
 const content=document.querySelector('#yne-plus-error-dialog')!.firstElementChild!.shadowRoot!;
 expect(content.textContent).toContain(advice);
 expect(content.querySelector('button')!.textContent).toBe(focusKey?'閉じてAPIキーを設定':'閉じて設定を開く');
});
it.each([
 ['null','format'],
 [JSON.stringify({answers:[{name:'q0',type:'refusal'}]}),'refusal'],
] as const)('OpenAIの不正応答・拒否をキャッシュせず停止する (%s)',async(responseText,kind)=>{
 Object.assign(store.yne_plus_settings_v2,{rows:[],aiEnabled:true,aiConditions:['科学']});
 store.yne_plus_jev_local_v1={provider:'openai',profiles:{openai:{key:'test'}}};
 await boot();await vi.advanceTimersByTimeAsync(1000);
 for(const request of requests)request.onload({status:200,responseText});await vi.advanceTimersByTimeAsync(100);
 expect(store.yne_plus_jev_local_v1.errorKind).toBe(kind);expect(store.yne_plus_jev_local_v1.stopped).toBe(true);
 expect(Object.keys(store.yne_plus_jev_cache_v1||{})).toHaveLength(0);expect(document.querySelectorAll('[data-yne-plus-hidden]')).toHaveLength(0);
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
 expect(copy.mock.calls.at(-1)![0]).toContain(`Cloudflare Clef / ${model}（未判定）`);
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
