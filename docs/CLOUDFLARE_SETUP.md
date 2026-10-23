# Cloudflare Clef の設定方法

Y!News Filter PlusでCloudflareのAI判定を使うには、Cloudflareの「アカウントID」と、Workers AIにアクセスできる「APIトークン」を用意します。

## 1. Cloudflareでアカウントを用意する

[Cloudflareダッシュボード](https://dash.cloudflare.com/)にログインします。アカウントがなければ作成してください。複数のアカウントを持っている場合は、今回利用するアカウントを選びます。

## 2. Workers AIのAPI設定を開く

ダッシュボードで「Workers AI」を開き、「Use REST API」を選びます。画面の言語や更新により、項目名が多少異なる場合があります。

ここで次の2つを取得します。

| 拡張に入力するもの | Cloudflareの画面に表示される名称 |
| --- | --- |
| CloudflareアカウントID | Account ID |
| APIトークン | API Token |

アカウントIDは32桁の英数字です。

## 3. APIトークンを作成する

1. 「Create a Workers AI API Token」を選びます。
2. トークン名は、用途が分かるように `Y!News Filter Plus` などにします。
3. 権限に次の2つがあることを確認します。
   - アカウント → Workers AI → 読み取り（Read）
   - アカウント → Workers AI → 編集（Edit）
4. 「アカウントリソース」は「含む」にして、手順1で選んだアカウントを指定します。
5. 内容を確認して作成し、表示されたAPIトークンをコピーします。

トークンは拡張の設定欄に直接入力してください。

## 4. 拡張に入力する

1. Y!News Filter Plusの設定を開き、「AIによるハイライト/除外判定」の「AI判定を利用」をオンにします。
2. 「利用するAI」の接続先に **Cloudflare Clef / Clef-flash** を選びます。
3. APIトークン欄に手順3のトークンを入力します。
4. 「CloudflareアカウントID」に同じアカウントのAccount IDを入力します。
5. 「モデル」で `clef` または `clef-flash` を選びます。同じアカウントIDとトークンで切り替えられます。
6. 「この接続先への通信を許可」を押し、Chromeの確認画面で許可します。
7. 興味のある／ないキーワードを設定し、「直ちに再判定」を押します。

設定は自動保存されます。判定詳細の「利用AI」欄で、実際に使ったモデルを確認できます。

## うまく動かない場合

- **未設定の注意が表示される**：アカウントIDが32桁か、トークンが入力されているか確認してください。
- **HTTP 401／403**：トークンの有効性、Workers AIの読み取り・編集権限、対象アカウントが一致しているかを確認してください。
- **通信が許可されていない**：「この接続先への通信を許可」を押してください。
- **利用上限や請求に関するエラー**：Cloudflare側の使用量・契約・請求設定を確認してください。
- **エラー解消後も停止中**：設定画面の「再試行」または「直ちに再判定」で再開します。

## 料金と送信内容

AI判定を有効にすると、記事の見出しと判定条件をCloudflareへ送信します。本文追加判定を有効にした場合は本文冒頭も送信します。APIの利用料金・無料枠はCloudflareの契約と最新の料金表に従います。モデルや設定によって判定結果は異なり、誤判定する場合があります。

- [Cloudflare公式：REST APIの開始手順](https://developers.cloudflare.com/workers-ai/get-started/rest-api/)
- [Cloudflare公式：Workers AI料金](https://developers.cloudflare.com/workers-ai/platform/pricing/)
- [本拡張のプライバシーポリシー](PRIVACY_POLICY.md)

手順確認日：2026年10月23日
