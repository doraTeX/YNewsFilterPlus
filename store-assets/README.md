# Chrome Web Store 更新用素材（確認用）

## テキスト

- `summary-ja.txt`：パッケージ概要案。反映には `src/manifest.ts` のdescription更新と新パッケージの作成が必要です。
- `description-ja.txt`：掲載説明文案。現行の構成と原作・ライセンス表記を継承し、AI接続先・操作名・送信先を更新しています。
- `../docs/CLOUDFLARE_SETUP.md`：Cloudflareの設定ガイド。掲載文のGitHubリンクを使う前に、このガイドをリポジトリへ公開する必要があります。

## 画像

- `icon-128.png`：新しいストアアイコン。
- `screenshots/01-highlight.jpg`：記事ハイライトと非表示条件の一時解除メニュー。
- `screenshots/02-ai-settings.jpg`：AIの興味キーワード、しきい値、本文追加判定の設定。

スクリーンショットは実際の拡張画面を撮影した1280×800のJPEGです。ニュース内容は撮影時点のものです。新しいAI接続先を示す画面と判定詳細の画面は、追加撮影候補です。

公式画像仕様：https://developer.chrome.com/docs/webstore/images#screenshots

## 反映時の注意

現行の掲載スクリーンショット3枚と比較して採用順を決めます。現時点の素材はローカルでの確認用です。外部へのpush、管理画面への保存、審査提出、公開はユーザー確認後に行います。
