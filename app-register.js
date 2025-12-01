(function(){
  const $ = (s) => document.querySelector(s);
  const on = (el,ev,fn) => el && el.addEventListener(ev, fn);

  // エラーログ表示
  function logError(msg) {
    const el = $('#error-log');
    if(el) {
      el.style.display = 'block';
      el.textContent = `【エラー診断】\n${msg}`;
    }
    console.error(msg);
  }

  const auth = firebase.auth();
  const db = firebase.firestore();
  const APP_URL = "https://himegoto.jp/register.html"; 

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

  // メッセージ表示
  function showMessage(text, isError) {
    if (!smsMsg) return;
    smsMsg.textContent = text;
    smsMsg.className = isError ? 'status-msg status-error' : 'status-msg status-success';
  }

  // 電話番号整形 (+81)
  function toInternationalFormat(phone) {
    if (!phone) return '';
    let p = phone.replace(/[━.*+\s-]/g, '');
    if (p.startsWith('0')) return '+81' + p.substring(1);
    return '+81' + p;
  }

  // reCAPTCHA 初期化
  function setupRecaptcha() {
    const container = document.getElementById('recaptcha-container');
    if (!container) {
      logError("recaptcha-container が見つかりません。HTML側のIDを確認してください。");
      return;
    }

    if (window.recaptchaVerifier) {
      try { window.recaptchaVerifier.clear(); } catch(e){}
      container.innerHTML = ""; 
    }

    try {
      window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
        'size': 'normal',
        'callback': () => {
          showMessage("認証OK。コード送信ボタンを押してください。", false);
          sendCodeSms.disabled = false;
          sendCodeSms.textContent = "コード送信";
        },
        'expired-callback': () => {
          showMessage("有効期限切れです。チェックし直してください。", true);
          sendCodeSms.disabled = true;
        }
      });

      window.recaptchaVerifier.render().then((widgetId) => {
        window.recaptchaWidgetId = widgetId;
      }).catch(error => {
        let hint = "";
        if (error.code === 'auth/invalid-api-key') {
            hint = "★重要: Google Cloud の API キー設定が未反映の可能性。";
        }
        logError(`reCAPTCHA エラー: ${error.code}\n${hint}`);
      });

    } catch (e) {
      logError(`reCAPTCHA 初期化エラー: ${e.message}`);
    }
  }

  // 起動処理
  document.addEventListener("DOMContentLoaded", () => {

    auth.onAuthStateChanged(user => {
      if (user) {
        if (regSection) regSection.style.display = 'none';
        if (refSection) refSection.style.display = 'block';
        setupMyReferralSection(user.uid);

      } else {
        if (regSection) regSection.style.display = 'block';
        if (refSection) refSection.style.display = 'none';

        // 紹介コード付きURL対応
        const params = new URLSearchParams(window.location.search);
        const ref = params.get('ref'); 
        if (ref && refCodeInput) refCodeInput.value = ref;

        setTimeout(setupRecaptcha, 500);
      }
    });

  });

  // コード送信
  on(sendCodeSms, 'click', () => {
    const rawPhone = phoneInput.value.trim();
    if (!rawPhone) {
      showMessage('電話番号を入力してください。', true);
      return;
    }
    const phoneNumber = toInternationalFormat(rawPhone);

    if (!window.recaptchaVerifier || !window.recaptchaWidgetId) {
      showMessage('reCAPTCHA を読み込んでいます…', true);
      setupRecaptcha();
      return;
    }

    sendCodeSms.disabled = true;
    showMessage('送信中...', false);

    auth.signInWithPhoneNumber(phoneNumber, window.recaptchaVerifier)
      .then((result) => {
        confirmationResult = result;
        showMessage('送信完了！届いた6桁のコードを入力してください。', false);
        
        sendCodeSms.disabled = false;
        sendCodeSms.textContent = "再送信";
        
        codeSms.disabled = false;
        verifySms.disabled = false;
      })
      .catch((error) => {
        sendCodeSms.disabled = false;
        let msg = error.message;
        if (error.code === 'auth/invalid-api-key') msg = "APIキーが無効です。";

        showMessage("送信失敗: " + msg, true);
        if(window.recaptchaVerifier) window.recaptchaVerifier.reset();
      });
  });

  // 登録
  on(verifySms, 'click', () => {
    const code = codeSms.value.trim();
    if (!code || !confirmationResult) return;

    verifySms.disabled = true;
    showMessage('確認中...', false);

    confirmationResult.confirm(code)
      .then(async (result) => {
        const user = result.user;
        
        await db.collection('users').doc(user.uid).collection('purchases').doc('current').set({
          expiresAt: null,
          registeredAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        const appliedRef = refCodeInput.value.trim() || '';
        await db.collection('users').doc(user.uid).collection('profile').doc('info').set({
          appliedRefCode: appliedRef
        }, { merge: true });

        alert('登録が完了しました！');
        location.reload();
      })
      .catch((error) => {
        verifySms.disabled = false;
        if (error.code === 'auth/invalid-verification-code') {
            showMessage('コードが違います。', true);
        } else {
            showMessage("認証エラー: " + error.message, true);
        }
      });
  });

  // 紹介関連
  function setupMyReferralSection(uid) {
    const refId = uid.substring(0, 8);
    if (myRefId) myRefId.value = refId;
    
    on(copyRefId, 'click', () => {
      myRefId.select();
      document.execCommand('copy'); 
      if(refMessage) {
        refMessage.textContent = 'コピーしました';
        refMessage.className = 'status-msg status-success';
      }
    });

    on(shareRefLink, 'click', async () => {
      const shareUrl = `${APP_URL}?ref=${refId}`;
      const shareText = `himegoto に登録しませんか？\n特典付きリンクはこちら🎁\n${shareUrl}`;
      try {
        if (navigator.share) {
          await navigator.share({ title: 'himegoto', text: shareText, url: shareUrl });
        } else {
          await navigator.clipboard.writeText(shareUrl);
          if(refMessage) {
            refMessage.textContent = 'リンクをコピーしました';
            refMessage.className = 'status-msg status-success';
          }
        }
      } catch (e) {}
    });
  }

})();
