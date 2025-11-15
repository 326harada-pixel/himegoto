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
  // 1. 起動時の処理 (認証状態の監視)
  // ==========================================================
  auth.onAuthStateChanged(user => {
    if (user) {
      // --- 認証済みの場合 ---
      regSection.style.display = 'none'; 
      refSection.style.display = 'block'; 
      setupMyReferralSection(user.uid);
    } else {
      // --- 未認証の場合 ---
      regSection.style.display = 'block'; 
      refSection.style.display = 'none'; 
      checkUrlForReferral();
      // ★修正点: DOMの準備が完了してからreCAPTCHAをセットアップ
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupRecaptcha);
      } else {
        setupRecaptcha();
      }
    }
  });

  // ==========================================================
  // 2. 未認証時の処理
  // ==========================================================

  // 2a. URLをチェック
  function checkUrlForReferral() {
    try {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get('ref'); 
      if (ref && refCodeInput) {
        refCodeInput.value = ref;
        showMessage('紹介コードが入力されました。', false);
      }
    } catch (e) {
      console.warn("URLSearchParams not supported or URL invalid", e);
    }
  }

  // 2b. 補助関数 (メッセージ表示)
  function showMessage(text, isError) {
    if (!smsMsg) return;
    smsMsg.textContent = text;
    smsMsg.style.color = isError ? '#D32F2F' : '#4CAF50';
  }
  
  // 2c. 電話番号を国際形式(+81)に変換
  function toInternationalFormat(phone) {
    if (!phone) return '';
    if (phone.startsWith('+')) return phone;
    if (phone.startsWith('0')) return '+81' + phone.substring(1);
    return '+81' + phone;
  }

  // 2d. reCAPTCHAのセットアップ
  function setupRecaptcha() {
    if (window.recaptchaVerifier) return;
    
    // ★修正点: 隔離されたコンテナID 'recaptcha-container-root' を参照
    window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container-root', {
      'size': 'normal', 
      'callback': (response) => {
        console.log("reCAPTCHA verified, sending SMS...");
        sendSmsInternal();
      },
      'expired-callback': () => {
        showMessage('reCAPTCHAの有効期限が切れました。ページを再読み込みしてください。', true);
      }
    }, auth);

    // reCAPTCHAウィジェットの「表示(render)」にエラー処理を追加
    window.recaptchaVerifier.render().then((widgetId) => {
        console.log('reCAPTCHA rendered, widgetId:', widgetId);
        window.recaptchaWidgetId = widgetId; // 成功の目印
    }).catch((error) => {
        console.error("reCAPTCHA render error:", error);
        showMessage('reCAPTCHAの表示に失敗しました。ドメイン設定を確認するか、ページを再読み込みしてください。', true);
    });
  }

  // 2e. 認証コード送信ボタンのクリック処理
  on(sendCodeSms, 'click', () => {
      const phoneNumber = toInternationalFormat(phoneInput.value.trim());
      if (!phoneNumber) {
        showMessage('電話番号を入力してください。', true);
        return;
      }

      // 1. reCAPTCHAがまだチェックされていない（＝confirmationResultがまだ無い）場合
      if (!confirmationResult) {
        
        // 2. reCAPTCHAの準備自体が失敗しているか確認
        if (!window.recaptchaVerifier || !window.recaptchaWidgetId) {
            showMessage('reCAPTCHAの表示に失敗しました。ページを再読み込みしてください。', true);
        } else {
            // 準備はできているが、まだ押されていない場合
            showMessage('電話番号を入力後、「私はロボットではありません」のチェックボックスを押してください。', false);
        }
      }
  });

  // (reCAPTCHAのコールバックから呼ばれる内部関数)
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
        showMessage('認証コードを送信しました。', false);
        sendCodeSms.disabled = false; 
      })
      .catch((error) => {
        console.error("SMS送信エラー:", error);
        if (error.code === 'auth/invalid-phone-number') {
            showMessage('電話番号の形式が正しくありません。', true);
        } else {
            showMessage('SMS送信に失敗しました。時間をおいて再度お試しください。', true);
        }
        sendCodeSms.disabled = false;
        
        if (window.grecaptcha && window.recaptchaWidgetId) {
            grecaptcha.reset(window.recaptchaWidgetId);
        }
      });
  }


  // 2f. 認証コード確認 と 登録処理
  on(verifySms,'click',() => {
    const code = codeSms.value.trim();
    if (!code) {
      showMessage('認証コードを入力してください。', true);
      return;
    }
    if (!confirmationResult) {
      showMessage('先に電話番号を入力し、reCAPTCHA認証を完了してください。', true);
      return;
    }

    verifySms.disabled = true;
    showMessage('コードを照合し、登録中です...', false);

    confirmationResult.confirm(code)
      .then(async (result) => {
        const user = result.user;
        const uid = user.uid;
        console.log("SMS認証成功:", uid);

        const docRef = db.collection('users').doc(uid).collection('purchases').doc('current');
        await docRef.set({
          expiresAt: null,
          registeredAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        const appliedRefCode = refCodeInput.value.trim() || '';
        const profileRef = db.collection('users').doc(uid).collection('profile').doc('info');
        await profileRef.set({
          appliedRefCode: appliedRefCode
        });
        
        // onAuthStateChangedが自動でUIを切り替える
      })
      .catch((error) => {
        console.error("SMSコード確認または登録エラー:", error);
        showMessage('認証コードが正しくないか、登録に失敗しました。', true);
        verifySms.disabled = false;
      });
  });

  // ==========================================================
  // 3. 認証済み時の処理 (紹介ID表示)
  // ==========================================================
  
  function setupMyReferralSection(uid) {
    const refId = uid.substring(0, 8);
    
    if (myRefId) {
      myRefId.value = refId;
    }
    
    on(copyRefId, 'click', () => {
      myRefId.select();
      document.execCommand('copy'); 
      if(refMessage) refMessage.textContent = 'IDをコピーしました！';
      setTimeout(() => { if(refMessage) refMessage.textContent = ''; }, 2000);
    });

    on(shareRefLink, 'click', async () => {
      const shareUrl = `${APP_URL}?ref=${refId}`;
      const shareText = `himegotoに登録しませんか？\nこのリンクから登録すると特典があります🎁\n${shareUrl}`;

      try {
        if (navigator.share) {
          await navigator.share({
            title: 'himegotoの紹介',
            text: shareText,
            url: shareUrl
          });
        } else {
          await navigator.clipboard.writeText(shareUrl);
          if(refMessage) refMessage.textContent = '紹介リンクをコピーしました！';
          setTimeout(() => { if(refMessage) refMessage.textContent = ''; }, 3000);
        }
      } catch (err) {
        console.error('シェアまたはコピーに失敗:', err);
        try {
            myRefId.value = shareUrl;
            myRefId.select();
            document.execCommand('copy');
            myRefId.value = refId;
            if(refMessage) refMessage.textContent = '紹介リンクをコピーしました！';
            setTimeout(() => { if(refMessage) refMessage.textContent = ''; }, 3000);
        } catch(e) {
            if(refMessage) refMessage.textContent = 'リンクのコピーに失敗しました。';
        }
      }
    });
  }

})();
