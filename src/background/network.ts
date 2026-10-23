import {aiError,httpError} from '../shared/ai-errors.js';
import {ollayaBase,readModels} from '../shared/ai.js';
import {AI_LOCAL,connection,connectionOrigin,connectionIdentity} from '../shared/ai.js';
export async function fetchResult(url:string,options:RequestInit,timeoutMs:number,provider='',phase='判定'){
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  const response=await fetch(url,{...options,credentials:'omit',redirect:'error',signal:controller.signal});
  const responseText=await response.text();if(responseText.length>6_000_000)throw provider?aiError(provider,'size'):Error('応答が大きすぎます');
  return {status:response.status,responseText,responseHeaders:Array.from(response.headers).map(([k,v])=>k+': '+v).join('\r\n'),finalUrl:response.url};
 }catch(e){if(!provider)throw e;if(e&&typeof e==='object'&&'kind' in e)throw e;throw aiError(provider,controller.signal.aborted?'timeout':'network',{phase});}finally{clearTimeout(timeout);}
}
export async function network(message:any){
 const r=message.request,u=new URL(r.url);
 const article=u.origin==='https://news.yahoo.co.jp'&&r.method==='GET'&&/^\/(articles|pickup|expert\/articles)\/[^/]+\/?$/.test(u.pathname);
 if(article)return fetchResult(u.href,{method:'GET'},12000);
 let local;try{local=(await chrome.storage.local.get(AI_LOCAL))[AI_LOCAL]||{};}catch{throw aiError('','storage');}
 const c=connection(local);
 if(r.method!=='POST'||u.href!==c.url||r.connection!==connectionIdentity(local))throw aiError(c.provider,'changed');
 if(c.provider!=='ollaya'&&!c.key)throw aiError(c.provider,'credentials');
 if(!await chrome.permissions.contains({origins:[connectionOrigin(c.provider,c.baseUrl)]}))throw aiError(c.provider,'permission');
 const body=JSON.parse(r.data);
 if(body.model!==c.model)throw aiError(c.provider,'changed');
 return fetchResult(u.href,{method:'POST',headers:{'Content-Type':'application/json',...(c.key?{Authorization:'Bearer '+c.key}:{})},body:r.data},c.timeout,c.provider);
}

export async function listModels(baseUrl:string){
 const base=ollayaBase(baseUrl);
 if(!await chrome.permissions.contains({origins:[connectionOrigin('ollaya',base)]}))throw aiError('ollaya','permission');
 const result=await fetchResult(base+'/v1/models',{method:'GET'},12000,'ollaya','モデル一覧取得');
 if(result.status!==200)throw httpError('ollaya',result.status,result.responseText,'モデル一覧取得');
 let data;try{data=JSON.parse(result.responseText);}catch{throw aiError('ollaya','format',{phase:'モデル一覧取得'});}
 return readModels(data);
}
