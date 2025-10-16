
// Simple client-side state using localStorage
const $ = (s)=>document.querySelector(s);

const STORAGE = {
  NAMES: "hime:names",
  SEND_LEFT: "hime:sendleft",
  FREE_LEFT: "hime:freeleft",
  TEMPLATE: "hime:template",
  VERSION: "hime:version"
};

function load(key, fallback){
  try{ return JSON.parse(localStorage.getItem(key)) ?? fallback } catch(e){ return fallback }
}
function save(key, val){ localStorage.setItem(key, JSON.stringify(val)) }

function renderNames(){
  const names = load(STORAGE.NAMES, []);
  const list = $("#customer-list");
  if(!list) return;
  list.innerHTML = "";
  names.forEach((n, idx)=>{
    const el = document.createElement("div");
    el.className = "item";
    el.innerHTML = `<div class="name">${n}</div>
    <div class="actions">
      <button class="btn btn-ghost" data-choose="${idx}">選ぶ</button>
      <button class="btn btn-danger" data-del="${idx}">削除</button>
    </div>`;
    list.appendChild(el);
  });
}

function insertName(){
  const textarea = $("#msg-template");
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;
  textarea.value = text.slice(0,start) + "{name}" + text.slice(end);
  textarea.focus();
  textarea.selectionStart = textarea.selectionEnd = start + "{name}".length;
  save(STORAGE.TEMPLATE, textarea.value);
}

function chooseName(idx){
  const names = load(STORAGE.NAMES, []);
  const name = names[idx] || "";
  const textarea = $("#msg-template");
  if(!name || !textarea) return;
  textarea.value = textarea.value.replaceAll("{name}", name);
  save(STORAGE.TEMPLATE, textarea.value);
}

function share(){
  const left = load(STORAGE.SEND_LEFT, 5);
  if(left <= 0){
    alert("無料版の送信上限に達しました");
    return;
  }
  const text = $("#msg-template").value || "";
  if(navigator.share){
    navigator.share({ text }).catch(()=>{});
  }else{
    navigator.clipboard.writeText(text).then(()=>{
      alert("本文をコピーしました。LINEに貼り付けて送信してください。");
    });
  }
  save(STORAGE.SEND_LEFT, left-1);
  updateCounts();
}

function updateCounts(){
  const freeLeft = load(STORAGE.FREE_LEFT, 5);
  const sendLeft = load(STORAGE.SEND_LEFT, 5);
  $("#free-left") && ($("#free-left").textContent = freeLeft);
  $("#send-left") && ($("#send-left").textContent = sendLeft);
}

function addName(){
  const input = $("#name-input");
  const v = (input.value||"").trim();
  if(!v) return;
  const names = load(STORAGE.NAMES, []);
  const freeLeft = load(STORAGE.FREE_LEFT, 5);
  if(names.length >= 5 && freeLeft <= 0){
    alert("無料枠に達しました（上限5件）。有料版で無制限に。");
    return;
  }
  names.push(v);
  save(STORAGE.NAMES, names);
  if(names.length <= 5){
    save(STORAGE.FREE_LEFT, Math.max(freeLeft-1,0));
  }
  input.value="";
  renderNames(); updateCounts();
}

function delName(idx){
  const names = load(STORAGE.NAMES, []);
  names.splice(idx,1);
  save(STORAGE.NAMES, names);
  renderNames();
}

function recalc(){
  // dummy recalc
  alert("残日数を再計算しました（ダミー）。");
}

function verify(){
  alert("コード認証を実行しました（ダミー）。");
}

function init(){
  renderNames(); updateCounts();
  const saved = load(STORAGE.TEMPLATE, null);
  if(saved && $("#msg-template")) $("#msg-template").value = saved;

  document.body.addEventListener("click", (e)=>{
    const t = e.target;
    if(t.id==="btn-insert-name") insertName();
    if(t.id==="btn-share") share();
    if(t.id==="btn-add") addName();
    if(t.id==="btn-recalc") recalc();
    if(t.id==="btn-verify-code") verify();

    if(t.dataset && t.dataset.choose!==undefined) chooseName(Number(t.dataset.choose));
    if(t.dataset && t.dataset.del!==undefined) delName(Number(t.dataset.del));
  });
}
document.addEventListener("DOMContentLoaded", init);
