import {it,expect,vi} from 'vitest';
import {updateToolbarBadge} from '../src/background/badge';
import {defaults,validate} from '../src/shared/settings.js';
it('非表示件数を送信元のタブだけに表示',async()=>{
 const setBadgeText=vi.fn(),setBadgeBackgroundColor=vi.fn(),setBadgeTextColor=vi.fn();vi.stubGlobal('chrome',{action:{setBadgeText,setBadgeBackgroundColor,setBadgeTextColor,setTitle:vi.fn()}});
 await updateToolbarBadge(12,{tab:{id:7} as chrome.tabs.Tab,frameId:0,url:'https://news.yahoo.co.jp/'});
 expect(setBadgeText).toHaveBeenCalledWith({tabId:7,text:'12'});
 await updateToolbarBadge(0,{tab:{id:8} as chrome.tabs.Tab,frameId:0,url:'https://news.yahoo.co.jp/'});
 expect(setBadgeText).toHaveBeenLastCalledWith({tabId:8,text:'0'});
 await updateToolbarBadge(3,{frameId:0,url:'chrome-extension://example/'});expect(setBadgeText).toHaveBeenCalledTimes(2);
});
it('旧設定はチップ表示を維持し、OFFも保存できる',()=>{
 const {showPageChip:_,...old}=defaults;expect(validate(old).showPageChip).toBe(true);expect(validate({...defaults,showPageChip:false}).showPageChip).toBe(false);
});

it('エラーを×で表示し復旧後は件数に戻す',async()=>{
 const setBadgeText=vi.fn(),setTitle=vi.fn();vi.stubGlobal('chrome',{action:{setBadgeText,setTitle,setBadgeBackgroundColor:vi.fn(),setBadgeTextColor:vi.fn()}});
 const sender={tab:{id:7} as chrome.tabs.Tab,frameId:0,url:'https://news.yahoo.co.jp/'};
 await updateToolbarBadge(12,sender,'HTTP 401: 認証エラー');
 expect(setBadgeText).toHaveBeenLastCalledWith({tabId:7,text:'×'});
 expect(setTitle).toHaveBeenLastCalledWith({tabId:7,title:'Jevエラー：HTTP 401: 認証エラー'});
 await updateToolbarBadge(12,sender);
 expect(setBadgeText).toHaveBeenLastCalledWith({tabId:7,text:'12'});
});
