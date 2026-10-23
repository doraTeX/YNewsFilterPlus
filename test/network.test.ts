import {afterEach,it,expect,vi} from 'vitest';
import {network} from '../src/background/network';
import {connection,connectionIdentity} from '../src/shared/ai.js';
afterEach(()=>vi.unstubAllGlobals());
function setup(local:any,permitted=true){
 const fetch=vi.fn().mockResolvedValue({status:200,text:async()=>'{}',headers:new Headers(),url:'test'});
 vi.stubGlobal('fetch',fetch);vi.stubGlobal('chrome',{storage:{local:{get:async()=>({yne_plus_jev_local_v1:local})}},permissions:{contains:async()=>permitted}});
 const c=connection(local);
 return {fetch,request:{method:'POST',url:c.url,connection:connectionIdentity(local),data:JSON.stringify({model:c.model})}};
}
it('バックグラウンドは保存した接続先のキーだけを付ける',async()=>{
 const {fetch,request}=setup({key:'jev-secret',provider:'openai',profiles:{openai:{key:'openai-secret'}}});
 await network({request});expect(fetch).toHaveBeenCalledWith('https://api.openai.com/v1/decisions',expect.objectContaining({headers:{Authorization:'Bearer openai-secret','Content-Type':'application/json'},redirect:'error',credentials:'omit'}));
});
it('別ポート、別ホスト、設定変更前の要求を送らない',async()=>{
 const {fetch,request}=setup({provider:'openai',profiles:{openai:{key:'test'}}});
 for(const url of ['http://localhost:11436/v1/systemone','http://evil.test/v1/systemone'])await expect(network({request:{...request,url}})).rejects.toThrow();
 await expect(network({request:{...request,connection:'old'}})).rejects.toThrow();expect(fetch).not.toHaveBeenCalled();
});
it('任意ホストへの許可がなくても記事本文取得はでき、AI通信は拒否する',async()=>{
 const {fetch,request}=setup({provider:'openai',profiles:{openai:{key:'test'}}},false);
 await expect(network({request})).rejects.toThrow('許可されていません');expect(fetch).not.toHaveBeenCalled();
 await network({request:{url:'https://news.yahoo.co.jp/articles/test',method:'GET'}});expect(fetch).toHaveBeenCalledTimes(1);expect(fetch.mock.calls[0][1].headers).toBeUndefined();
});

it('通信のAbortと巨大な応答を区別する',async()=>{
 const {fetchResult}=await import('../src/background/network');
 const {fetch}=setup({});
 fetch.mockImplementationOnce((_url,options)=>new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError')))));
 await expect(fetchResult('https://api.openai.com',{},1,'openai')).rejects.toMatchObject({kind:'timeout'});
 fetch.mockResolvedValueOnce({status:200,text:async()=>'x'.repeat(6000001)});
 await expect(fetchResult('https://api.openai.com',{},100,'openai')).rejects.toMatchObject({kind:'size',stop:false,scope:'article'});
});
