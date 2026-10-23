import {PROVIDERS,providerOf,profileOf,ollayaBase} from '../shared/ai.js';

export function connectionUI({parent,text,button,local,bridge,status,applySettings,onDelete}){
 const initial=(value=local())=>({provider:providerOf(value),profiles:Object.fromEntries(Object.keys(PROVIDERS).map(id=>[id,profileOf(value,id)]))});
 let drafts=initial(),baseline=JSON.stringify(drafts),shown=drafts.provider,revision=0,forceSave=false;
 const box=text('div','',parent,'ai-connection');
 text('h3','AIの接続先（この端末のみ）',box);
 const providerLabel=text('label','接続先',box),provider=text('select','',providerLabel);provider.setAttribute('aria-label','AIの接続先');
 for(const [value,label]of Object.entries(PROVIDERS)){const o=text('option',label,provider);o.value=value;}provider.value=shown;
 const keyRow=text('div','',box);keyRow.style.cssText='display:flex;align-items:center;gap:16px';
 const key=text('input','',keyRow);key.type='password';key.autocomplete='off';key.style.cssText='flex:1;min-width:0';
 const deleteKey=button('APIキーを削除',async()=>{
  if(!window.confirm(`${PROVIDERS[shown]}の保存済みAPIキーを削除しますか？`))return;
  await onDelete(shown);drafts.profiles[shown].key='';key.value='';baseline=JSON.stringify(initial());render();
 },keyRow);deleteKey.className='danger';
 const accountLabel=text('label','CloudflareアカウントID',box),account=text('input','',accountLabel);account.type='text';account.setAttribute('aria-label','CloudflareアカウントID');
 const baseLabel=text('label','OllayaサーバーURL',box),base=text('input','',baseLabel);base.type='url';base.setAttribute('aria-label','OllayaサーバーURL');
 const modelLabel=text('label','モデル',box),model=text('select','',modelLabel);model.setAttribute('aria-label','AIモデル');
 const hint=text('p','',box,'hint');
 const describe=e=>[e?.message||'処理に失敗しました。',e?.advice||''].filter(Boolean).join('\n');
 const permission=button('この接続先への通信を許可',async()=>{
  const id=shown,url=base.value,token=revision;
  try{
   const granted=await bridge.requestAIOrigin(id,url);
   if(token!==revision||shown!==id)return;
   status.textContent=granted?'接続先への通信を許可しました。':'通信は許可されませんでした。';
   if(granted){forceSave=true;await applySettings();}
  }catch(e){if(token===revision&&shown===id)status.textContent='接続許可を確認できませんでした。設定画面を開き直して再操作してください。\n'+describe(e);}
 },box);
 const models=button('モデル一覧を取得',async()=>{
  const url=ollayaBase(base.value),token=++revision;
  const current=()=>token===revision&&shown==='ollaya';
  try{
   // Start permissions.request before any await to retain the user's gesture.
   const permissionRequest=bridge.requestAIOrigin('ollaya',url);models.disabled=true;
   if(!await permissionRequest){if(current())status.textContent='通信は許可されませんでした。';return;}
   if(!current())return;
   status.textContent='Ollayaのモデル一覧を取得しています…';
   const names=await bridge.listAIModels(url);
   if(!current()||ollayaBase(base.value)!==url)return;
   capture();model.replaceChildren();
   const placeholder=text('option','モデルを選択してください',model);placeholder.value='';
   for(const name of names){const o=text('option',name,model);o.value=name;}
   if(names.includes(drafts.profiles.ollaya.model))model.value=drafts.profiles.ollaya.model;
   drafts.profiles.ollaya.model=model.value;forceSave=true;
   model.dispatchEvent(new Event('change',{bubbles:true}));
   status.textContent=names.length?'モデルを選択してください。':'モデルがありません。Ollayaでモデルをダウンロードしてから再取得してください。';
  }catch(e){if(current())status.textContent=describe(e);}
  finally{if(current())models.disabled=false;}
 },box);
 function capture(){
  const p=drafts.profiles[shown];if(key.value.trim())p.key=key.value.trim();
  if(shown==='clef'){p.accountId=account.value.trim();p.model=model.value;}
  if(shown==='ollaya'){p.baseUrl=base.value.trim();p.model=model.value;}
 }
 function render(){
  const p=drafts.profiles[shown];key.value='';keyRow.hidden=shown==='ollaya';keyRow.style.display=shown==='ollaya'?'none':'flex';
  key.setAttribute('aria-label',shown==='jev'?'Jev APIキー':shown==='clef'?'Cloudflare APIトークン':'OpenAI APIキー');
  key.placeholder=p.key?'APIキー登録済み（変更時だけ入力）':shown==='clef'?'Workers AI権限を持つAPIトークン':`${PROVIDERS[shown]} APIキー`;
  accountLabel.hidden=shown!=='clef';account.value=p.accountId;baseLabel.hidden=shown!=='ollaya';base.value=p.baseUrl;
  modelLabel.hidden=!['clef','ollaya'].includes(shown);model.replaceChildren();
  const values=shown==='clef'?['clef','clef-flash']:p.model?[p.model]:[''];
  for(const value of values){const o=text('option',value||'モデル一覧を取得してください',model);o.value=value;}model.value=p.model;
  models.disabled=false;permission.hidden=shown==='jev'||shown==='ollaya';models.hidden=shown!=='ollaya';
  hint.textContent=shown==='ollaya'?'Ollayaを起動してモデルをダウンロードしてください。APIキーは不要です。選択したサーバーへ記事テキストと判定条件を送信します。':`${PROVIDERS[shown]}へ記事テキストと判定条件を送信します。利用料金は接続先との契約に従います。`;
 }
 provider.addEventListener('change',()=>{capture();shown=provider.value;drafts.provider=shown;revision++;render();});
 base.addEventListener('input',()=>{revision++;models.disabled=false;drafts.profiles.ollaya.model='';model.replaceChildren();const o=text('option','モデル一覧を取得してください',model);o.value='';});
 render();
 return {key,read:old=>{capture();if(JSON.stringify(initial(old))!==baseline)throw Error('別の画面で接続設定が変更されました。設定画面を開き直してください。');return {...old,provider:shown,profiles:structuredClone(drafts.profiles),key:drafts.profiles.jev.key};},
  changed:()=>{capture();return forceSave||baseline!==JSON.stringify(drafts);},
  changedKey:()=>{capture();return drafts.profiles[shown].key!==profileOf(local(),shown).key;},
  check:()=>{capture();const p=drafts.profiles[shown];if(shown==='ollaya')ollayaBase(p.baseUrl);if(shown==='clef'&&p.accountId&&!/^[a-f\d]{32}$/i.test(p.accountId))throw Error('CloudflareアカウントIDは32桁です');},
  saved:()=>{forceSave=false;baseline=JSON.stringify(drafts);key.value='';key.placeholder=drafts.profiles[shown].key?'APIキー登録済み（変更時だけ入力）':key.placeholder;}};
}
