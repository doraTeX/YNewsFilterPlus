import {it,expect} from 'vitest';
import {aiError,httpError,failureState} from '../src/shared/ai-errors.js';
import {connection,readDecision} from '../src/shared/ai.js';

it.each(['jev','clef','openai'])('%sは認証・設定不備で停止し、一時障害では再試行する',provider=>{
 for(const status of [401,402,403,404])expect(httpError(provider,status,'').stop).toBe(true);
 for(const status of [408,429,500,502,503,504])expect(httpError(provider,status,'').stop).toBe(false);
 expect(aiError(provider,'timeout').stop).toBe(false);
 expect(aiError(provider,'permission').stop).toBe(true);
});
it('Clefはアカウントと権限、OpenAIのquota超過は請求設定へ案内する',()=>{
 expect(httpError('clef',403,'').advice).toContain('アカウントID');expect(httpError('clef',403,'').advice).toContain('Workers AI');
 const quota=httpError('openai',429,JSON.stringify({error:{code:'insufficient_quota',message:'secret-value'}}));
 expect(quota.stop).toBe(true);expect(quota.advice).toContain('請求');expect(JSON.stringify(quota)).not.toContain('secret-value');
 expect(httpError('openai',429,'{}').stop).toBe(false);
});
it('Retry-Afterを秒数と日時の両方で守り、一時障害が続いた場合は停止する',()=>{
 const now=Date.now(),e=Object.assign(aiError('jev','network'),{retry:'600'});
 expect(failureState({},e,now)).toMatchObject({stopped:false,blockedUntil:now+600000,failures:1});
 e.retry=new Date(now+3600000).toUTCString();expect(failureState({},e,now).blockedUntil).toBe(Date.parse(e.retry));
 expect(failureState({failures:4},e,now).stopped).toBe(true);
 expect(failureState({},aiError('jev','permission'),now).stopped).toBe(true);
});
it('JSON null・欠落・範囲外を判定値として受け入れず、拒否を形式不正と区別する',()=>{
 const c=connection({provider:'openai'});
 for(const raw of [null,[],{}, {answers:[null]}, {answers:[{name:'q0',type:'predicate',probability:'0.8'}]}]){
  try{readDecision(c,raw,[0]);expect.unreachable();}catch(e:any){expect(e.kind).toBe('format');}
 }
 try{readDecision(c,{answers:[{name:'q0',type:'refusal'}]},[0]);expect.unreachable();}catch(e:any){expect(e.kind).toBe('refusal');expect(e.stop).toBe(false);}
 const cf=connection({provider:'clef',profiles:{clef:{accountId:'a'.repeat(32)}}});
 try{readDecision(cf,{success:false},[0]);expect.unreachable();}catch(e:any){expect(e.kind).toBe('provider');}
});
it('並行通信の遅れた失敗が認証エラーの停止を解除しない',()=>{
 const terminal=failureState({},httpError('clef',403,''));
 const late=failureState(terminal,aiError('clef','timeout'));
 expect(late.stopped).toBe(true);expect(late.lastError).toContain('HTTP 403');expect(late.errorFocusKey).toBe(true);
});

it('回答拒否を繰り返しても全体の停止・待機・連続通信失敗回数に加算しない',()=>{
 const old={failures:4,blockedUntil:0};
 expect(failureState(old,aiError('openai','refusal'))).toBe(old);
});

it.each(['jev','clef'])('%sでも明示的なrefusalは通常のスキップとして扱い、不正な値と混同しない',provider=>{
 const c=connection({provider,profiles:{clef:{accountId:'a'.repeat(32)}}});
 const wrap=(answers:any)=>provider==='clef'?{success:true,result:{answers}}:{answers};
 try{readDecision(c,wrap({q0:{type:'refusal',noul:.99}}),[0]);expect.unreachable();}catch(e:any){
  expect(e.kind).toBe('refusal');expect(e.stop).toBe(false);expect(e.focusKey).toBe(false);
  expect(failureState({failures:4},e)).toEqual({failures:4});
 }
 for(const answers of [{q0:{noul:null}},{q0:{noul:1.5}},{}]){
  try{readDecision(c,wrap(answers),[0]);expect.unreachable();}catch(e:any){expect(e.kind).toBe('format');expect(e.stop).toBe(false);}
 }
});

it.each(['jev','clef','openai'])('%sの全エラーを記事単位と全体に分離する',provider=>{
 const old={failures:4,blockedUntil:0};
 for(const e of [aiError(provider,'refusal'),aiError(provider,'format'),aiError(provider,'size'),aiError(provider,'timeout'),...[400,408,413,422].map(s=>httpError(provider,s,'{}'))]){
  expect(e.scope).toBe('article');expect(e.stop).toBe(false);expect(failureState(old,e)).toBe(old);
 }
 for(const code of ['insufficient_quota','credit_balance_exhausted','organization_spend_limit_exceeded','project_spend_limit_exceeded','organization_usage_limit_exceeded']){
  const e=httpError(provider,429,JSON.stringify({error:{code}}));expect(e.scope).toBe('global');expect(e.stop).toBe(true);expect(failureState({},e).stopped).toBe(true);
 }
 for(const status of [401,402,403,404])expect(failureState({},httpError(provider,status,'{}')).stopped).toBe(true);
 for(const status of [429,500,503]){const state=failureState({},httpError(provider,status,'{}'));expect(state.stopped).toBe(false);expect(state.blockedUntil).toBeGreaterThan(Date.now());}
});

it('Cloudflareの無料枠超過・モデル設定不備と、一時的な混雑・記事サイズ超過を区別する',()=>{
 const cf=(status:number,code:number)=>httpError('clef',status,JSON.stringify({errors:[{code,message:'not exposed'}]}));
 expect(cf(429,3036)).toMatchObject({scope:'global',stop:true});expect(cf(429,3036).advice).toContain('無料枠');
 expect(cf(400,5007)).toMatchObject({scope:'global',stop:true});
 expect(cf(400,3003)).toMatchObject({scope:'global',stop:true});
 expect(cf(429,3040)).toMatchObject({scope:'global',stop:false});
 expect(cf(413,3006)).toMatchObject({scope:'article',stop:false});
});
