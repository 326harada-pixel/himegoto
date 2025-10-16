himegoto build 007 (ver.1.21)
---------------------------------
このフォルダ内の4ファイルを GitHub の himegoto ディレクトリに上書きアップロードしてください。

- index.html             … 本番UI。ログインボタン連携済み
- app.js                 … 本文作成/共有/顧客管理（ローカル保存）
- style.css              … トップナビ縮小＆全体スタイル
- firebase-auth-modal.js … Firebase電話番号ログイン（既存アプリに未初期化なら window.FIREBASE_CONFIG を使用）

※ 既に別の場所で Firebase 初期化済みなら、そのアプリを再利用します。
※ 未初期化の場合は、index.html の <script> の前に以下の形式で設定を用意してください：
  <script>window.FIREBASE_CONFIG={ apiKey:'...', authDomain:'...', projectId:'...', appId:'...' };</script>
（この行はプロジェクト固有の値に置き換えてください）
