import {it,expect} from 'vitest';
import {renderJSON} from '../src/shared/json-highlight.js';
it('JSONの整形と内容を維持し、キー・文字列・数値・真偽値・nullを色分けする',()=>{
 const code=document.createElement('code'),value={rows:['例: \\"日本語"'],threshold:0.8,negative:-2.5e-10,enabled:true,paused:false,empty:null};renderJSON(code,value);
 expect(code.textContent).toBe(JSON.stringify(value,null,2));
 expect(code.querySelector('.json-key')!.textContent).toBe('"rows"');expect(code.querySelector('.json-string')!.textContent).toBe(JSON.stringify(value.rows[0]));
 expect(Array.from(code.querySelectorAll('.json-number')).map(e=>e.textContent)).toEqual(['0.8','-2.5e-10']);
 expect(Array.from(code.querySelectorAll('.json-boolean')).map(e=>e.textContent)).toEqual(['true','false']);expect(code.querySelector('.json-null')!.textContent).toBe('null');
});
it('HTMLやエスケープを含む設定値も文字として表示し、再描画で古い内容を残さない',()=>{
 const code=document.createElement('code'),value={'<img src=x onerror=alert(1)>':'</code><script>alert(1)</script>\n"\\'};renderJSON(code,value);
 expect(code.textContent).toBe(JSON.stringify(value,null,2));expect(code.querySelector('img,script')).toBeNull();renderJSON(code,{rows:[]});expect(code.textContent).toBe(JSON.stringify({rows:[]},null,2));
});
