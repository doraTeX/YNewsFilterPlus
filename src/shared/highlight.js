// Work in OKLab's perceptual lightness; scaling a/b preserves OKLCH hue.
const linear=v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4;
const srgb=v=>v<=.0031308?12.92*v:1.055*v**(1/2.4)-.055;
export function highlightLab(hex){
 const [r,g,b]=hex.slice(1).match(/../g).map(v=>linear(parseInt(v,16)/255));
 const l=Math.cbrt(.4122214708*r+.5363325363*g+.0514459929*b);
 const m=Math.cbrt(.2119034982*r+.6806995451*g+.1073969566*b);
 const s=Math.cbrt(.0883024619*r+.2817188376*g+.6299787005*b);
 return [.2104542553*l+.793617785*m-.0040720468*s,1.9779984951*l-2.428592205*m+.4505937099*s,.0259040371*l+.7827717662*m-.808675766*s];
}
function rgb(L,a,b){
 const l=(L+.3963377774*a+.2158037573*b)**3;
 const m=(L-.1055613458*a-.0638541728*b)**3;
 const s=(L-.0894841775*a-1.291485548*b)**3;
 return [4.0767416621*l-3.3077115913*m+.2309699292*s,-1.2684380046*l+2.6097574011*m-.3413193965*s,-.0041960863*l-.7034186147*m+1.707614701*s];
}
// Map into sRGB by reducing chroma at constant lightness and hue.
function gamutColor(L,a,b){
 let lo=0,hi=1;
 for(let i=0;i<24;i++){
  const scale=(lo+hi)/2;
  if(rgb(L,a*scale,b*scale).every(v=>v>=0&&v<=1))lo=scale;else hi=scale;
 }
 return '#'+rgb(L,a*lo,b*lo).map(v=>Math.round(Math.max(0,Math.min(1,srgb(v)))*255).toString(16).padStart(2,'0')).join('');
}
const hoverColors=new Map();
export function highlightHoverColor(hex){
 if(hoverColors.has(hex))return hoverColors.get(hex);
 const original=highlightLab(hex),[light,a,b]=original,chroma=Math.hypot(a,b);
 // Check the displayed, gamut-mapped color: requesting more chroma alone
 // can produce almost no change near the sRGB boundary.
 const distance=color=>Math.hypot(...highlightLab(color).map((v,i)=>v-original[i]));
 const scale=chroma<.02?1:(chroma+.09)/chroma;
 let result;
 if(chroma>=.02&&light>=.65){
  // Prefer vividness, allowing only a small decrease in lightness.
  for(const offset of [0,.01,.02,.03,.04]){
   const candidate=gamutColor(light-offset,a*scale,b*scale);
   if(distance(candidate)>=.06){result=candidate;break;}
  }
 }
 if(!result){
  // When saturation cannot increase, brighten instead of dulling the color.
  const direction=light<=.9?1:-1;
  for(let step=8;step<=20;step++){
   const L=Math.max(direction>0?.18:0,Math.min(1,light+direction*step/100));
   const candidate=gamutColor(L,a*scale,b*scale);
   if(distance(candidate)>=.06){result=candidate;break;}
  }
 }
 if(hoverColors.size>=64)hoverColors.clear();
 hoverColors.set(hex,result);
 return result;
}
export function highlightCSS(mark,highlight,color){
 const card=`[${highlight}]`,hover=highlightHoverColor(color);
 // Yahoo category feeds paint hover on the inner thumbnail/title wrapper, not the link.
 // Match its semantic title link, avoiding generated class names and image backgrounds.
 const feedBody=`${card} div:has(> div > a[data-ual-gotocontent="true"])`;
 return `[${mark}]{display:none!important}${card}{background-color:${color}!important;box-shadow:inset 4px 0 ${color}!important;transition:background-color 120ms ease,box-shadow 120ms ease!important}${card} a,${card} a:hover{background-color:transparent!important}${feedBody},${feedBody}:hover{background-color:transparent!important}${card}:hover,${card}:focus-within{background-color:${hover}!important;box-shadow:inset 4px 0 ${hover}!important}${card}:hover a,${card}:focus-within a{background-color:transparent!important}@media(prefers-reduced-motion:reduce){${card}{transition:none!important}}`;
}
