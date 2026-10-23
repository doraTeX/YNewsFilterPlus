import {it,expect,vi,afterEach} from 'vitest';
afterEach(()=>{vi.unstubAllGlobals();document.getElementById('ynfp-reload-notice')?.remove();});
it('更新で接続が無効になったら再送せず案内を一度だけ表示する',async()=>{
 vi.resetModules();
 const sendMessage=vi.fn().mockRejectedValue(new Error('Extension context invalidated.'));
 vi.stubGlobal('chrome',{runtime:{id:'test',sendMessage,onMessage:{addListener:vi.fn()}},storage:{onChanged:{addListener:vi.fn()}}});
 const {bridge}=await import('../src/shared/bridge');
 await expect(bridge.sync()).rejects.toThrow('このページを再読み込み');
 await expect(bridge.sync()).rejects.toThrow('このページを再読み込み');
 expect(bridge.isConnected()).toBe(false);
 expect(sendMessage).toHaveBeenCalledTimes(1);
 expect(document.querySelectorAll('#ynfp-reload-notice')).toHaveLength(1);
});
it('通信エラーの接続先・停止方針・案内をコールバックまで引き継ぐ',async()=>{
 vi.resetModules();
 vi.stubGlobal('chrome',{runtime:{id:'test',sendMessage:vi.fn().mockResolvedValue({ok:false,error:'Ollayaの失敗',details:{provider:'ollaya',kind:'permission',stop:true,advice:'モデル一覧を取得'}}),onMessage:{addListener:vi.fn()}},storage:{onChanged:{addListener:vi.fn()}}});
 const {GM}=await import('../src/shared/bridge');const onerror=vi.fn();
 GM.xmlHttpRequest({method:'POST',url:'http://localhost:11435/v1/systemone',onerror});
 for(let i=0;i<10;i++)await Promise.resolve();
 expect(onerror).toHaveBeenCalledWith(expect.objectContaining({provider:'ollaya',kind:'permission',stop:true,advice:'モデル一覧を取得'}));
});
