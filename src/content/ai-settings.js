import {PROVIDERS,providerOf,profileOf} from '../shared/ai.js';

export function connectionUI({parent,text,button,local,bridge,status,applySettings,onDelete}){
 const initial=(value=local())=>({provider:providerOf(value),profiles:Object.fromEntries(Object.keys(PROVIDERS).map(id=>[id,profileOf(value,id)]))});
 let drafts=initial(),baseline=JSON.stringify(drafts),shown=drafts.provider,revision=0,forceSave=false;
 const box=text('div','',parent,'ai-connection');
 text('h3','利用するAI',box);
 const providerLabel=text('label','接続先',box),provider=text('select','',providerLabel);provider.setAttribute('aria-label','利用するAI');
 for(const [value,label]of Object.entries(PROVIDERS)){const o=text('option',value==='clef'?'Cloudflare Clef / Clef-flash':label,provider);o.value=value;}provider.value=shown;
 const keyRow=text('div','',box);keyRow.style.cssText='display:flex;align-items:center;gap:16px';
 const key=text('input','',keyRow);key.type='password';key.autocomplete='off';key.style.cssText='flex:1;min-width:0';
 const deleteKey=button('APIキーを削除',async()=>{
  if(!window.confirm(`${PROVIDERS[shown]}の保存済みAPIキーを削除しますか？`))return;
  await onDelete(shown);drafts.profiles[shown].key='';key.value='';baseline=JSON.stringify(initial());render();
 },keyRow);deleteKey.className='danger';
 const accountLabel=text('label','CloudflareアカウントID',box),account=text('input','',accountLabel);account.type='text';account.setAttribute('aria-label','CloudflareアカウントID');
 const modelLabel=text('label','モデル',box),model=text('select','',modelLabel);model.setAttribute('aria-label','AIモデル');
 const hint=text('p','',box,'hint');
 const describe=e=>[e?.message||'処理に失敗しました。',e?.advice||''].filter(Boolean).join('\n');
 const permission=button('この接続先への通信を許可',async()=>{
  const id=shown,token=revision;
  try{
   const granted=await bridge.requestAIOrigin(id);
   if(token!==revision||shown!==id)return;
   status.textContent=granted?'接続先への通信を許可しました。':'通信は許可されませんでした。';
   if(granted){forceSave=true;await applySettings();}
  }catch(e){if(token===revision&&shown===id)status.textContent='接続許可を確認できませんでした。設定画面を開き直して再操作してください。\n'+describe(e);}
 },box);
 function capture(){
  const p=drafts.profiles[shown];if(key.value.trim())p.key=key.value.trim();
  if(shown==='clef'){p.accountId=account.value.trim();p.model=model.value;}
 }
 function render(){
  const p=drafts.profiles[shown];key.value='';
  key.setAttribute('aria-label',shown==='jev'?'Jev APIキー':shown==='clef'?'Cloudflare APIトークン':'OpenAI APIキー');
  key.placeholder=p.key?'APIキー登録済み（変更時だけ入力）':shown==='clef'?'Workers AI権限を持つAPIトークン':shown==='openai'?'OpenAI APIキー':`${PROVIDERS[shown]} APIキー`;
  accountLabel.hidden=shown!=='clef';account.value=p.accountId;
  modelLabel.hidden=shown!=='clef';model.replaceChildren();
  const values=shown==='clef'?['clef','clef-flash']:p.model?[p.model]:[''];
  for(const value of values){const o=text('option',value,model);o.value=value;}model.value=p.model;
  permission.hidden=shown==='jev';
  hint.textContent=(shown==='openai'?'通常のOpenAI APIキーを使用します。':'')+`${PROVIDERS[shown]}へ記事テキストと判定条件を送信します。利用料金は接続先との契約に従います。`;
 }
 provider.addEventListener('change',()=>{capture();shown=provider.value;drafts.provider=shown;revision++;render();});
 render();
 return {key,read:old=>{capture();if(JSON.stringify(initial(old))!==baseline)throw Error('別の画面で接続設定が変更されました。設定画面を開き直してください。');return {...old,provider:shown,profiles:structuredClone(drafts.profiles),key:drafts.profiles.jev.key};},
  changed:()=>{capture();return forceSave||baseline!==JSON.stringify(drafts);},
  changedKey:()=>{capture();return drafts.profiles[shown].key!==profileOf(local(),shown).key;},
  check:()=>{capture();const p=drafts.profiles[shown];if(shown==='clef'&&p.accountId&&!/^[a-f\d]{32}$/i.test(p.accountId))throw Error('CloudflareアカウントIDは32桁です');},
  saved:()=>{forceSave=false;baseline=JSON.stringify(drafts);key.value='';key.placeholder=drafts.profiles[shown].key?'APIキー登録済み（変更時だけ入力）':key.placeholder;}};
}
