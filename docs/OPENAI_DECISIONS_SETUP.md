# OpenAI Decisions の設定方法

Y!News Filter PlusでOpenAI DecisionsのAI判定を使うには、OpenAI APIキーと、APIを利用できる請求設定を用意します。

## 1. OpenAI Platformにログインする

[OpenAI Platform](https://platform.openai.com/)にログインします。アカウントがなければ作成してください。利用する組織とプロジェクトを選びます。

## 2. 請求設定を確認する

「Settings」→「Billing」で請求設定とクレジット残高を確認します。前払いで利用する場合は「Add credits」からチャージしてください。

APIの利用料金はOpenAIとの契約に従います。利用状況は「Usage」で確認できます。

## 3. APIキーを取得する

1. [API keys](https://platform.openai.com/api-keys)を開きます。
2. 「Create new secret key」を選びます。
3. 名前を `Y!News Filter Plus` などにして、利用するプロジェクトを指定します。
4. Permissionsは「All」を選んでキーを作成します。
5. 表示された `sk-` から始まるキー全文をコピーして保存します。

既存のキーを使用する場合は、チャージした組織のプロジェクトに属し、Statusが「Active」で、Decisions APIの実行権限があることを確認してください。

## 4. 拡張に入力する

1. Y!News Filter Plusの設定を開き、「AIによるハイライト/除外判定」の「AI判定を利用」をオンにします。
2. 「利用するAI」の接続先に **OpenAI Decisions** を選びます。
3. 「OpenAI APIキー」欄にキー全文を入力します。
4. 「この接続先への通信を許可」を押し、Chromeの確認画面で許可します。
5. 「興味のあるキーワード」「興味のないキーワード」を1行に1つずつ入力します。
6. 「直ちに再判定」を押します。

設定は自動保存されます。判定詳細の「利用AI」欄で、OpenAI Decisionsによる判定を確認できます。

## うまく動かない場合

- **未設定の注意が表示される**：OpenAI APIキー欄にキーを入力してください。
- **HTTP 401／403**：キーの有効性、所属プロジェクト、APIの実行権限を確認してください。
- **残高不足・利用上限のエラー**：「Billing」のクレジット残高と請求設定、「Usage」の利用状況を確認してください。チャージ直後は反映を待ってから再試行してください。
- **通信が許可されていない**：「この接続先への通信を許可」を押してください。
- **原因を解消しても停止中**：「再試行」または「直ちに再判定」を押してください。

## 送信内容と保存

記事の見出しと判定条件をOpenAIへ送信します。本文追加判定を有効にした場合は本文冒頭も送信します。APIキーは端末内に保存されます。

- [OpenAI公式：APIの開始手順](https://developers.openai.com/api/docs/quickstart)
- [OpenAI公式：Decisions](https://developers.openai.com/api/docs/guides/decisions)
- [本拡張のプライバシーポリシー](PRIVACY_POLICY.md)

手順確認日：2026年10月23日
