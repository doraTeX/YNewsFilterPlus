import {it,expect} from 'vitest';
import {migrateRetiredAI,connection,connectionReady,connectionIdentity,requestBody,readDecision} from '../src/shared/ai.js';
const questions={q2:{type:'noul',instructions:'関連していますか？',criteria:{true:'主題である',false:'言及のみ'}}};
it('旧Jev設定を引き継ぎ、他の接続先にそのキーを送らない',()=>{
 expect(connection({key:'legacy'})).toMatchObject({provider:'jev',key:'legacy',model:'jev-1.13.0',url:'https://api.typesafe.ai/v1/systemone'});
 expect(connection({key:'legacy',provider:'openai'}).key).toBe('');
 expect(connectionReady({provider:'openai',key:'legacy'})).toBe(false);
});
it('接続先とモデル別にキャッシュを分離し、キーは識別子に含めない',()=>{
 const a={provider:'openai',profiles:{openai:{key:'secret',model:'gpt-6-luna'}}};
 expect(connectionIdentity(a)).not.toContain('secret');
 expect(connectionIdentity(a)).not.toBe(connectionIdentity({provider:'jev'}));
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

it.each(['nano','ollaya'])('廃止した%s設定から別APIへ勝手に送らない',provider=>{
 const local={provider,key:'legacy',profiles:{[provider]:{ready:true},jev:{key:'saved-jev'},openai:{key:'saved-openai'}}};
 const migrated=migrateRetiredAI(local);
 expect(migrated.provider).toBe('jev');expect(migrated.stopped).toBe(true);
 expect(migrated.profiles[provider]).toBeUndefined();expect(migrated.profiles.jev.key).toBe('saved-jev');
 expect(migrated.profiles.openai.key).toBe('saved-openai');expect(connection(migrated).provider).toBe('jev');
 expect(migrateRetiredAI(migrated)).toBe(migrated);
 const active=migrateRetiredAI({...local,provider:'openai'});expect(active.provider).toBe('openai');expect(active.stopped).toBeUndefined();
});

it('旧版で回答拒否により全体停止した設定を再開できる状態に移行する',()=>{
 const local={provider:'openai',profiles:{openai:{key:'saved'}},stopped:true,failures:1,blockedUntil:123,errorKind:'refusal',lastError:'回答拒否'};
 expect(migrateRetiredAI(local)).toMatchObject({provider:'openai',profiles:{openai:{key:'saved'}},stopped:false,failures:0,blockedUntil:0,errorKind:'',lastError:''});
});
