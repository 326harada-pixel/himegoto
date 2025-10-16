
// build009 phone auth (uses global window.FIREBASE_CONFIG or existing app)
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js';
import { getAuth, signInWithPhoneNumber, RecaptchaVerifier, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js';

function ensureApp(){
  const apps = getApps();
  if(apps.length) return apps[0];
  if(!window.FIREBASE_CONFIG) throw new Error('FIREBASE_CONFIG missing');
  return initializeApp(window.FIREBASE_CONFIG);
}
function showModal(msg){ const m=document.getElementById('modal'); document.getElementById('modal-text').textContent=msg||'処理中…'; m.setAttribute('aria-hidden','false'); }
function hideModal(){ document.getElementById('modal').setAttribute('aria-hidden','true'); }

async function loginFlow(){
  try{
    const app = ensureApp();
    const auth = getAuth(app);
    const raw = prompt('電話番号（+81 から）を入力してください'); if(!raw) return endBusy();
    showModal('SMSを送信中…');
    let phone = raw.trim();
    if(/^0(70|80|90)/.test(phone)) phone = '+81' + phone.slice(1);
    const container = document.getElementById('hg-invisible-recaptcha') || document.body;
    const verifier = new RecaptchaVerifier(container, { size:'invisible' }, auth);
    const result = await signInWithPhoneNumber(auth, phone, verifier);
    hideModal();
    const code = prompt('SMSの6桁コードを入力してください'); if(!code) return endBusy();
    showModal('サインイン中…');
    await result.confirm(code);
    hideModal();
    alert('ログインしました');
    window.dispatchEvent(new CustomEvent('hg:login-success'));
  }catch(e){
    hideModal(); alert('ログインに失敗しました: ' + (e && e.message ? e.message : e));
  }finally{
    endBusy();
  }
}
function endBusy(){ const el=document.getElementById('btn-login'); if(el) el.removeAttribute('aria-busy'); }

(function(){
  window.addEventListener('hg:request-login', loginFlow);
  try{
    const app = ensureApp(); const auth=getAuth(app);
    onAuthStateChanged(auth, (user)=>{
      const badge = document.getElementById('plan-badge');
      const exp   = document.getElementById('expiry-text');
      if(user){ badge.textContent='ログイン中'; exp.textContent = user.phoneNumber || '—'; }
    });
  }catch(e){ /* not initialized until FIREBASE_CONFIG is present */ }
})();
