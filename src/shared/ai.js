import {aiError} from './ai-errors.js';
// Connection settings are local to this browser; legacy `key` belongs only to Jev.
export const AI_LOCAL='yne_plus_jev_local_v1';
export const PROVIDERS={jev:'Jev',openai:'OpenAI Decisions',clef:'Cloudflare Clef'};
export function providerOf(local={}){const id=local.provider||'jev';if(!Object.hasOwn(PROVIDERS,id))throw Error('未対応の接続先です');return id;}
export function profileOf(local={},id=providerOf(local)){
 const saved=local.profiles?.[id]||{};
 return {key:id==='jev'?(saved.key??local.key??''):(saved.key||''),accountId:saved.accountId||'',model:saved.model||(id==='jev'?'jev-1.13.0':id==='openai'?'gpt-6-luna':id==='clef'?'clef':'')};
}
export function connection(local={}){
 const provider=providerOf(local),p=profileOf(local,provider);
 let url;
 if(provider==='jev')url='https://api.typesafe.ai/v1/systemone';
 if(provider==='openai')url='https://api.openai.com/v1/decisions';
 if(provider==='clef'){
  if(!/^[a-f\d]{32}$/i.test(p.accountId))throw Error('CloudflareのアカウントID（32桁）を入力してください');
  if(!['clef','clef-flash'].includes(p.model))throw Error('Clefのモデルを選択してください');
  url=`https://api.cloudflare.com/client/v4/accounts/${p.accountId}/ai/run/@cf/cloudflare/${p.model}`;
 }
 return {provider,...p,url,key:p.key,timeout:30000};
}
export function connectionReady(local){try{const c=connection(local);return !!c.key.trim();}catch{return false;}}
export function connectionIdentity(local){try{const c=connection(local);return JSON.stringify([c.provider,c.url,c.model]);}catch{const p=local.profiles?.[local.provider]||{};return JSON.stringify([local.provider,p.baseUrl,p.model,p.accountId]);}}
export function connectionOrigin(id){
 const url=({jev:'https://api.typesafe.ai',clef:'https://api.cloudflare.com',openai:'https://api.openai.com'})[id];
 if(!url)throw Error('未対応の接続先です');
 // Chrome host patterns do not include a port; network requests still validate the exact URL.
 return new URL(url).protocol+'//'+new URL(url).hostname+'/*';
}
export function requestBody(c,content,questions){
 if(c.provider==='openai')return {model:c.model,input:content,questions:Object.entries(questions).map(([name,q])=>({name,type:'predicate',instructions:q.instructions+'\n真の場合：'+q.criteria.true+'\n偽の場合：'+q.criteria.false}))};
 return {model:c.model,state:{news_text:content},questions};
}
export function readDecision(c,raw,targets){
 let data=raw;
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw aiError(c.provider,'format');
 if(c.provider==='clef'&&Object.hasOwn(raw,'success')){if(raw.success!==true)throw aiError(c.provider,'provider');data=raw.result;}
 if(!data||typeof data!=='object')throw aiError(c.provider,'format');
 const scores=targets.map(i=>{
  if(c.provider!=='openai'){
   const answer=data.answers?.['q'+i];
   if(answer?.type==='refusal')throw aiError(c.provider,'refusal');
   return answer?.noul;
  }
  const matches=Array.isArray(data.answers)?data.answers.filter(a=>a?.name==='q'+i):[];
  if(matches.length!==1)throw aiError(c.provider,'format');
  if(matches[0].type==='refusal')throw aiError(c.provider,'refusal');
  if(matches[0].type!=='predicate')throw aiError(c.provider,'format');
  return matches[0].probability;
 });
 if(!scores.every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1))throw aiError(c.provider,'format');
 return {scores,usage:data.usage};
}

// Retired experimental provider: keep other credentials, and never silently switch to a paid API.
/** @param {Record<string, any>} local */
export function migrateRetiredAI(local={}){
 if(local.errorKind==='refusal')local={...local,stopped:false,failures:0,blockedUntil:0,lastError:'',lastErrorAt:'',errorKind:'',errorAdvice:'',errorFocusKey:false,errorProvider:''};
 const retired=['nano','ollaya'];
 if(!retired.includes(local.provider)&&!retired.some(id=>Object.hasOwn(local.profiles||{},id)))return local;
 const profiles={...local.profiles};for(const id of retired)delete profiles[id];
 return {...local,profiles,...(retired.includes(local.provider)?{provider:'jev',stopped:true,failures:0,blockedUntil:0,
  lastError:'選択していたAIの対応を終了しました。利用するAIを選び直してください。',errorKind:'retired',errorProvider:'',errorFocusKey:false,
  errorAdvice:'設定画面で利用するAIを選び、設定を確認してから再試行してください。'}:{})};
}
