# LINE Spreadsheet Notifier

Google スプレッドシートの編集を検知して、LINEグループへ通知する Bot の最小構成です。

## 構成
- `src/server.js`: LINE Messaging API 用の受信/通知サーバー
- `gas/Code.gs`: スプレッドシート側の onEdit トリガー
- `.env.example`: ローカル環境変数テンプレート
- `render.yaml`: Render デプロイ設定（Blueprint）

## 1. LINE Developers 設定
1. LINE Developers で Messaging API チャネルを作成
2. チャネルシークレット / チャネルアクセストークン（長期）を取得
3. Bot を通知したいグループに招待
4. Webhook URL は後で Render URL にして設定する（`https://<render-domain>/callback`）

## 2. Render でデプロイ（最短）
1. このリポジトリを GitHub に push
2. Render ダッシュボードで `New +` -> `Blueprint` を選び、対象リポジトリを接続
3. `render.yaml` を読み込んで Web Service を作成
4. Environment Variables を設定
   - `LINE_CHANNEL_ACCESS_TOKEN`
   - `LINE_CHANNEL_SECRET`
   - `NOTIFY_API_KEY`
   - `LINE_GROUP_ID`（任意。固定送信先を使う場合）
5. Deploy 完了後の URL を確認（例: `https://linebot-sheet-notifier.onrender.com`）

## 3. LINE Webhook URL を設定
- LINE Developers の Webhook URL を次に設定
  - `https://<render-domain>/callback`
- `Use webhook` を有効化
- 検証で成功することを確認

## 4. groupId の取得方法
- Bot をグループに追加し、何か1メッセージ送信
- Render の Logs に `[groupId captured] ...` が出る
- その値を Render の `LINE_GROUP_ID` に設定して再デプロイ

## 5. Apps Script 設定
1. 対象スプレッドシートを開く
2. 拡張機能 -> Apps Script
3. `gas/Code.gs` の内容を貼り付け
4. `WEBHOOK_URL` を `https://<render-domain>/notify` に変更
5. `NOTIFY_API_KEY` を Render の値と同じに設定
6. トリガー画面で `onEdit` のインストール型トリガーを作成

## 6. 動作確認
1. スプレッドシートの任意セルを編集
2. Render Logs で `/notify` 受信を確認
3. LINEグループに編集内容が通知される

## ローカル実行（任意）
```powershell
npm install
Copy-Item .env.example .env
# .env を編集
npm start
```

## 注意
- この実装は「セル編集」で発火します。構造変更（シート追加など）を拾う場合は別トリガーが必要です。
- Free プランはアイドル時にスリープし、最初の通知で遅延が出る場合があります。
- `.env` は Git 管理対象に含めないでください。
