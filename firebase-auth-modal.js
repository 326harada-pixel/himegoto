// firebase-auth-modal.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyD-gLP5rIErs678UewraA0vt59JbLZpzhU",
  authDomain: "himegoto-web.firebaseapp.com",
  projectId: "himegoto-web",
  storageBucket: "himegoto-web.firebasestorage.app",
  messagingSenderId: "368382081243",
  appId: "1:368382081243:web:09e3827701cbc6d1d2f4fe"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// styles
const style = document.createElement("style");
style.textContent = `
  .hg-auth-fab{position:fixed;right:16px;bottom:16px;z-index:2147483647;border:none;border-radius:9999px;padding:12px 16px;background:#111;color:#fff;font-weight:600;box-shadow:0 6px 20px rgba(0,0,0,.2);}
  .hg-auth-fab.hide{display:none;}
  .hg-auth-modal{position:fixed;inset:0;background:rgba(0,0,0,.4);display:none;align-items:center;justify-content:center;z-index:2147483646;}
  .hg-auth-modal.open{display:flex;}
  .hg-auth-card{width:min(420px,90vw);background:#fff;border-radius:16px;padding:20px;box-shadow:0 10px 30px rgba(0,0,0,.25);font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;}
  .hg-auth-card h3{margin:0 0 12px;font-size:18px}
  .hg-auth-input{width:100%;padding:12px 14px;border:1px solid #ddd;border-radius:10px;font-size:16px;margin:8px 0}
  .hg-auth-btn{width:100%;padding:12px;border:none;border-radius:10px;background:#111;color:#fff;font-weight:700;margin-top:8px}
  .hg-auth-note{font-size:12px;color:#666;margin-top:6px}
`;
document.head.appendChild(style);

// floating button
const fab = document.createElement("button");
fab.className = "hg-auth-fab";
fab.textContent = "ログイン";
document.addEventListener("DOMContentLoaded", () => document.body.appendChild(fab));

// modal
const modal = document.createElement("div");
modal.className = "hg-auth-modal";
modal.innerHTML = `
  <div class="hg-auth-card">
    <h3>電話番号でログイン</h3>
    <input id="hg-phone" class="hg-auth-input" type="tel" placeholder="+819012345678" inputmode="tel" />
    <div id="hg-recaptcha"></div>
    <button id="hg-send" class="hg-auth-btn">認証コードを送信</button>
    <div id="hg-code-area" style="display:none">
      <input id="hg-code" class="hg-auth-input" type="text" placeholder="6桁の認証コード" inputmode="numeric" />
      <button id="hg-verify" class="hg-auth-btn">認証してログイン</button>
    </div>
    <div class="hg-auth-note">※ テスト番号はFirebaseコンソールで設定した番号＋確認コードを使用</div>
  </div>
`;
document.addEventListener("DOMContentLoaded", () => document.body.appendChild(modal));

document.addEventListener("click", (e)=>{
  if(e.target === fab){ modal.classList.add("open"); }
  if(e.target === modal){ modal.classList.remove("open"); }
});

let confirmationResult = null;

onAuthStateChanged(auth, (user)=>{
  if(user){ fab.classList.add("hide"); }
});

const recaptchaReady = new Promise(resolve=>{
  document.addEventListener("DOMContentLoaded", ()=>{
    const verifier = new RecaptchaVerifier(auth, "hg-recaptcha", { size:"invisible" });
    resolve(verifier);
  });
});

document.addEventListener("DOMContentLoaded", ()=>{
  document.getElementById("hg-send").addEventListener("click", async ()=>{
    const phone = (document.getElementById("hg-phone").value || "").trim();
    try{
      const appVerifier = await recaptchaReady;
      confirmationResult = await signInWithPhoneNumber(auth, phone, appVerifier);
      document.getElementById("hg-code-area").style.display = "block";
      alert("認証コードを送信しました");
    }catch(err){
      alert("送信エラー: " + err.message);
    }
  });

  document.getElementById("hg-verify").addEventListener("click", async ()=>{
    const code = (document.getElementById("hg-code").value || "").trim();
    try{
      const result = await confirmationResult.confirm(code);
      modal.classList.remove("open");
      fab.classList.add("hide");
      alert("ログイン成功: " + (result.user.phoneNumber ?? ""));
    }catch(err){
      alert("認証失敗: " + err.message);
    }
  });
});