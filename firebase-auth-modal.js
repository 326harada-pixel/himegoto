// firebase phone auth modal (build007)
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js';
import { getAuth, signInWithPhoneNumber, RecaptchaVerifier, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js';

function ensureApp(){
  const apps = getApps();
  if(apps.length) return apps[0];
  const cfg = window.FIREBASE_CONFIG;
  if(!cfg){ console.warn('FIREBASE_CONFIG が見つかりません'); throw new Error('Firebase config missing'); }
  return initializeApp(cfg);
}

function showModal(msg){ const m=document.getElementById('modal'); document.getElementById('modal-text').textContent=msg||'処理中…'; m.setAttribute('aria-hidden','false'); }
function hideModal(){ document.getElementById('modal').setAttribute('aria-hidden','true'); }

async function loginFlow(){
  const app = ensureApp();
  const auth = getAuth(app);
  // Prompt user for phone
  const phone = prompt('電話番号（+81...）を入力してください');
  if(!phone) return;
  showModal('SMSを送信中…');
  try{
    const container = document.createElement('div');
    container.id='recaptcha-container';
    document.body.appendChild(container);
    const verifier = new RecaptchaVerifier(container, { size:'invisible' }, auth);
    const result = await signInWithPhoneNumber(auth, phone, verifier);
    hideModal();
    const code = prompt('SMS認証コードを入力してください');
    if(!code) return;
    showModal('サインイン中…');
    await result.confirm(code);
    alert('ログインしました');
  }catch(e){
    hideModal();
    alert('ログインに失敗しました: '+ e);
  }finally{
    const el=document.getElementById('recaptcha-container'); if(el) el.remove();
  }
}

(function(){
  window.HimeAuth = {
    open: loginFlow
  };
  try{
    const app = ensureApp();
    const auth = getAuth(app);
    onAuthStateChanged(auth, (user)=>{
      const badge = document.getElementById('plan-extra');
      if(user){ badge.textContent = 'ログイン中：' + (user.phoneNumber||''); }
    });
  }catch(e){
    console.warn('Auth init skipped:', e.message);
  }
})();
