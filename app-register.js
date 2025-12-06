// rebuilt minimal functional SMS flow
let auth, db;

window.onload = function(){
  try{
    auth = firebase.auth();
    db   = firebase.firestore();
    setupRecaptcha();
    bindEvents();
  }catch(e){ console.error(e); }
};

function qs(x){ return document.querySelector(x); }
function msg(t, err){ const el=qs('#smsMessage'); if(!el)return;
  el.textContent=t; el.className= err?'status-msg status-error':'status-msg status-success';
}

function setupRecaptcha(){
  try{
    window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container',
      { size:'normal',
        callback:()=>{ qs('#sendCodeSms').disabled=false; msg('認証OK',false); },
        'expired-callback':()=>{ qs('#sendCodeSms').disabled=true; msg('有効期限切れ',true); }
      }, auth);
    window.recaptchaVerifier.render();
  }catch(e){ console.error(e); }
}

function toIntl(p){
  p = p.replace(/[^0-9]/g,'');
  if(p.startsWith('0')) return '+81'+p.slice(1);
  return '+81'+p;
}

let confirmationResult=null;

function bindEvents(){
  const sendBtn = qs('#sendCodeSms');
  const phone   = qs('#phoneInput');
  const code    = qs('#codeSms');
  const verify  = qs('#verifySms');
  const ref     = qs('#refCode');

  sendBtn.addEventListener('click', async ()=>{
    const raw = phone.value.trim();
    if(!/^[0-9]{10,11}$/.test(raw)){ msg('電話番号は10〜11桁',true); return; }

    if(!window.recaptchaVerifier){ msg('reCAPTCHA未準備',true); return; }

    sendBtn.disabled=true; msg('送信中...',false);
    try{
      confirmationResult = await auth.signInWithPhoneNumber(toIntl(raw), window.recaptchaVerifier);
      msg('送信完了！コード入力を',false);
      code.disabled=false; verify.disabled=false;
      sendBtn.disabled=false; sendBtn.textContent='再送信';
    }catch(e){
      console.error(e); msg('送信失敗: '+e.message,true);
      sendBtn.disabled=false;
      try{ window.recaptchaVerifier.reset(); }catch(_){}
    }
  });

  verify.addEventListener('click', async ()=>{
    if(!confirmationResult) return;
    const c = code.value.trim();
    if(!c){ msg('コード未入力',true); return; }

    verify.disabled=true; msg('確認中...',false);
    try{
      const result = await confirmationResult.confirm(c);
      const uid = result.user.uid;

      await db.collection('users').doc(uid).collection('purchases').doc('current')
        .set({expiresAt:null, registeredAt: firebase.firestore.FieldValue.serverTimestamp()});

      const r = ref.value.trim()||'';
      await db.collection('users').doc(uid).collection('profile').doc('info')
        .set({appliedRefCode:r},{merge:true});

      alert('登録完了！');
      location.reload();

    }catch(e){
      verify.disabled=false;
      msg('認証エラー: '+e.message,true);
    }
  });
}
