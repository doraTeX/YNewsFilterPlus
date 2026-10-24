import {it,expect} from 'vitest';
import {highlightHoverColor,highlightLab,highlightCSS} from '../src/shared/highlight.js';
it.each(['#b1ff95','#aaff88','#fff3bf','#ffffff','#dddddd','#ffff00','#00ff00','#ffaaaa','#293170','#000000','#222222','#0000ff','#ff0000','#800080'])('元の色相を保ち%sをhover時に強調する',color=>{
 const hover=highlightHoverColor(color),[L,a,b]=highlightLab(color),[next,x,y]=highlightLab(hover);
 expect(hover).toMatch(/^#[0-9a-f]{6}$/);
 expect(Math.hypot(next-L,x-a,y-b)).toBeGreaterThanOrEqual(.06);
 if(Math.hypot(a,b)>.03&&Math.hypot(x,y)>.03){
  const cosine=(a*x+b*y)/(Math.hypot(a,b)*Math.hypot(x,y));
  expect(cosine).toBeGreaterThan(.995);
 }
});
it('hoverとキーボード操作に同じ背景を適用しリンクのhover背景を透明にする',()=>{
 const css=highlightCSS('hidden','highlight','#fff3bf');
 expect(css).toContain('[highlight]:hover,[highlight]:focus-within{background-color:'+highlightHoverColor('#fff3bf')+'!important');
 expect(css).toContain('[highlight] a:hover{background-color:transparent!important}');
 expect(css).toContain('prefers-reduced-motion:reduce');
});

it('カテゴリ記事の内側のhover背景を抑え、画像や無関係な枠には適用しない',()=>{
 document.body.innerHTML='<li data-highlight><div><div id="body"><div id="thumbnail"><img></div><div><a data-ual-gotocontent="true">記事</a></div></div><div id="other">別の枠</div></div></li>';
 const selector='[data-highlight] div:has(> div > a[data-ual-gotocontent="true"])';
 expect(Array.from(document.querySelectorAll(selector)).map(e=>e.id)).toEqual(['body']);
 const css=highlightCSS('hidden','data-highlight','#fff3bf');
 expect(css).toContain(`${selector},${selector}:hover{background-color:transparent!important}`);
});

it('淡い黄色は明るさをほぼ維持して彩度を増し、くすませない',()=>{
 const [L,a,b]=highlightLab('#fff3bf'),[next,x,y]=highlightLab(highlightHoverColor('#fff3bf'));
 expect(Math.abs(next-L)).toBeLessThan(.045);
 expect(Math.hypot(x,y)).toBeGreaterThan(Math.hypot(a,b)*1.15);
});
it('hover時も背景と同色の補助描画に留め、枠線を付けない',()=>{
 for(const color of ['#fff3bf','#293170','#ffffff','#888888','#000000']){
  const css=highlightCSS('hidden','highlight',color);
  expect(css).toContain(`box-shadow:inset 4px 0 ${highlightHoverColor(color)}!important`);
  expect(css).not.toContain("inset 0 0 0 2px");
 }
});

it('sRGB全域の代表色で、変換後にも十分な色差が残る',()=>{
 for(let r=0;r<=255;r+=51)for(let g=0;g<=255;g+=51)for(let b=0;b<=255;b+=51){
  const color='#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');
  const original=highlightLab(color),hover=highlightHoverColor(color);
  expect(hover).toMatch(/^#[0-9a-f]{6}$/);
  expect(Math.hypot(...highlightLab(hover).map((v,i)=>v-original[i]))).toBeGreaterThanOrEqual(.06);
 }
});
