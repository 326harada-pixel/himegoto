(function(){
  const $ = (s) => document.querySelector(s);
  const on = (el,ev,fn) => el && el.addEventListener(ev, fn);

  // ログ出力機能
  function logError(msg) {
    const logDiv = $('#debug-log');
    if (logDiv) {
      logDiv.style.display = 'block';
      logDiv.innerHTML += `[${new Date().toLocaleTimeString()}] ${msg}\n`;
    }
    console.error(msg);
  }

  const auth = firebase.auth();
  const db = firebase.firestore();
  const APP_URL = "https://himegoto.jp/register.html"; 

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
  
  let confirmationResult = null; 

  function showMessage(text, isError) {
    if (!smsMsg) return;
    smsMsg.textContent = text;
    smsMsg.style.color = isError ? '#D32F2F' : '#4CAF50';
  }

  function toInternationalFormat(phone) {
    if (!phone) return '';
    let p = phone.replace(/[━.*+]/g, '');
    if (p.startsWith('0')) return '+81' + p.substring(1);
    return '+81' + p;
  }

  // -------------------------------------------------------
  // 1. reCAPTCHA 初期化
  // -------------------------------------------------------
  function setupRecaptcha() {
    if (window.recaptchaVerifier) {
        // 既に描画済みならクリア
        try { window.recaptchaVerifier.clear(); } catch(e){}
    }

    const container = document.getElementById('recaptcha-container');
    if (!container) {
      logError("エラー: HTML内に #recaptcha-container が見つかりません。");
      return;
    }

    try {
      // size: 'normal' で明示的にチェックボックスを表示
      window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
        'size': 'normal',
        'callback': (response) => {
          showMessage("認証OK。コード送信ボタンを押してください。", false);
          sendCodeSms.disabled = false;
        },
        'expired-callback': () => {
          showMessage("認証有効期限切れ。再読み込みしてください。", true);
        }
      }, auth);

      window.recaptchaVerifier.render().then(widgetId => {
        window.recaptchaWidgetId = widgetId;
        // 成功したらコンテナ内の「読み込み中」テキストを消す
        // (Firebaseが上書きするはずだが念のため)
      }).catch(error => {
        logError(`reCAPTCHA表示失敗: ${error.code} - ${error.message}`);
        
        let hint = "";
        if (error.message && error.message.includes("domain")) {
            hint = "【原因】ドメイン未登録の可能性大。\nFirebaseコンソール > Authentication > 設定 > 承認済みドメイン に 'himegoto.jp' を追加してください。";
        } else if (error.message && error.message.includes("key")) {
            hint = "【原因】APIキーが無効です。";
        }
        
        showMessage(`システムエラー: ${hint || "下のログを確認してください"}`, true);
        logError(hint);
      });

    } catch (e) {
      logError(`初期化例外: ${e.message}`);
    }
  }

  // -------------------------------------------------------
  // 2. 起動フロー
  // -------------------------------------------------------
  auth.onAuthStateChanged(user => {
    if (user) {
      regSection.style.display = 'none'; 
      refSection.style.display = 'block'; 
      setupMyReferralSection(user.uid);
    } else {
      regSection.style.display = 'block'; 
      refSection.style.display = 'none'; 
      
      // URLパラメータ処理
      const params = new URLSearchParams(window.location.search);
      const ref = params.get('ref'); 
      if (ref && refCodeInput) refCodeInput.value = ref;
      
      // 少し待ってからreCAPTCHA描画（他スクリプトとの競合回避）
      setTimeout(setupRecaptcha, 500);
    }
  });

  // -------------------------------------------------------
  // 3. 送信処理
  // -------------------------------------------------------
  on(sendCodeSms, 'click', () => {
    const rawPhone = phoneInput.value.trim();
    if (!rawPhone) {
      showMessage('電話番号を入力してください。', true);
      return;
    }
    const phoneNumber = toInternationalFormat(rawPhone);

    if (!window.recaptchaVerifier || !window.recaptchaWidgetId) {
      // まだreCAPTCHAが出ていない場合
      showMessage('reCAPTCHAの読み込み待ちです...', true);
      // 強制再試行
      setupRecaptcha();
      return;
    }

    // reCAPTCHAがチェックされていない場合、Firebaseが自動的にポップアップで促すかエラーになる
    
    sendCodeSms.disabled = true;
    showMessage('送信処理中...', false);

    auth.signInWithPhoneNumber(phoneNumber, window.recaptchaVerifier)
      .then((result) => {
        confirmationResult = result;
        showMessage('送信完了！届いたコードを入力してください。', false);
        sendCodeSms.disabled = false;
        sendCodeSms.textContent = "再送信";
        codeSms.disabled = false;
        verifySms.disabled = false;
      })
      .catch((error) => {
        console.error("SMS送信エラー:", error);
        sendCodeSms.disabled = false;
        
        let msg = `送信エラー: ${error.code}`;
        if (error.code === 'auth/invalid-phone-number') msg = '電話番号の形式が正しくありません。';
        if (error.code === 'auth/too-many-requests') msg = '回数制限です。しばらく待ってください。';
        if (error.code === 'auth/captcha-check-failed') msg = 'reCAPTCHAチェックに失敗しました。';
        
        showMessage(msg, true);
        logError(`送信失敗: ${error.message}`);
        
        // リセット
        try { window.recaptchaVerifier.reset(); } catch(e){}
      });
  });

  // -------------------------------------------------------
  // 4. 登録処理
  // -------------------------------------------------------
  on(verifySms, 'click', () => {
    const code = codeSms.value.trim();
    if (!code || !confirmationResult) return;

    verifySms.disabled = true;
    showMessage('確認中...', false);

    confirmationResult.confirm(code)
      .then(async (result) => {
        const user = result.user;
        
        // Firestore初期化
        await db.collection('users').doc(user.uid).collection('purchases').doc('current').set({
          expiresAt: null,
          registeredAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        const appliedRef = refCodeInput.value.trim() || '';
        await db.collection('users').doc(user.uid).collection('profile').doc('info').set({
          appliedRefCode: appliedRef
        }, { merge: true });

        alert('登録完了！ホームへ移動します');
        location.href = 'index.html';
      })
      .catch((error) => {
        verifySms.disabled = false;
        showMessage('コードが間違っているか、有効期限切れです。', true);
        logError(`登録エラー: ${error.message}`);
      });
  });

  // -------------------------------------------------------
  // 5. 紹介ID表示
  // -------------------------------------------------------
  function setupMyReferralSection(uid) {
    const refId = uid.substring(0, 8);
    if (myRefId) myRefId.value = refId;
    
    on(copyRefId, 'click', () => {
      myRefId.select();
      document.execCommand('copy'); 
      alert('IDをコピーしました');
    });

    on(shareRefLink, 'click', async () => {
      const shareUrl = `${APP_URL}?ref=${refId}`;
      const shareText = `himegotoに登録しませんか？\n特典付きリンクはこちら🎁\n${shareUrl}`;
      try {
        if (navigator.share) {
          await navigator.share({ title: 'himegoto', text: shareText, url: shareUrl });
        } else {
          await navigator.clipboard.writeText(shareUrl);
          alert('リンクをコピーしました');
        }
      } catch (e) {}
    });
  }
})();
