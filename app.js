/* ver.1.20 app logic (no code/recalc UI; login -> auto plan) */
const $ = (q)=>document.querySelector(q);
const LS = {
  customers:"hg_customers",
  freeAddLeft:"hg_free_add_left",
  sendLeft:"hg_send_left",
  selected:"hg_selected_name"
};
function load(key, fallback){ try{ return JSON.parse(localStorage.getItem(key)) ?? fallback }catch{ return fallback } }
function save(key, v){ localStorage.setItem(key, JSON.stringify(v)) }

// init quotas
if(localStorage.getItem(LS.freeAddLeft)===null) save(LS.freeAddLeft,5);
if(localStorage.getItem(LS.sendLeft)===null) save(LS.sendLeft,5);
let customers = load(LS.customers, []);

function renderList(){
  const wrap = $("#customer-list");
  wrap.innerHTML = "";
  customers.forEach((n,i)=>{
    const row = document.createElement("div");
    row.className = "item";
    row.innerHTML = \`
      <div>\${n}</div>
      <div class="row">
        <button class="btn btn-ghost" data-pick="\${i}">選ぶ</button>
        <button class="btn btn-pink" data-del="\${i}">削除</button>
      </div>\`;
    wrap.appendChild(row);
  });
}
renderList();

$("#free-left").textContent = load(LS.freeAddLeft,5);
$("#send-left").textContent = load(LS.sendLeft,5);

document.addEventListener("click", (e)=>{
  const t = e.target;
  if(t.dataset.pick!=null){
    const name = customers[Number(t.dataset.pick)];
    const ta = $("#msg-template");
    ta.value = ta.value.replaceAll("{name}", name);
    save(LS.selected, name);
  }
  if(t.dataset.del!=null){
    customers.splice(Number(t.dataset.del),1);
    save(LS.customers, customers);
    renderList();
  }
});

$("#btn-add").addEventListener("click", ()=>{
  const name = $("#name-input").value.trim();
  if(!name) return;
  let left = load(LS.freeAddLeft,5);
  if(left<=0){ alert("無料枠は上限です。有料プランで無制限に。"); return }
  customers.push(name);
  save(LS.customers, customers);
  $("#name-input").value="";
  save(LS.freeAddLeft, --left);
  $("#free-left").textContent = left;
  renderList();
});

$("#btn-insert-name").addEventListener("click", ()=>{
  const name = load(LS.selected, "");
  if(!name){ alert("先に顧客一覧から『選ぶ』を押してね"); return }
  const ta = $("#msg-template");
  const pos = ta.selectionStart ?? ta.value.length;
  ta.setRangeText("{name}", pos, pos, "end");
  ta.focus();
});

$("#btn-share").addEventListener("click", async ()=>{
  let left = load(LS.sendLeft,5);
  if(left<=0){ alert("無料の送信回数が上限です。有料プランで無制限に。"); return }
  const text = $("#msg-template").value.trim();
  try{
    if(navigator.share){
      await navigator.share({text});
    }else{
      await navigator.clipboard.writeText(text);
      alert("本文をコピーしました。LINEで貼り付けて使ってください。");
    }
    save(LS.sendLeft, --left);
    $("#send-left").textContent = left;
  }catch(e){ /* cancelled */ }
});

// ---------- Firebase integration (lightweight) ----------
// This file expects firebase-auth-modal.js to expose a minimal API on window.hgAuth:
// hgAuth.onState(cb), hgAuth.signIn()
const planBadge = $("#plan-badge");
const expiryText = $("#expiry-text");
const refText = $("#ref-text");
const loginBtn = $("#btn-login");

if(window.hgAuth && typeof window.hgAuth.onState === "function"){
  window.hgAuth.onState(async (state)=>{
    if(!state || !state.user){
      planBadge.textContent = "無料プラン";
      planBadge.classList.remove("badge-pro");
      expiryText.textContent = "期限：ー";
      refText.textContent   = "紹介 0 / 3";
      loginBtn.classList.remove("hidden");
      return;
    }
    loginBtn.classList.add("hidden");
    // read lightweight Firestore doc: users/{uid} -> { plan, expiry, referrals }
    try{
      const info = await window.hgAuth.fetchUserInfo();
      const plan = info?.plan || "free";
      if(plan === "pro"){
        planBadge.textContent = "有料プラン";
        planBadge.classList.add("badge-pro");
      }else{
        planBadge.textContent = "無料プラン";
        planBadge.classList.remove("badge-pro");
      }
      expiryText.textContent = "期限：" + (info?.expiry || "ー");
      const used = Number(info?.referrals||0)%3;
      refText.textContent = `紹介 ${used} / 3`;
    }catch(e){
      console.warn(e);
    }
  });
}
loginBtn?.addEventListener("click", ()=> window.hgAuth?.signIn());
