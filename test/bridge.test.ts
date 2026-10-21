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
