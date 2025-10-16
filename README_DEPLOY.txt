
himegoto build010（ログイン修正）

同梱ファイル（上書き推奨）:
- index.html        : config.js を最優先で読む順序に変更（?v=010でキャッシュ無効化）
- firebase-auth-modal.js : FIREBASE_CONFIG を待ってから初期化
- config.js         : Firebase 設定（あなたのプロジェクト値）
- service-worker.js : キャッシュ名を v010 に更新して古い SW を無効化

デプロイ手順:
1) この4ファイルを GitHub の himegoto 直下にアップロード（上書き）
2) デプロイ完了後、ブラウザで以下を実施
   - ページを開く → アドレスバーで「再読み込み長押し → ハード再読み込み」
   - それでも古い表示の場合は、サイト設定→ストレージを消去/サービスワーカーを解除
3) 画面右上 ver が 1.22 以降で、ログインを押したときのダイアログが変われば OK

トラブル時の確認:
- https://himegoto.vercel.app/config.js にアクセスして中身が見えるか（404なら配置場所が違う）
- Developer Tools の Console で window.FIREBASE_CONFIG と打ち、オブジェクトが返るか
- Firebase Console > Authentication > 承認済みドメイン に himegoto.vercel.app があるか
