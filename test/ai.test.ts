import {it,expect} from 'vitest';
import {connection,connectionReady,connectionIdentity,connectionOrigin,requestBody,readDecision,readModels,ollayaBase} from '../src/shared/ai.js';
const questions={q2:{type:'noul',instructions:'関連していますか？',criteria:{true:'主題である',false:'言及のみ'}}};
it('旧Jev設定を引き継ぎ、他の接続先にそのキーを送らない',()=>{
 expect(connection({key:'legacy'})).toMatchObject({provider:'jev',key:'legacy',model:'jev-1.13.0',url:'https://api.typesafe.ai/v1/systemone'});
 expect(connection({key:'legacy',provider:'openai'}).key).toBe('');
 expect(connectionReady({provider:'openai',key:'legacy'})).toBe(false);
});
it('Ollayaは別ポートでもキーなしで使え、パスや認証情報付きURLを拒否する',()=>{
 const c=connection({provider:'ollaya',key:'secret',profiles:{ollaya:{baseUrl:'http://localhost:23456/',model:'laya'}}});
 expect(c.url).toBe('http://localhost:23456/v1/systemone');expect(c.key).toBe('');
 expect(connectionReady({provider:'ollaya',profiles:{ollaya:{model:'laya'}}})).toBe(true);
 for(const url of ['file:///tmp/x','http://user:pass@localhost:11435','http://localhost:11435/api','https://example.com/?key=x'])expect(()=>ollayaBase(url)).toThrow();
 expect(connectionOrigin('ollaya','http://localhost:23456')).toBe('http://localhost/*');
});
it('接続先とモデル別にキャッシュを分離し、キーは識別子に含めない',()=>{
 const a={provider:'ollaya',profiles:{ollaya:{model:'laya',baseUrl:'http://localhost:11435',key:'secret'}}};
 expect(connectionIdentity(a)).not.toContain('secret');
 expect(connectionIdentity(a)).not.toBe(connectionIdentity({...a,profiles:{ollaya:{...a.profiles.ollaya,baseUrl:'http://localhost:11436'}}}));
 expect(connectionIdentity(a)).not.toBe(connectionIdentity({...a,profiles:{ollaya:{...a.profiles.ollaya,model:'other'}}}));
 expect(connectionIdentity({provider:'clef',profiles:{clef:{key:'secret'}}})).not.toContain('secret');
});
it('OpenAIの名前付きpredicateに変換し、回答順が変わっても正しく取り出す',()=>{
 const c=connection({provider:'openai',profiles:{openai:{key:'openai'}}});
 expect(requestBody(c,'記事本文',questions)).toEqual({model:'gpt-6-luna',input:'記事本文',questions:[{name:'q2',type:'predicate',instructions:'関連していますか？\n真の場合：主題である\n偽の場合：言及のみ'}]});
 expect(readDecision(c,{answers:[{name:'q1',type:'predicate',probability:.1},{name:'q2',type:'predicate',probability:.9}]},[2]).scores).toEqual([.9]);
 for(const answers of [[{name:'q2',type:'refusal'}],[],[{name:'q2',type:'predicate',probability:2}]])expect(()=>readDecision(c,{answers},[2])).toThrow();
});
it('ClefのURLと本文のモデル名を一致させ、Cloudflareの失敗応答は判定にしない',()=>{
 const c=connection({provider:'clef',profiles:{clef:{accountId:'a'.repeat(32),model:'clef-flash',key:'cf-token'}}});
 expect(c.url).toBe('https://api.cloudflare.com/client/v4/accounts/'+ 'a'.repeat(32)+'/ai/run/@cf/cloudflare/clef-flash');
 expect(requestBody(c,'記事',questions)).toMatchObject({model:'clef-flash',state:{news_text:'記事'},questions});
 expect(readDecision(c,{success:true,result:{answers:{q2:{noul:.8}},usage:{input_tokens:5}}},[2])).toEqual({scores:[.8],usage:{input_tokens:5}});
 expect(()=>readDecision(c,{success:false,result:{answers:{q2:{noul:.8}}}},[2])).toThrow();
});
it('Ollayaのローカルモデル一覧と空の一覧を処理する',()=>{
 expect(readModels({models:[{name:'laya'},{name:'winnow:e4b'}]})).toEqual(['laya','winnow:e4b']);
 expect(readModels({models:[]})).toEqual([]);expect(()=>readModels({data:[]})).toThrow();
});
