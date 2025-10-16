// firebase-auth-modal.js  (build007 - phone auth)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const cfg = (window.HIMEGOTO_FIREBASE_CONFIG) ?? {
  apiKey: "<YOUR_API_KEY>",
  authDomain: "<YOUR_PROJECT_ID>.firebaseapp.com",
  projectId: "<YOUR_PROJECT_ID>",
  storageBucket: "<YOUR_PROJECT_ID>.appspot.com",
  messagingSenderId: "<YOUR_SENDER_ID>",
  appId: "<YOUR_APP_ID>"
};

const app = initializeApp(cfg);
const auth = getAuth(app);

function $(sel, root=document){ return root.querySelector(sel); }
function findLoginButton(){
  return $("#btn-login") || Array.from(document.querySelectorAll("button, a[role='button']"))
    .find(el => (el.textContent||"").trim().includes("ログイン"));
}
function ensureRecaptchaContainer(){
  let el = $("#recaptcha-container");
  if(!el){
    el = document.createElement("div");
    el.id = "recaptcha-container";
    el.style.position="fixed";
    el.style.bottom="8px";
    el.style.right="8px";
    el.style.zIndex=2147483647;
    document.body.appendChild(el);
  }
  return el;
}
let recaptchaVerifier=null;
function buildRecaptcha(){
  ensureRecaptchaContainer();
  recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", { size:"invisible" });
  return recaptchaVerifier;
}

async function doPhoneLogin(){
  try{
    const phone = window.prompt("電話番号（+81...）を入力してください");
    if(!phone) return;
    if(!recaptchaVerifier) buildRecaptcha();
    const confirmation = await signInWithPhoneNumber(auth, phone, recaptchaVerifier);
    const code = window.prompt("SMSの6桁コードを入力してください");
    if(!code) return;
    await confirmation.confirm(code);
    const user = auth.currentUser;
    window.dispatchEvent(new CustomEvent("hime:login:success", { detail:{ user } }));
  }catch(err){
    console.error("[himegoto] phone auth error:", err);
    alert("ログインに失敗しました: " + (err?.message||err));
    recaptchaVerifier=null;
  }
}
async function doLogout(){
  try{
    await signOut(auth);
    window.dispatchEvent(new CustomEvent("hime:logout"));
  }catch(e){ console.error(e); }
}

function wireButtons(){
  const loginBtn = findLoginButton();
  if(loginBtn && !loginBtn.dataset._himeWired){
    loginBtn.addEventListener("click", (e)=>{ e.preventDefault(); doPhoneLogin(); });
    loginBtn.dataset._himeWired="1";
  }
  const logoutBtn = $("#btn-logout");
  if(logoutBtn && !logoutBtn.dataset._himeWired){
    logoutBtn.addEventListener("click", (e)=>{ e.preventDefault(); doLogout(); });
    logoutBtn.dataset._himeWired="1";
  }
}

onAuthStateChanged(auth, (user)=>{
  document.documentElement.dataset.auth = user ? "on" : "off";
});

window.himeLogin = doPhoneLogin;
window.himeLogout = doLogout;

if(document.readyState==="loading"){
  document.addEventListener("DOMContentLoaded", wireButtons);
}else{
  wireButtons();
}