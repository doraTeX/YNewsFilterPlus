// 両拡張で同じ形・操作の一時停止ショートカットを使う。
export function createPauseControl({toggle,pauseLabel,resumeLabel}){
 const host=document.createElement('span');host.dataset.pauseControl='';host.hidden=true;
 const root=host.attachShadow({mode:'closed'}),style=document.createElement('style');
 style.textContent=`:host{position:absolute;left:-8px;top:-8px;z-index:2147483647;line-height:0;color-scheme:light}:host([hidden]){display:none!important}button{display:flex;align-items:center;justify-content:center;width:22px;height:22px;margin:0;padding:4px;border:1px solid white;border-radius:50%;background:#d93025;color:#fff;box-shadow:0 1px 5px #102a4340;cursor:pointer;box-sizing:border-box}button[aria-pressed="true"]{background:#159447}button:focus-visible{outline:2px solid #1768bd;outline-offset:2px}button:disabled{cursor:default;opacity:.5}svg{display:block;width:12px;height:12px;fill:currentColor}`;
 const button=document.createElement('button');button.type='button';
 const pauseIcon='<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 1h3v10H2zM7 1h3v10H7z"/></svg>';
 const resumeIcon='<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1l8 5-8 5z"/></svg>';
 button.addEventListener('click',event=>{event.stopPropagation();toggle();});root.append(style,button);
 function update(paused,disabled=false){
  const label=paused?resumeLabel:pauseLabel;
  button.title=label;button.setAttribute('aria-label',label);button.disabled=disabled;
  if(button.getAttribute('aria-pressed')!==String(paused)){button.setAttribute('aria-pressed',String(paused));button.innerHTML=paused?resumeIcon:pauseIcon;}
 }
 update(false);
 return {host,button,update,setVisible(visible){host.hidden=!visible;}};
}
