(function(){
  const $ = (s) => document.querySelector(s);
  const on = (el,ev,fn) => el && el.addEventListener(ev, fn);

  // グローバル変数
  const auth = firebase.auth();
  const db = firebase.firestore();
  const APP_URL = "https://himegoto.jp/register.html"; 

  // DOM要素
  const regSection = $('#registration-section'); 
  const refSection = $('#my-referral-section'); 
  const smsMsg = $('#smsMessage');
  const errorLog = $('#error-log');
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

  // メッセージ表示
  function showMessage(text, isError) {
    if (!smsMsg) return;
    smsMsg.textContent = text;
    smsMsg.style.color = isError ? '#D32F2F' : '#4CAF50';
  }

  // 詳細エラー表示（Google Cloud設定ミスなどをここに表示）
  function showErrorLog(msg) {
    if (errorLog) {
      errorLog.style.display = 'block';
      errorLog.textContent = msg;
    }
  }

  // 電話番号整形
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
    // コンテナがあるか確認
    const container = document.getElementById('recaptcha-container');
    if (!container) return;

    // 既に初期化済みならリセット
    if (window.recaptchaVerifier) {
      try { window.recaptchaVerifier.clear(); } catch(e){}
    }

    try {
      // チェックボックスを表示 ('normal')
      window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
        'size': 'normal',
        'callback': (response) => {
          // チェックが入った時
          showMessage("認証OK。コード送信を押してください。", false);
          sendCodeSms.disabled = false;
        },
        'expired-callback': () => {
          showMessage("有効期限切れです。再読み込みしてください。", true);
          sendCodeSms.disabled = true;
        }
      }, auth);

      // 描画実行
      window.recaptchaVerifier.render().then((widgetId) => {
        window.recaptchaWidgetId = widgetId;
        console.log("reCAPTCHA ready");
      }).catch(error => {
        console.error(error);
        showErrorLog(`reCAPTCHAエラー: ${error.code || ''} ${error.message}`);
      });

    } catch (e) {
      showErrorLog(`初期化例外: ${e.message}`);
    }
  }

  // -------------------------------------------------------
  // 2. 起動時の処理
  // -------------------------------------------------------
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
      
      // 紹介コードの自動入力
      const params = new URLSearchParams(window.location.search);
      const ref = params.get('ref'); 
      if (ref && refCodeInput) refCodeInput.value = ref;

      // 少し待ってからreCAPTCHAを表示
      setTimeout(setupRecaptcha, 500);
    }
  });

  // -------------------------------------------------------
  // 3. コード送信処理
  // -------------------------------------------------------
  on(sendCodeSms, 'click', () => {
    const rawPhone = phoneInput.value.trim();
    if (!rawPhone) {
      showMessage('電話番号を入力してください。', true);
      return;
    }
    const phoneNumber = toInternationalFormat(rawPhone);

    // reCAPTCHAが準備できていない場合
    if (!window.recaptchaVerifier || !window.recaptchaWidgetId) {
      showMessage('reCAPTCHAを読み込んでいます...お待ちください', true);
      setupRecaptcha(); // 再試行
      return;
    }

    sendCodeSms.disabled = true;
    showMessage('送信中...', false);
    showErrorLog(''); // エラーログ消去

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
        
        // エラー内容の振り分け
        if (error.code === 'auth/invalid-api-key') {
            showErrorLog("【重要】Google Cloudの設定でAPIキーが制限されています。「キーを制限しない」に変更してください。");
        } else if (error.message && error.message.includes('domain')) {
            showErrorLog("ドメインが許可されていません。Firebaseコンソールを確認してください。");
        } else if (error.code === 'auth/invalid-phone-number') {
            showMessage('電話番号の形式が正しくありません。', true);
        } else {
            showErrorLog(`送信エラー: ${error.code} - ${error.message}`);
        }
        
        // リセット
        if(window.recaptchaVerifier) window.recaptchaVerifier.reset();
      });
  });

  // -------------------------------------------------------
  // 4. 登録（コード確認）処理
  // -------------------------------------------------------
  on(verifySms, 'click', () => {
    const code = codeSms.value.trim();
    if (!code || !confirmationResult) return;

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

        alert('登録完了！ホームへ移動します');
        location.href = 'index.html';
      })
      .catch((error) => {
        verifySms.disabled = false;
        showMessage('コードが間違っているか、有効期限切れです。', true);
        console.error(error);
      });
  });

  // -------------------------------------------------------
  // 5. 紹介ID表示（認証済み用）
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
