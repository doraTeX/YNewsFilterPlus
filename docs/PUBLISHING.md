# 公開手順

RakuFillを管理しているChrome Web Storeの開発者アカウントで、新しいアイテムとして登録します。RakuFillのアイテムにZIPをアップロードしないでください。Publisherは同じでも拡張機能IDは別です。具体的なPublisher IDは未確認です。

1. `npm test`、`npm run package` を実行。
2. `release/ynews-filter-plus-0.1.0.zip` を新規アイテムへアップロード。
3. 名前「Y!News Filter Plus」、説明、128pxアイコン、実Chromeでのスクリーンショットを登録。
4. `PRIVACY_POLICY.md` を公開URLで提供し、Google同期・TypeSafeへの送信をストアのデータ利用申告にも反映。
5. 権限の理由を記載：storage＝設定とキャッシュ、alarms＝同期再試行、clipboardWrite＝判定詳細のTSVコピー、Yahooドメイン＝記事抽出・本文取得、TypeSafe＝ユーザーが有効にしたJev判定。
6. 最初はテスターを指定するPrivate公開で試験。同じストアアイテムを各端末へ導入して同期を確認。
7. テスト後に一般公開の審査へ進む。UnlistedはURLを知る人がインストールでき、自分だけへの限定ではありません。

TypeSafeキーはユーザーが各自入力します。開発者のキーやGistは含めません。公開・送信・審査申請はまだ行っていません。

更新時はpackage.jsonとsrc/manifest.tsのバージョンを揃えて上げ、同じアイテムへアップロードします。別アイテムとして登録すると設定領域・同期IDも変わります。
