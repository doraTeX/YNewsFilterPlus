import {startEngine} from '../content/engine.js';
import {GM,bridge} from '../shared/bridge';
let open:()=>void=()=>{};
const adapter={...GM,registerMenuCommand:async(name:string,fn:()=>void)=>{if(name.endsWith('設定'))open=fn;}};
document.getElementById('open')!.onclick=()=>open();
void startEngine(adapter,bridge).catch(e=>{document.body.append(document.createTextNode(String(e)));});
