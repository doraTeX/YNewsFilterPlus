import {startEngine} from '../src/content/engine.js';
import {defaults} from '../src/shared/settings.js';
const settings={...defaults,rows:['ネタバレ','プレゼント企画']},values:Record<string,unknown>={yne_plus_settings_v2:settings};
let open=()=>{};
const conflicts=[{schema:1,clock:{local:1},settings:{rows:['ネタバレ','プレゼント企画'],aiConditions:['スポーツ']}},{schema:1,clock:{cloud:1},settings:{rows:['ネタバレ','芸能'],aiConditions:['格闘技']}}];
await startEngine({getValue:async(key:string,fallback:unknown)=>structuredClone(values[key]??fallback),setValue:async(key:string,value:unknown)=>{values[key]=structuredClone(value);},registerMenuCommand:async(name:string,fn:()=>void)=>{if(name==='Y!News Filter Plus 設定')open=fn;}},
 {isConnected:()=>true,saveSettings:async(value:unknown)=>{values.yne_plus_settings_v2=structuredClone(value);},sync:async()=>{},syncStatus:async()=>({enabled:true,message:'設定が競合しています。内容を比較して採用する設定を選んでください',conflicts,conflictSources:['local','cloud']}),setSyncEnabled:async()=>{},resolve:async()=>{},openReport:async()=>{},updateBadge:async()=>{},onSettingsChanged:()=>()=>{}});
open();
