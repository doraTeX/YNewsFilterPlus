// 両版共通：ホバーとキーボード操作を区別し、クリック後のフォーカス復帰では開かない。
export function createHoverMenu({container,root=container.ownerDocument,render,alive=()=>true}){
 const doc=container.ownerDocument,win=doc.defaultView,listeners=[];
 let pointerInside=false,keyboard=false,dismissed=true,disposed=false;
 const ownsFocus=()=>container.contains(root.activeElement);
 const inside=event=>{const path=event.composedPath();return path.includes(container)||(root.host&&path.includes(root.host));};
 function dispose(){if(disposed)return;disposed=true;for(const [target,type,fn,capture]of listeners)target.removeEventListener(type,fn,capture);render(false);}
 function refresh(){if(disposed)return;if(!alive()){dispose();return;}render(!dismissed&&(pointerInside||(keyboard&&ownsFocus())));}
 function dismiss(){pointerInside=false;keyboard=false;dismissed=true;refresh();}
 function listen(target,type,fn,capture=false){target.addEventListener(type,fn,capture);listeners.push([target,type,fn,capture]);}
 listen(container,'mouseenter',()=>{pointerInside=true;dismissed=false;refresh();});
 listen(container,'mouseleave',dismiss);
 listen(container,'focusout',()=>queueMicrotask(refresh));
 listen(doc,'focusin',()=>{if(!ownsFocus())dismiss();else refresh();},true);
 listen(doc,'pointerdown',event=>{keyboard=false;if(!inside(event))dismiss();else refresh();},true);
 listen(doc,'pointermove',event=>{if(inside(event)){pointerInside=true;keyboard=false;dismissed=false;refresh();}else if(pointerInside||keyboard)dismiss();},true);
 listen(doc,'keydown',event=>{
  if(event.key==='Tab'||(ownsFocus()&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End','Enter',' '].includes(event.key))){keyboard=true;dismissed=false;queueMicrotask(refresh);}
  else if(event.key==='Escape'&&ownsFocus())dismiss();
 },true);
 if(win)listen(win,'blur',dismiss);
 listen(doc,'visibilitychange',()=>{if(doc.hidden)dismiss();});
 refresh();return {refresh,dismiss,dispose};
}
