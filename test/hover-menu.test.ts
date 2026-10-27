import {afterEach,it,expect} from 'vitest';
import {createHoverMenu} from '../src/content/hover-menu.js';
const cleanups:Array<()=>void>=[];
afterEach(()=>{cleanups.splice(0).forEach(fn=>fn());document.body.replaceChildren();});
function setup(shadow:boolean){
 const host=document.createElement('div');document.body.append(host);const root=shadow?host.attachShadow({mode:'closed'}):document;
 const container=document.createElement('div'),button=document.createElement('button'),tag=document.createElement('button');button.textContent='設定';tag.textContent='条件';container.append(button,tag);(shadow?root:host).append(container);
 let visible=false;const menu=createHoverMenu({container,root,render:(next:boolean)=>{visible=next;}});cleanups.push(menu.dispose);return {host,container,button,tag,menu,visible:()=>visible};
}
it.each([false,true])('shadow=%s: クリック後もポインター退出で閉じ、残ったフォーカスで再表示しない',shadow=>{
 const ui=setup(shadow);ui.container.dispatchEvent(new Event('mouseenter'));ui.tag.focus();expect(ui.visible()).toBe(true);ui.container.dispatchEvent(new Event('mouseleave'));expect(ui.visible()).toBe(false);ui.menu.refresh();expect(ui.visible()).toBe(false);
});
it.each([false,true])('shadow=%s: 設定の開閉でフォーカスが戻っても閉じたまま、次のホバーで開く',shadow=>{
 const ui=setup(shadow),field=document.createElement('input');document.body.append(field);ui.container.dispatchEvent(new Event('mouseenter'));ui.button.focus();expect(ui.visible()).toBe(true);
 field.focus();expect(ui.visible()).toBe(false);ui.button.focus();expect(ui.visible()).toBe(false);ui.menu.refresh();expect(ui.visible()).toBe(false);ui.container.dispatchEvent(new Event('mouseenter'));expect(ui.visible()).toBe(true);
});
it.each([false,true])('shadow=%s: Tabで開き、タグ間の移動を保持し、外への移動・Escapeで閉じる',async shadow=>{
 const ui=setup(shadow),outside=document.createElement('button');document.body.append(outside);
 document.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',bubbles:true}));ui.button.focus();await Promise.resolve();expect(ui.visible()).toBe(true);ui.tag.focus();await Promise.resolve();expect(ui.visible()).toBe(true);
 outside.focus();await Promise.resolve();expect(ui.visible()).toBe(false);
 document.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',bubbles:true}));ui.button.focus();await Promise.resolve();expect(ui.visible()).toBe(true);ui.button.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,composed:true}));expect(ui.visible()).toBe(false);
});
it.each([false,true])('shadow=%s: 退出イベントがなくても外側のポインター移動やウィンドウ離脱で閉じる',shadow=>{
 const ui=setup(shadow);ui.container.dispatchEvent(new Event('mouseenter'));document.body.dispatchEvent(new MouseEvent('pointermove',{bubbles:true,composed:true}));expect(ui.visible()).toBe(false);
 ui.tag.dispatchEvent(new MouseEvent('pointermove',{bubbles:true,composed:true}));expect(ui.visible()).toBe(true);window.dispatchEvent(new Event('blur'));expect(ui.visible()).toBe(false);
});
it.each([false,true])('shadow=%s: 解除後はポインター・キーボードで再表示しない',async shadow=>{
 const ui=setup(shadow);ui.container.dispatchEvent(new Event('mouseenter'));ui.menu.dispose();ui.container.dispatchEvent(new Event('mouseenter'));document.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',bubbles:true}));ui.button.focus();await Promise.resolve();expect(ui.visible()).toBe(false);
});
