import {initializeReportFilters} from './filters';
const id=new URL(location.href).searchParams.get('id');
const key='report:'+id;
const data=(await chrome.storage.session.get(key))[key];
if(typeof data!=='string'){document.body.textContent='判定詳細が見つかりません。元のページから開き直してください。';}
else{
 // 表はページ内に展開済み。セッション領域（上限10MB）に溜めないよう、読み込めたら直ちに削除する。
 void chrome.storage.session.remove(key);
 const doc=new DOMParser().parseFromString(data,'text/html');
 // HTMLは拡張自身がエスケープして生成。念のため能動的要素と属性を除去する。
 doc.querySelectorAll('script,iframe,object,embed,link,base,form').forEach(e=>e.remove());
 doc.querySelectorAll('*').forEach(e=>{for(const a of Array.from(e.attributes))if(a.name.startsWith('on')||a.name==='srcdoc'||a.name==='src')e.removeAttribute(a.name);});
 doc.querySelectorAll('a').forEach(a=>{if(!/^https:\/\//.test(a.href))a.removeAttribute('href');a.rel='noopener noreferrer';});
 doc.querySelectorAll('style').forEach(s=>document.head.append(s));document.body.replaceChildren(...Array.from(doc.body.childNodes));
 initializeReportFilters(document);
}
export {};
