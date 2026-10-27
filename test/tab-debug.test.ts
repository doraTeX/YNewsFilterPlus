import {it,expect,vi} from 'vitest';
import {TabDebug} from '../src/background/tab-debug';
function setup(){const data:Record<string,unknown>={};const storage={get:async(key:string)=>({...data,[key]:data[key]}),set:async(value:Record<string,unknown>)=>{Object.assign(data,value);},remove:async(key:string)=>{delete data[key];}};return {data,storage,debug:new TabDebug(storage,'debug:')};}
it('同じタブのリロードやワーカー再起動ではONを保ち、新しいタブはOFF',async()=>{
 const {storage,debug}=setup();await debug.set(1,true);expect(await debug.get(1)).toBe(true);expect(await new TabDebug(storage,'debug:').get(1)).toBe(true);expect(await debug.get(2)).toBe(false);
});
it('タブ終了後やブラウザセッションが空のときはOFF',async()=>{
 const {debug,data}=setup();await debug.set(1,true);await debug.forget(1);expect(await debug.get(1)).toBe(false);expect(data).toEqual({});expect(await setup().debug.get(1)).toBe(false);
});
it('連続ON/OFFと閉じる処理が競合しても、最後のOFFを保持する',async()=>{
 const {storage,data}=setup();let release!:()=>void;const write=storage.set;storage.set=vi.fn(async(value)=>{await new Promise<void>(resolve=>{release=resolve;});await write(value);});
 const debug=new TabDebug(storage,'debug:'),on=debug.set(1,true);const off=debug.forget(1);await vi.waitFor(()=>expect(release).toBeTruthy());release();await Promise.all([on,off]);expect(await debug.get(1)).toBe(false);expect(data).toEqual({});
});
