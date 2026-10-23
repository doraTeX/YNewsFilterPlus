# Chrome Web Store 更新用素材（確認用）

## テキスト

- `summary-ja.txt`：パッケージ概要案。反映には `src/manifest.ts` のdescription更新と新パッケージの作成が必要です。
- `description-ja.txt`：掲載説明文案。現行の構成と原作・ライセンス表記を継承し、AI接続先・操作名・送信先を更新しています。
- `../docs/CLOUDFLARE_SETUP.md`：Cloudflareの設定ガイド。掲載文のGitHubリンクを使う前に、このガイドをリポジトリへ公開する必要があります。

## 画像

- `icon-128.png`：新しいストアアイコン。
- スクリーンショット：公開用の画像は `../docs/images/` の `screenshot-1.png`〜`screenshot-3.png`（1280×800、アルファなしPNG）です。READMEとストア掲載の両方でこれを使います。

公式画像仕様：https://developer.chrome.com/docs/webstore/images#screenshots

## 反映時の注意

現行の掲載スクリーンショット3枚と比較して採用順を決めます。現時点の素材はローカルでの確認用です。外部へのpush、管理画面への保存、審査提出、公開はユーザー確認後に行います。
