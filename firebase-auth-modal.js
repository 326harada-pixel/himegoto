/* Minimal phone auth wrapper (expects project to already be configured on Firebase)
   - Exposes: hgAuth.onState(cb), hgAuth.signIn(), hgAuth.fetchUserInfo()
*/
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

// Expect config to be injected via global or fallback to placeholder (user already set this earlier)
const cfg = window.__FIREBASE_CONFIG__ || {
  apiKey: "AIzaSyD-gLP5rIErs678UewraA0vt59JbLZpzhU",
  authDomain: "himegoto-web.firebaseapp.com",
  projectId: "himegoto-web",
  storageBucket: "himegoto-web.firebasestorage.app",
  messagingSenderId: "368382081243",
  appId: "1:368382081243:web:09e3827701cbc6d1d2f4fe"
};

const app = initializeApp(cfg);
const auth = getAuth(app);
const db = getFirestore(app);

// Simple inline modal prompt
function phonePrompt(){
  const num = prompt("電話番号（国番号込み。例 +81...）");
  if(!num) return;
  const verifierId = "recaptcha-container";
  let box = document.getElementById(verifierId);
  if(!box){ box = Object.assign(document.createElement("div"),{id:verifierId}); document.body.appendChild(box); }
  const verifier = new RecaptchaVerifier(auth, verifierId, { size: "invisible" });
  signInWithPhoneNumber(auth, num, verifier).then((result)=>{
    const code = prompt("SMSの6桁コードを入力してください");
    if(!code) return;
    return result.confirm(code);
  }).catch(err=> alert("認証エラー: " + err.message));
}

async function fetchUserInfo(){
  const u = auth.currentUser;
  if(!u) return null;
  const snap = await getDoc(doc(db, "users", u.uid));
  return snap.exists()? snap.data(): null;
}

const api = {
  onState: (cb)=> onAuthStateChanged(auth, (user)=> cb({user})),
  signIn: phonePrompt,
  fetchUserInfo
};
window.hgAuth = api;
