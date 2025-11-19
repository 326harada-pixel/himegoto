(function(){
  const $ = (s) => document.querySelector(s);
  const on = (el,ev,fn) => el && el.addEventListener(ev, fn);

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
  // 1. reCAPTCHA 初期化 (診断モード)
  // -------------------------------------------------------
  function setupRecaptcha() {
    const container = document.getElementById('recaptcha-container');
    if (!container) {
      showMessage('エラー: reCAPTCHAコンテナが見つかりません。HTMLを確認してください。', true);
      return;
    }
    // 初期化済みなら何もしない
    if (window.recaptchaVerifier) {
        container.innerHTML = ""; // 中身をクリアして再描画の準備
        window.recaptchaVerifier.clear();
    }

    try {
      // size: 'normal' (チェックボックスあり) で明示的に表示
      window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
        'size': 'normal',
        'callback': (response) => {
          console.log("reCAPTCHA OK");
          showMessage("認証OK！「コード送信」を押してください。", false);
          sendCodeSms.disabled = false;
        },
        'expired-callback': () => {
          showMessage('認証期限切れ。再読込してください。', true);
        }
      }, auth);

      showMessage('reCAPTCHAを読み込んでいます...', false);

      window.recaptchaVerifier.render().then(widgetId => {
        window.recaptchaWidgetId = widgetId;
        showMessage('', false); // メッセージクリア
        // コンテナの文字を消す
        if(container.childNodes.length === 0) container.innerText = "";
      }).catch(error => {
        console.error("Render Error:", error);
        // ★ここで真犯人を表示します
        showMessage(`【表示エラー】${error.code} : ${error.message}`, true);
      });

    } catch (e) {
      showMessage(`【初期化エラー】${e.message}`, true);
    }
  }

  // -------------------------------------------------------
  // 2. 起動フロー
  // -------------------------------------------------------
  auth.onAuthStateChanged(user => {
    if (user) {
      regSection.style.display = 'none'; 
      refSection.style.display = 'block'; 
      if (myRefId) myRefId.value = user.uid.substring(0, 8);
    } else {
      regSection.style.display = 'block'; 
      refSection.style.display = 'none'; 
      
      // DOM読み込み後に実行
      setTimeout(setupRecaptcha, 1000); // 念のため1秒待ってから描画（他スクリプトとの競合回避）
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

    if (!window.recaptchaVerifier) {
      showMessage('エラー: reCAPTCHAが準備できていません。', true);
      return;
    }

    // チェックボックスが押されているか確認（normalの場合）
    // verifyされていないと signInWithPhoneNumber はエラーになるか、自動でポップアップする
    
    sendCodeSms.disabled = true;
    showMessage('送信処理中...', false);

    auth.signInWithPhoneNumber(phoneNumber, window.recaptchaVerifier)
      .then((result) => {
        confirmationResult = result;
        showMessage('送信完了！コードを入力してください。', false);
        sendCodeSms.disabled = false;
        sendCodeSms.textContent = "再送信";
        codeSms.disabled = false;
        verifySms.disabled = false;
      })
      .catch((error) => {
        console.error("SMS送信エラー:", error);
        sendCodeSms.disabled = false;
        showMessage(`【送信エラー】${error.code}: ${error.message}`, true);
        
        // reCAPTCHAリセット
        if (window.recaptchaVerifier) window.recaptchaVerifier.reset();
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
        await db.collection('users').doc(user.uid).collection('purchases').doc('current').set({
          expiresAt: null,
          registeredAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        const ref = refCodeInput.value.trim();
        if(ref) {
            await db.collection('users').doc(user.uid).collection('profile').doc('info').set({ appliedRefCode: ref }, { merge: true });
        }

        alert('登録完了！');
        location.href = 'index.html';
      })
      .catch((error) => {
        verifySms.disabled = false;
        showMessage(`【認証エラー】${error.code}: ${error.message}`, true);
      });
  });

  // 紹介コピー
  on(copyRefId, 'click', () => {
      if(myRefId) {
          myRefId.select();
          document.execCommand('copy');
          alert("コピーしました");
      }
  });

})();
