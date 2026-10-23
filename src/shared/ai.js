import {aiError} from './ai-errors.js';
// Connection settings are local to this browser; legacy `key` belongs only to Jev.
export const AI_LOCAL='yne_plus_jev_local_v1';
export const PROVIDERS={jev:'Jev',clef:'Cloudflare Clef',openai:'OpenAI Decisions',ollaya:'Ollaya（ローカル）'};
export function providerOf(local={}){const id=local.provider||'jev';if(!Object.hasOwn(PROVIDERS,id))throw Error('未対応の接続先です');return id;}
export function profileOf(local={},id=providerOf(local)){
 const saved=local.profiles?.[id]||{};
 return {key:id==='jev'?(saved.key??local.key??''):(saved.key||''),accountId:saved.accountId||'',model:saved.model||(id==='jev'?'jev-1.13.0':id==='openai'?'gpt-6-luna':id==='clef'?'clef':''),baseUrl:saved.baseUrl||'http://localhost:11435'};
}
export function ollayaBase(value){
 let u;try{u=new URL(value);}catch{throw Error('OllayaのサーバーURLを入力してください');}
 if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.search||u.hash||u.pathname!=='/')throw Error('OllayaのURLは http(s)://ホスト:ポート の形式にしてください');
 return u.origin;
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
 if(provider==='ollaya')url=ollayaBase(p.baseUrl)+'/v1/systemone';
 if(!p.model.trim())throw Error('Ollayaのモデルを選択してください');
 return {provider,...p,url,key:provider==='ollaya'?'':p.key,timeout:provider==='ollaya'?120000:30000};
}
export function connectionReady(local){try{const c=connection(local);return c.provider==='ollaya'||!!c.key.trim();}catch{return false;}}
export function connectionIdentity(local){try{const c=connection(local);return JSON.stringify([c.provider,c.url,c.model]);}catch{const p=local.profiles?.[local.provider]||{};return JSON.stringify([local.provider,p.baseUrl,p.model,p.accountId]);}}
export function connectionOrigin(id,baseUrl){
 const url=id==='ollaya'?ollayaBase(baseUrl):({jev:'https://api.typesafe.ai',clef:'https://api.cloudflare.com',openai:'https://api.openai.com'})[id];
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
  if(c.provider!=='openai')return data.answers?.['q'+i]?.noul;
  const matches=Array.isArray(data.answers)?data.answers.filter(a=>a?.name==='q'+i):[];
  if(matches.length!==1)throw aiError(c.provider,'format');
  if(matches[0].type==='refusal')throw aiError(c.provider,'refusal');
  if(matches[0].type!=='predicate')throw aiError(c.provider,'format');
  return matches[0].probability;
 });
 if(!scores.every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1))throw aiError(c.provider,'format');
 return {scores,usage:data.usage};
}
export function readModels(raw){
 if(!Array.isArray(raw?.models)||raw.models.some(m=>typeof m?.name!=='string'||!m.name.trim()))throw aiError('ollaya','format',{phase:'モデル一覧取得'});
 return [...new Set(raw.models.map(m=>m.name))];
}
