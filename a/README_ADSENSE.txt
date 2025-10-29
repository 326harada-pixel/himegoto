
AdSense 審査対策パック（UI変更なし） — build014
==============================================

同梱ファイル
- privacy.html …… 充実版プライバシーポリシー（Cookie / AdSense / オプトアウト記載）
- terms.html …… 広告利用とCookie参照への言及を追加
- ads.txt …… あなたのパブリッシャーID（pub-7563803975606087）入り

アップロード先
- 3ファイルとも **himegoto のプロジェクト直下**（index.html と同じ階層）

チェックリスト（審査前に）
1) AdSense のサイト追加でドメイン `himegoto.vercel.app` を登録済み
2) Vercel でデプロイ後、`https://himegoto.vercel.app/privacy.html` と `…/terms.html` が閲覧可能
3) `https://himegoto.vercel.app/ads.txt` に 1行表示される（404や空白でない）
4) 重大なリンク切れや空白ページが無い
5) アダルト/暴力/著作権侵害等のコンテンツが無い
6) 広告ユニットは操作ボタンに密接しすぎない（誤クリック誘導なし）

（補足）EEAの同意管理（CMP）は、該当地域のユーザー比率が高い場合のみ後追い実装を推奨。
