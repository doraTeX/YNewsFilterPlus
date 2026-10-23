import {it,expect} from 'vitest';
import {aiError,httpError,failureState} from '../src/shared/ai-errors.js';
import {connection,readDecision} from '../src/shared/ai.js';

it.each(['jev','clef','openai'])('%sは認証・設定不備で停止し、一時障害では再試行する',provider=>{
 for(const status of [400,401,402,403,404,413,422])expect(httpError(provider,status,'').stop).toBe(true);
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
 const now=Date.now(),e=Object.assign(aiError('jev','timeout'),{retry:'600'});
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
 try{readDecision(c,{answers:[{name:'q0',type:'refusal'}]},[0]);expect.unreachable();}catch(e:any){expect(e.kind).toBe('refusal');expect(e.stop).toBe(true);}
 const cf=connection({provider:'clef',profiles:{clef:{accountId:'a'.repeat(32)}}});
 try{readDecision(cf,{success:false},[0]);expect.unreachable();}catch(e:any){expect(e.kind).toBe('provider');}
});
it('並行通信の遅れた失敗が認証エラーの停止を解除しない',()=>{
 const terminal=failureState({},httpError('clef',403,''));
 const late=failureState(terminal,aiError('clef','timeout'));
 expect(late.stopped).toBe(true);expect(late.lastError).toContain('HTTP 403');expect(late.errorFocusKey).toBe(true);
});
