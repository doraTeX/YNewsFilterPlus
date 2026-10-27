import {validate} from './settings.js';
export const SETTINGS='yne_plus_settings_v2';
export const HISTORY='yne_plus_settings_history_v2';
export type Settings=ReturnType<typeof validate>;
export type Doc={schema:1;clock:Record<string,number>;settings:Settings};
const encoder=new TextEncoder();
export function dominates(a:Doc,b:Doc){return Object.keys({...a.clock,...b.clock}).every(k=>(a.clock[k]||0)>=(b.clock[k]||0))&&Object.keys(a.clock).some(k=>(a.clock[k]||0)>(b.clock[k]||0));}
export function heads(docs:Doc[]){return docs.filter((d,i)=>!docs.some((o,j)=>i!==j&&dominates(o,d))).filter((d,i,all)=>all.findIndex(o=>JSON.stringify(o)===JSON.stringify(d))===i);}
export function newDoc(settings:Settings,device:string,bases:Doc[]):Doc{
 const clock:Record<string,number>={};for(const b of bases)for(const [k,v]of Object.entries(b.clock))clock[k]=Math.max(clock[k]||0,v);
 clock[device]=(clock[device]||0)+1;return {schema:1,clock,settings:validate(settings)};
}
export function parseDoc(s:string):Doc{
 const d=JSON.parse(s);if(d.schema!==1||!d.clock||Array.isArray(d.clock)||typeof d.clock!=='object')throw Error('同期データ形式が不正です');
 const entries=Object.entries(d.clock);if(!entries.length||entries.length>100)throw Error('同期履歴が不正です');
 for(const [k,v]of entries)if(!/^[a-zA-Z0-9-]{1,80}$/.test(k)||['__proto__','constructor','prototype'].includes(k)||!Number.isSafeInteger(v)||Number(v)<1)throw Error('同期履歴が不正です');
 return {schema:1,clock:d.clock,settings:validate(d.settings)};
}
export function chunks(text:string):string[]{
 // UTF-8とJSONエスケープ後の実サイズで分割する。
 const out:string[]=[];let part='';for(const c of text){if(encoder.encode(JSON.stringify(part+c)).length>7000){out.push(part);part='';}part+=c;}out.push(part);return out;
}
export async function digest(s:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(s))),b=>b.toString(16).padStart(2,'0')).join('');}
export async function encodeDoc(doc:Doc,device:string){
 const text=JSON.stringify({...doc,settings:validate(doc.settings)}),pieces=chunks(text),prefix='ynfp:'+device+':';
 const items:Record<string,unknown>={};pieces.forEach((p,i)=>items[prefix+i]=p);
 items[prefix+'meta']={count:pieces.length,hash:await digest(text)};return items;
}
export async function decodeRemote(items:Record<string,unknown>):Promise<Doc[]>{
 const docs:Doc[]=[];
 for(const k of Object.keys(items).filter(k=>/^ynfp:[a-zA-Z0-9-]+:meta$/.test(k))){
  const meta=items[k] as {count:number;hash:string};
  if(!Number.isSafeInteger(meta?.count)||meta.count<1||meta.count>100||typeof meta.hash!=='string')throw Error('同期メタデータが不正です');
  const prefix=k.slice(0,-4);let text='';for(let i=0;i<meta.count;i++){if(typeof items[prefix+i]!=='string')throw Error('同期データの到着待ちです。端末の設定を保持しています');text+=items[prefix+i];}
  if(await digest(text)!==meta.hash)throw Error('同期データの到着待ちです。端末の設定を保持しています');docs.push(parseDoc(text));
 }return docs;
}
export function assertQuota(items:Record<string,unknown>){
 let total=0;for(const [k,v]of Object.entries(items)){const n=encoder.encode(k).length+encoder.encode(JSON.stringify(v)).length;if(n>8192)throw Error('同期項目が8KBを超えています');total+=n;}
 if(total>95000||Object.keys(items).length>500)throw Error('Chrome同期の容量が不足しています。端末の設定は保存済みです。同期する条件を減らしてください');
}
