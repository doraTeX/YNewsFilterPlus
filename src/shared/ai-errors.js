import {PROVIDERS} from './ai.js';

// Only locally authored descriptions are shown: provider payloads may echo user data or credentials.
export function aiError(provider,kind,{status=0,code='',phase='判定'}={}){
 const name=PROVIDERS[provider]||'AI';
 let message='',advice='',stop=false,focusKey=false;
 if(kind==='http'){
  message=`HTTP ${status}: ${name}の${phase}に失敗しました。`;
  if(provider==='clef'&&code==='3036'){
   stop=true;advice='Cloudflare Workers AIの無料枠を使い切りました。無料枠の回復を待つか、Cloudflareの契約・請求設定を確認してから再試行してください。';
  }else if(provider==='clef'&&['5007','3003'].includes(code)){
   stop=true;advice='Cloudflareのモデル指定またはリクエスト設定が無効です。接続設定を確認してください。';
  }else if([401,403].includes(status)){
   stop=true;focusKey=true;
   advice=provider==='clef'?'CloudflareのアカウントIDとAPIトークンを確認してください。トークンには対象アカウントのWorkers AIへのアクセス権限が必要です。':`${name}のAPIキーが有効か、対象APIを利用する権限があるか確認し、有効なキーを入力し直してください。`;
  }else if(status===402||(status===429&&['insufficient_quota','credit_balance_exhausted','organization_spend_limit_exceeded','project_spend_limit_exceeded','organization_usage_limit_exceeded'].includes(code))){
   stop=true;advice=`${name}の残高・請求設定・利用上限を確認し、解消後に「再試行」を押してください。`;
  }else if(status===404){
   stop=true;advice=provider==='clef'?'CloudflareのアカウントIDと選択したClefモデルが利用可能か確認してください。':`${name}で指定モデルとAPIが利用可能か確認してください。`;
  }else if([400,413,422].includes(status)){
   stop=true;advice='送信内容が受理されませんでした。判定条件の件数や長さを減らし、本文追加判定をOFFにして再試行してください。改善しない場合は接続先の対応仕様を確認してください。';
  }else if(status===429){advice='利用制限に達しました。指定された待機時間を守って自動再試行します。繰り返す場合は同時問い合わせ数を減らしてください。';
  }else if(status>=500||[408,425].includes(status)){
   advice=`${name}側の一時的な障害の可能性があります。しばらく待って自動再試行します。`;
  }else{stop=true;advice='接続先の設定・API仕様を確認してから再試行してください。';}
 }else if(kind==='storage'){
  stop=true;message='AI接続設定を読み込めませんでした。';advice='ブラウザのストレージの状態を確認し、ページを再読み込みしてください。';
 }else if(kind==='credentials'){
  stop=true;focusKey=true;message=`${name}のAPIキーが未登録です。`;advice='設定画面で、この接続先のAPIキーを登録してください。';
 }else if(kind==='permission'){
  stop=true;message=`${name}への通信が許可されていません。`;advice='設定画面の「この接続先への通信を許可」でブラウザの接続許可を与えてください。';
 }else if(kind==='timeout'||kind==='network'){
  message=`${name}の${phase}${kind==='timeout'?'が時間切れになりました。':'に接続できませんでした。'}`;
  advice=`${name}へのネットワーク接続とブラウザの接続許可を確認してください。一時的な失敗なら待機後に再試行します。`;
 }else if(kind==='refusal'){
  message=`${name}からこの記事の判定への回答がありませんでした。`;advice='この記事の処理をスキップし、ほかの記事の判定を続けます。';
 }else if(kind==='provider'){
  stop=true;message=`${name}が${phase}の失敗を返しました。`;advice='HTTP通信は成功しましたが、API内の処理は失敗しました。接続先の設定・利用状況を確認して再試行してください。';
 }else if(kind==='changed'){
  message='通信開始前に接続設定が変更されました。';advice='現在の接続設定で再判定します。';
 }else if(kind==='size'){
  stop=true;message=`${name}の応答が大きすぎます。`;advice='接続URLが正しいか、API以外のページを返していないか確認してください。';
 }else{
  stop=true;kind='format';message=`${name}の${phase}の応答形式が不正です。`;advice='接続先が対応するAPI形式のJSONを返しているか確認してください。不正な応答は判定結果に使用しません。';
 }
 const scope=provider==='clef'&&['3036','5007','3003'].includes(code)?'global':['refusal','format','size','timeout'].includes(kind)||(kind==='http'&&[400,408,413,422].includes(status))?'article':'global';
 if(scope==='article')stop=false;
 return Object.assign(Error(message),{provider,kind,status,stop,advice,focusKey,scope});
}
export function httpError(provider,status,responseText,phase='判定'){
 let code='';try{const data=JSON.parse(responseText);const value=data?.error?.code??data?.errors?.[0]?.code??data?.code;if(typeof value==='string'||typeof value==='number')code=String(value);}catch{}
 return aiError(provider,'http',{status,code,phase});
}
export function failureState(old,error,now=Date.now()){
 // Concurrent requests must not undo a terminal failure or replace its actionable cause.
 if(error.scope==='article'||error.kind==='refusal'||old.stopped)return old;
 const failures=(old.failures||0)+1,seconds=Number(error.retry);
 const retry=error.retry&&Number.isFinite(seconds)?Math.max(0,seconds*1000):Math.max(0,Date.parse(error.retry||'')-now)||0;
 return {...old,failures,stopped:!!error.stop||failures>=5,blockedUntil:now+Math.max(60000*Math.min(30,2**failures),retry),lastError:error.message,lastErrorAt:new Date(now).toISOString(),errorKind:error.kind||'',errorProvider:error.provider||old.provider||'jev',errorAdvice:error.advice||'',errorFocusKey:!!error.focusKey};
}
