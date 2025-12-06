
(function(){
  const APP_URL = "https://himegoto.jp/register.html";

  const $ = (s) => document.querySelector(s);
  const on = (el, ev, fn) => el && el.addEventListener(ev, fn);

  const auth = firebase.auth();
  const db   = firebase.firestore();

  let confirmationResult = null;
  let recaptchaVerifier  = null;
  let recaptchaReady     = false;

  function logError(msg){
    const el = $('#error-log');
    if(el){
      el.style.display = 'block';
      el.textContent = `【エラー診断】\n${msg}`;
    }
    console.error(msg);
  }

  function showMessage(text, isError){
    const smsMsg = $('#smsMessage');
    if(!smsMsg) return;
    smsMsg.textContent = text;
    smsMsg.className = isError ? 'status-msg status-error' : 'status-msg status-success';
  }

  function toInternationalFormat(phone){
    if(!phone) return '';
    let p = phone.replace(/[━.*+\s-]/g, '');
    if(p.startsWith('0')) return '+81' + p.substring(1);
    return '+81' + p;
  }

  function setupRecaptcha(){
    const container = document.getElementById('recaptcha-container');
    if(!container){
      logError('recaptcha-container が見つかりません');
      return;
    }

    if(recaptchaVerifier){
      try{ recaptchaVerifier.clear(); }catch(e){}
      container.innerHTML = "";
    }

    try{
      recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
        size: 'normal',
        callback: function(){
          recaptchaReady = true;
          showMessage('認証OK。コード送信ボタンを押してください。', false);
          const sendBtn = $('#sendCodeSms');
          if(sendBtn) sendBtn.disabled = false;
        },
        'expired-callback': function(){
          recaptchaReady = false;
          showMessage('reCAPTCHAの有効期限が切れました。もう一度チェックしてください。', true);
          const sendBtn = $('#sendCodeSms');
          if(sendBtn) sendBtn.disabled = true;
        }
      }, auth);

      recaptchaVerifier.render().then(function(widgetId){
        console.log('reCAPTCHA ready: ' + widgetId);
      }).catch(function(error){
        logError('reCAPTCHAエラー: ' + error.code);
      });
    }catch(e){
      logError('reCAPTCHA初期化エラー: ' + e.message);
    }
  }

  function setupMyReferralSection(uid){
    const refId = uid.substring(0, 8);
    const myRefId     = $('#myRefId');
    const copyRefId   = $('#copyRefId');
    const shareRefLink= $('#shareRefLink');
    const refMessage  = $('#refMessage');

    if(myRefId) myRefId.value = refId;

    on(copyRefId, 'click', function(){
      if(!myRefId) return;
      myRefId.select();
      document.execCommand('copy');
      if(refMessage){
        refMessage.textContent = 'コピーしました';
        refMessage.className   = 'status-msg status-success';
      }
    });

    on(shareRefLink, 'click', async function(){
      const shareUrl  = APP_URL + '?ref=' + refId;
      const shareText = 'himegotoに登録しませんか？\n特典付きリンクはこちら🎁\n' + shareUrl;
      try{
        if(navigator.share){
          await navigator.share({ title: 'himegoto', text: shareText, url: shareUrl });
        }else if(navigator.clipboard){
          await navigator.clipboard.writeText(shareUrl);
          if(refMessage){
            refMessage.textContent = 'リンクをコピーしました';
            refMessage.className   = 'status-msg status-success';
          }
        }
      }catch(e){
        console.log(e);
      }
    });
  }

  window.addEventListener('load', function(){
    const regSection  = $('#registration-section');
    const refSection  = $('#my-referral-section');
    const phoneInput  = $('#phoneInput');
    const sendCodeSms = $('#sendCodeSms');
    const codeSms     = $('#codeSms');
    const refCodeInput= $('#refCode');
    const verifySms   = $('#verifySms');

    if(regSection) regSection.style.display = 'block';
    if(refSection) refSection.style.display = 'none';

    // URL の ref パラメータを紹介コードに反映
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if(ref && refCodeInput) refCodeInput.value = ref;

    // reCAPTCHA 初期化
    setupRecaptcha();

    // 既にログイン済みなら紹介画面を表示
    auth.onAuthStateChanged(function(user){
      if(user){
        if(regSection) regSection.style.display = 'none';
        if(refSection) refSection.style.display = 'block';
        setupMyReferralSection(user.uid);
      }
    });

    // コード送信
    on(sendCodeSms, 'click', function(){
      if(!recaptchaVerifier || !recaptchaReady){
        showMessage('reCAPTCHA を完了してください。', true);
        return;
      }

      if(!phoneInput){
        showMessage('入力欄が見つかりません。', true);
        return;
      }

      const rawPhone = phoneInput.value.trim();
      if(!rawPhone){
        showMessage('電話番号を入力してください。', true);
        return;
      }

      const phoneNumber = toInternationalFormat(rawPhone);
      sendCodeSms.disabled = true;
      showMessage('送信中...', false);

      auth.signInWithPhoneNumber(phoneNumber, recaptchaVerifier)
        .then(function(result){
          confirmationResult = result;
          showMessage('送信完了！届いた6桁のコードを入力してください。', false);
          if(codeSms)   codeSms.disabled   = false;
          if(verifySms) verifySms.disabled = false;
          sendCodeSms.disabled = false;
        })
        .catch(function(error){
          console.error('SMS送信エラー:', error);
          let msg = error.message;
          if(error.code === 'auth/invalid-api-key'){
            msg = 'APIキーが無効です。Google Cloudの設定を確認してください。';
          }
          showMessage('送信失敗: ' + msg, true);
          sendCodeSms.disabled = false;
        });
    });

    // コード検証・登録
    on(verifySms, 'click', function(){
      if(!confirmationResult){
        showMessage('先にコード送信を行ってください。', true);
        return;
      }
      if(!codeSms){
        showMessage('コード入力欄が見つかりません。', true);
        return;
      }

      const code = codeSms.value.trim();
      if(!code){
        showMessage('6桁コードを入力してください。', true);
        return;
      }

      verifySms.disabled = true;
      showMessage('確認中...', false);

      confirmationResult.confirm(code)
        .then(async function(result){
          const user = result.user;
          await db.collection('users').doc(user.uid).collection('purchases').doc('current').set({
            expiresAt: null,
            registeredAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          const appliedRef = (refCodeInput && refCodeInput.value.trim()) || '';
          await db.collection('users').doc(user.uid).collection('profile').doc('info').set({
            appliedRefCode: appliedRef
          }, { merge: true });

          alert('登録が完了しました！');

          if(regSection) regSection.style.display = 'none';
          if(refSection) refSection.style.display = 'block';
          setupMyReferralSection(user.uid);
        })
        .catch(function(error){
          verifySms.disabled = false;
          if(error.code === 'auth/invalid-verification-code'){
            showMessage('コードが違います。再入力してください。', true);
          }else{
            showMessage('認証エラー: ' + error.message, true);
          }
        });
    });
  });
})();
