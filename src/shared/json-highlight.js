// JSONをテキストノードとして描画し、設定内のHTMLを実行しない。
export function renderJSON(code,value){
 const source=JSON.stringify(value,null,2)??'null';
 const tokens=/("(?:\\.|[^"\\])*")(?=\s*:)|"(?:\\.|[^"\\])*"|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|[{}\[\],:]/g;
 const fragment=document.createDocumentFragment();let offset=0;
 for(const match of source.matchAll(tokens)){
  fragment.append(document.createTextNode(source.slice(offset,match.index)));
  const token=match[0],span=document.createElement('span');
  const kind=match[1]?'key':token.startsWith('"')?'string':token==='null'?'null':token==='true'||token==='false'?'boolean':/^-?\d/.test(token)?'number':'punctuation';
  span.className='json-'+kind;span.textContent=token;fragment.append(span);offset=match.index+token.length;
 }
 fragment.append(document.createTextNode(source.slice(offset)));code.replaceChildren(fragment);
}
