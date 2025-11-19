(function(){
  const $ = (s)=>document.querySelector(s);
  const on = (el,ev,fn)=>el&&el.addEventListener(ev,fn);

  // --- グローバル変数 ---
  const auth = firebase.auth();
  const db = firebase.firestore();
  const APP_URL = "https://himegoto.jp/register.html"; 
  auth.languageCode = 'ja';

  // --- DOM要素 ---
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
  
  // --- 状態変数 ---
  let confirmationResult = null; 

  // ==========================================================
  // 1. 起動時の処理
  // ==========================================================
  auth.onAuthStateChanged(user => {
    if (user) {
      regSection.style.display = 'none'; 
      refSection.style.display = 'block'; 
      setupMyReferralSection(user.uid);
    } else {
      regSection.style.display = 'block'; 
      refSection.style.display = 'none'; 
      checkUrlForReferral();
      
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupRecaptcha);
      } else {
        setupRecaptcha();
      }
    }
  });

  // ==========================================================
  // 2. セットアップと補助関数
  // ==========================================================

  function showMessage(text, isError) {
    if (!smsMsg) return;
    smsMsg.textContent = text;
    smsMsg.style.color = isError ? '#D32F2F' : '#4CAF50';
  }
  
  function toInternationalFormat(phone) {
    if (!phone) return '';
    if (phone.startsWith('+')) return phone;
    if (phone.startsWith('0')) return '+81' + phone.substring(1);
    return '+81' + phone;
  }

  function checkUrlForReferral() {
    try {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get('ref'); 
      if (ref && refCodeInput) refCodeInput.value = ref;
    } catch (e) {}
  }

  function setupRecaptcha() {
    if (window.recaptchaVerifier) return;

    const container = document.getElementById('recaptcha-container-root');
    if (!container) {
      showMessage('HTMLの更新が反映されていません。キャッシュをクリアしてください。', true);
      return;
    }
    
    try {
      window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container-root', {
        'size': 'normal', 
        'callback': (response) => {
          console.log("reCAPTCHA verified");
          sendSmsInternal();
        },
        'expired-callback': () => {
          showMessage('有効期限切れです。再読み込みしてください。', true);
        }
      }, auth);

      window.recaptchaVerifier.render().then((widgetId) => {
          console.log('reCAPTCHA rendered:', widgetId);
          window.recaptchaWidgetId = widgetId;
      }).catch((error) => {
          console.error("reCAPTCHA render error:", error);
          showMessage(`初期化エラー: ${error.code || error.message}`, true);
      });
    } catch (e) {
      showMessage(`初期化例外: ${e.message}`, true);
    }
  }

  // ==========================================================
  // 3. SMS送信ロジック
  // ==========================================================
  on(sendCodeSms, 'click', () => {
      const phoneNumber = toInternationalFormat(phoneInput.value.trim());
      if (!phoneNumber) {
        showMessage('電話番号を入力してください。', true);
        return;
      }

      if (!confirmationResult) {
        if (!window.recaptchaVerifier || !window.recaptchaWidgetId) {
            // ロード中の可能性もあるため、少し待つメッセージ
            showMessage('読み込み中... 「私はロボットではありません」が表示されたらチェックしてください。', false);
        } else {
            showMessage('↑「私はロボットではありません」にチェックを入れてください。', false);
        }
      }
  });

  function sendSmsInternal() {
    const appVerifier = window.recaptchaVerifier;
    const phoneNumber = toInternationalFormat(phoneInput.value.trim());

    if (!phoneNumber) {
      showMessage('電話番号を入力してください。', true);
      return;
    }

    sendCodeSms.disabled = true; 
    showMessage('認証コードを送信中...', false);

    auth.signInWithPhoneNumber(phoneNumber, appVerifier)
      .then((result) => {
        confirmationResult = result;
        showMessage('認証コードを送信しました！入力して「認証して登録する」を押してください。', false);
        sendCodeSms.disabled = false; 
      })
      .catch((error) => {
        console.error("SMS送信エラー:", error);
        showMessage(`送信失敗: ${error.code} ${error.message}`, true);
        sendCodeSms.disabled = false;
        if (window.grecaptcha && window.recaptchaWidgetId) {
            grecaptcha.reset(window.recaptchaWidgetId);
        }
      });
  }

  // ==========================================================
  // 4. 登録処理
  // ==========================================================
  on(verifySms,'click',() => {
    const code = codeSms.value.trim();
    if (!code) {
      showMessage('認証コードを入力してください。', true);
      return;
    }
    if (!confirmationResult) {
      showMessage('先にreCAPTCHAチェックを行ってください。', true);
      return;
    }

    verifySms.disabled = true;
    showMessage('登録処理中...', false);

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
        });

        alert('登録完了！ホームへ移動します');
        location.href = 'index.html';
      })
      .catch((error) => {
        console.error("登録エラー:", error);
        showMessage('コードが間違っているか、有効期限切れです。', true);
        verifySms.disabled = false;
      });
  });

  // ==========================================================
  // 5. 紹介ID表示
  // ==========================================================
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


