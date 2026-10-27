import {it,expect,vi,afterEach} from 'vitest';
afterEach(()=>{vi.clearAllTimers();vi.useRealTimers();vi.unstubAllGlobals();document.getElementById('ynfp-reload-notice')?.remove();});
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
 vi.stubGlobal('chrome',{runtime:{id:'test',sendMessage:vi.fn().mockResolvedValue({ok:false,error:'OpenAIの失敗',details:{provider:'openai',kind:'permission',stop:true,advice:'この接続先への通信を許可'}}),onMessage:{addListener:vi.fn()}},storage:{onChanged:{addListener:vi.fn()}}});
 const {GM}=await import('../src/shared/bridge');const onerror=vi.fn();
 GM.xmlHttpRequest({method:'POST',url:'https://api.openai.com/v1/decisions',onerror});
 for(let i=0;i<10;i++)await Promise.resolve();
 expect(onerror).toHaveBeenCalledWith(expect.objectContaining({provider:'openai',kind:'permission',stop:true,advice:'この接続先への通信を許可'}));
});


it.each(['no-storage','no-event','subscription-error'])('変更通知が使えない%sでも初期化を続け、定期確認へ切り替える',async mode=>{
 vi.useFakeTimers();vi.resetModules();
 const storage=mode==='no-storage'?undefined:mode==='no-event'?{}:{onChanged:{addListener(){throw Error('API unavailable');}}};
 vi.stubGlobal('chrome',{runtime:{id:'test',onMessage:{addListener:vi.fn()}},storage});const {bridge}=await import('../src/shared/bridge');const changed=vi.fn(),stop=bridge.onSettingsChanged(changed);
 await vi.advanceTimersByTimeAsync(3000);expect(changed).toHaveBeenCalledTimes(2);expect(bridge.isConnected()).toBe(true);
 stop();await vi.advanceTimersByTimeAsync(3000);expect(changed).toHaveBeenCalledTimes(2);
});
it('通常は関連する設定変更だけ通知し、追加の定期確認を行わない',async()=>{
 vi.useFakeTimers();vi.resetModules();const addListener=vi.fn(),removeListener=vi.fn();
 vi.stubGlobal('chrome',{runtime:{id:'test',onMessage:{addListener:vi.fn()}},storage:{onChanged:{addListener,removeListener}}});const {bridge}=await import('../src/shared/bridge'),changed=vi.fn(),stop=bridge.onSettingsChanged(changed),listener=addListener.mock.calls[0][0];
 listener({unrelated:{}},'local');listener({yne_plus_settings_v2:{}},'sync');expect(changed).not.toHaveBeenCalled();
 listener({yne_plus_settings_v2:{}},'local');listener({yne_plus_jev_local_v1:{}},'local');expect(changed).toHaveBeenCalledTimes(2);
 await vi.advanceTimersByTimeAsync(3000);expect(changed).toHaveBeenCalledTimes(2);
 vi.stubGlobal('chrome',{runtime:{id:'test'}});stop();expect(removeListener).toHaveBeenCalledWith(listener);
});
it('定期確認中に拡張が無効化されたら取得を止め、再読み込みを案内する',async()=>{
 vi.useFakeTimers();vi.resetModules();const runtime:{id?:string,onMessage:any}={id:'test',onMessage:{addListener:vi.fn()}};vi.stubGlobal('chrome',{runtime});
 const {bridge}=await import('../src/shared/bridge'),changed=vi.fn();bridge.onSettingsChanged(changed);await vi.advanceTimersByTimeAsync(1500);expect(changed).toHaveBeenCalledTimes(1);
 delete runtime.id;await vi.advanceTimersByTimeAsync(4500);expect(changed).toHaveBeenCalledTimes(1);expect(bridge.isConnected()).toBe(false);expect(document.querySelectorAll('#ynfp-reload-notice')).toHaveLength(1);
});
it('変更通知の登録時に拡張が無効なら例外を出さず、保存や取得を再試行しない',async()=>{
 vi.useFakeTimers();vi.resetModules();vi.stubGlobal('chrome',{runtime:{id:'test',onMessage:{addListener:vi.fn()}},get storage(){throw Error('Extension context invalidated.');}});
 const {bridge}=await import('../src/shared/bridge'),changed=vi.fn();expect(()=>bridge.onSettingsChanged(changed)).not.toThrow();await vi.advanceTimersByTimeAsync(3000);expect(changed).not.toHaveBeenCalled();expect(bridge.isConnected()).toBe(false);
});
it('無効化後の変更通知の解除で例外が出ても終了できる',async()=>{
 vi.resetModules();vi.stubGlobal('chrome',{runtime:{id:'test',onMessage:{addListener:vi.fn()}},storage:{onChanged:{addListener:vi.fn(),removeListener(){throw Error('Extension context invalidated.');}}}});
 const {bridge}=await import('../src/shared/bridge'),stop=bridge.onSettingsChanged(vi.fn());expect(stop).not.toThrow();
});
