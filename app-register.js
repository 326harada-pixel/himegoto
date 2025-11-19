(function(){
  const $ = (s) => document.querySelector(s);
  const on = (el,ev,fn) => el && el.addEventListener(ev, fn);

  // グローバル変数
  const auth = firebase.auth();
  const db = firebase.firestore();
  const APP_URL = "https://himegoto.jp/register.html"; // 本番URL

  // DOM要素
  const regSection = $('#registration-section'); 
  const refSection = $('#my-referral-section'); 
  const smsMsg = $('#smsMessage');
  const phoneInput = $('#phoneInput');
  const sendCodeSms = $('#sendCodeSms'); 
  const codeSms = $('#codeSms');
  const refCodeInput = $('#refCode'); 
  const verifySms = $('#verifySms');
  const myRefId = $('#myRefId');
  const copyRefId = $('#copyRefId');
  const shareRefLink = $('#shareRefLink');
  const refMessage = $('#refMessage');
  
  let confirmationResult = null; 

  // メッセージ表示ヘルパー
  function showMessage(text, isError) {
    if (!smsMsg) return;
    smsMsg.textContent = text;
    smsMsg.style.color = isError ? '#D32F2F' : '#4CAF50';
  }

  // 電話番号整形 (+81)
  function toInternationalFormat(phone) {
    if (!phone) return '';
    let p = phone.replace(/[━.*+]/g, ''); // 記号除去
    if (p.startsWith('0')) return '+81' + p.substring(1);
    return '+81' + p;
  }

  // -------------------------------------------------------
  // 1. 起動処理 & reCAPTCHA初期化
  // -------------------------------------------------------
  // DOM読み込み完了を待ってからreCAPTCHAを初期化
  window.addEventListener('DOMContentLoaded', () => {
    if (!window.recaptchaVerifier) {
      try {
        // ★ invisible設定（ボタンには紐付けず、コンテナに紐付ける）
        window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
          'size': 'invisible',
          'callback': (response) => {
            // 自動的に解決された場合に呼ばれるが、
            // 実際の送信処理は signInWithPhoneNumber の Promise で行われるためログのみ
            console.log("reCAPTCHA solved silently.");
          },
          'expired-callback': () => {
            showMessage('認証の有効期限が切れました。もう一度送信ボタンを押してください。', true);
          }
        }, auth);
        
        // 事前レンダリング（これで「準備中」フリーズを防ぐ）
        window.recaptchaVerifier.render().then(widgetId => {
          console.log("reCAPTCHA ready, ID:", widgetId);
        });
      } catch (e) {
        console.error("reCAPTCHA init error:", e);
      }
    }
  });

  // 認証状態監視
  auth.onAuthStateChanged(user => {
    if (user) {
      // ログイン済み
      regSection.style.display = 'none'; 
      refSection.style.display = 'block'; 
      setupMyReferralSection(user.uid);
    } else {
      // 未ログイン
      regSection.style.display = 'block'; 
      refSection.style.display = 'none'; 
      // URLパラメータの紹介コード取得
      const params = new URLSearchParams(window.location.search);
      const ref = params.get('ref'); 
      if (ref && refCodeInput) refCodeInput.value = ref;
    }
  });

  // -------------------------------------------------------
  // 2. SMS送信フロー (Invisible)
  // -------------------------------------------------------
  on(sendCodeSms, 'click', () => {
    const rawPhone = phoneInput.value.trim();
    if (!rawPhone) {
      showMessage('電話番号を入力してください。', true);
      return;
    }
    const phoneNumber = toInternationalFormat(rawPhone);

    // reCAPTCHAが準備できているか確認
    if (!window.recaptchaVerifier) {
      showMessage('セキュリティ認証の準備中です。数秒待ってから再度押してください。', true);
      return;
    }

    sendCodeSms.disabled = true;
    showMessage('認証コードを送信中...', false);

    // ★ ここで reCAPTCHA が自動的に立ち上がる
    auth.signInWithPhoneNumber(phoneNumber, window.recaptchaVerifier)
      .then((result) => {
        confirmationResult = result;
        showMessage('送信完了！ 届いた6桁のコードを入力してください。', false);
        sendCodeSms.disabled = false;
        sendCodeSms.textContent = "再送信";
        // 入力欄を有効化
        codeSms.disabled = false;
        verifySms.disabled = false;
      })
      .catch((error) => {
        console.error("SMS送信エラー:", error);
        sendCodeSms.disabled = false;
        
        let msg = '送信に失敗しました。';
        if (error.code === 'auth/invalid-phone-number') msg = '電話番号の形式が正しくありません。';
        if (error.code === 'auth/too-many-requests') msg = '送信回数が多すぎます。しばらく待ってください。';
        if (error.message && error.message.includes('domain')) msg = '【重要】ドメイン未承認エラー。Firebase設定を確認してください。';
        
        showMessage(msg, true);
        
        // 失敗したらリセットして再試行できるようにする
        if (window.recaptchaVerifier) window.recaptchaVerifier.clear();
      });
  });

  // -------------------------------------------------------
  // 3. コード検証 & 登録
  // -------------------------------------------------------
  on(verifySms, 'click', () => {
    const code = codeSms.value.trim();
    if (!code) {
      showMessage('認証コードを入力してください。', true);
      return;
    }
    if (!confirmationResult) {
      showMessage('先にコードを送信してください。', true);
      return;
    }

    verifySms.disabled = true;
    showMessage('確認中...', false);

    confirmationResult.confirm(code)
      .then(async (result) => {
        const user = result.user;
        
        // Firestore: 課金情報初期化
        await db.collection('users').doc(user.uid).collection('purchases').doc('current').set({
          expiresAt: null,
          registeredAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Firestore: 紹介コード保存
        const appliedRef = refCodeInput.value.trim() || '';
        await db.collection('users').doc(user.uid).collection('profile').doc('info').set({
          appliedRefCode: appliedRef
        }, { merge: true });

        alert('登録が完了しました！');
        // onAuthStateChanged が画面を切り替えるか、ホームへ移動
        location.href = 'index.html';
      })
      .catch((error) => {
        console.error("認証エラー:", error);
        verifySms.disabled = false;
        if (error.code === 'auth/invalid-verification-code') {
          showMessage('コードが間違っています。', true);
        } else {
          showMessage('認証に失敗しました。コードの有効期限切れの可能性があります。', true);
        }
      });
  });

  // -------------------------------------------------------
  // 4. 紹介IDセクション
  // -------------------------------------------------------
  function setupMyReferralSection(uid) {
    const refId = uid.substring(0, 8);
    if (myRefId) myRefId.value = refId;
    
    on(copyRefId, 'click', () => {
      myRefId.select();
      document.execCommand('copy');
      if(refMessage) refMessage.textContent = 'コピーしました';
    });
    
    on(shareRefLink, 'click', async () => {
      const shareUrl = `${APP_URL}?ref=${refId}`;
      const shareText = `himegotoに登録しませんか？\n特典付きリンクはこちら🎁\n${shareUrl}`;
      try {
        if (navigator.share) {
          await navigator.share({ title: 'himegoto', text: shareText, url: shareUrl });
        } else {
          await navigator.clipboard.writeText(shareUrl);
          if(refMessage) refMessage.textContent = 'リンクをコピーしました';
        }
      } catch (e) {}
    });
  }

})();
