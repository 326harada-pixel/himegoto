
himegoto build009 - FULL CONFIG
================================

この設定はあなたの Firebase プロジェクト専用です。
`config.js` はアプリ直下（index.htmlと同階層）に配置してください。

手順
----
1) この `config.js` を `himegoto/` 直下にアップロード。
2) デプロイ後ブラウザをリロード。
3) ログインボタンで電話番号認証画面が正常に出ればOK。

注意
----
- Firebase Authentication > 設定 > 承認済みドメイン に以下を含めてください：
  - himegoto.vercel.app
  - localhost（テスト用）
- Phone認証のテスト番号を利用する場合、`+81`形式にしてください。
- 実際のSMS送信はSparkプラン上限あり。

Version: build009 • ver.1.22
