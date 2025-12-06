// fixed app-register.js
(function(){
  const $ = (s) => document.querySelector(s);
  const on = (el,ev,fn) => el && el.addEventListener(ev, fn);

  window.recaptchaPassed = false;

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
  const shareRefLink = $('#shareRefLink');
  const refMessage = $('#refMessage');

  let confirmationResult = null;

  function showMessage(text, isError){
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
    if(!container) return;

    if(window.recaptchaVerifier){
      try{ window.recaptchaVerifier.clear(); }catch(e){}
      container.innerHTML = "";
    }

    try{
      window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container',{
        size:'normal',
        callback:()=>{
          window.recaptchaPassed = true;
          showMessage('認証OK。コード送信ボタンを押してください。', false);
          sendCodeSms.disabled = false;
        },
        'expired-callback':()=>{
          window.recaptchaPassed = false;
          showMessage('reCAPTCHAの有効期限が切れています。', true);
        }
      });

      window.recaptchaVerifier.render().then(id=>{
        window.recaptchaWidgetId = id;
      });

    }catch(e){
      console.error(e);
    }
  }

  auth.onAuthStateChanged(user=>{
    if(user){
      regSection.style.display='none';
      refSection.style.display='block';
    }else{
      regSection.style.display='block';
      refSection.style.display='none';
      setTimeout(setupRecaptcha,400);
    }
  });

  on(sendCodeSms,'click',()=>{
    if(!window.recaptchaPassed){
      showMessage('reCAPTCHA を完了してください。', true);
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

    auth.signInWithPhoneNumber(phoneNumber, window.recaptchaVerifier)
      .then(result=>{
        confirmationResult = result;
        showMessage('送信完了！6桁コードを入力してください。', false);

        codeSms.disabled = false;
        verifySms.disabled = false;
        sendCodeSms.disabled = false;
      })
      .catch(err=>{
        showMessage('送信失敗: '+err.message,true);
        sendCodeSms.disabled = false;
      });
  });

  on(verifySms,'click',()=>{
    const code = codeSms.value.trim();
    if(!code || !confirmationResult) return;

    verifySms.disabled = true;
    showMessage('確認中...', false);

    confirmationResult.confirm(code)
      .then(async result=>{
        const user = result.user;

        await db.collection('users').doc(user.uid)
          .collection('purchases').doc('current')
          .set({registeredAt: firebase.firestore.FieldValue.serverTimestamp()});

        alert('登録完了！');
      })
      .catch(err=>{
        verifySms.disabled = false;
        showMessage('認証エラー: '+err.message,true);
      });
  });

})();