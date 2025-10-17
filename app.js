(() => {
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  const MAX_SEND = 5;
  const MAX_CUSTOMERS = 5;
  const todayKey = new Date().toISOString().slice(0,10);

  // Load state
  let state = JSON.parse(localStorage.getItem("hime_state") || "{}");
  if (state.date !== todayKey) state = { date: todayKey, count: 0, customers: state.customers || [] };
  state.date = todayKey;
  const save = () => localStorage.setItem("hime_state", JSON.stringify(state));
  const remainSend = () => Math.max(0, MAX_SEND - (state.count||0));
  const remainReg = () => Math.max(0, MAX_CUSTOMERS - (state.customers?.length || 0));

  // Elements
  const list = $(".customer-list");
  const addBtn = $("#add-btn");
  const addInput = $("#add-input");
  const message = $("#message");
  const shareBtn = $("#share-btn");
  const insertBtn = $("#insert-name");
  const sendBadge = $("#remain-badge");
  const regBadge = $("#reg-remain");

  let selectedName = null, selectedBtn = null;

  function renderList(){
    list.innerHTML = "";
    (state.customers||[]).forEach((name) => {
      const row = document.createElement("div");
      row.className = "row";
      row.dataset.name = name;
      row.innerHTML = `<span>${name}</span><button class="choose-btn">選択</button>`;
      const btn = row.querySelector("button");
      btn.addEventListener("click", () => {
        if (selectedBtn && selectedBtn !== btn){selectedBtn.classList.remove("choose-btn--active");selectedBtn.textContent="選択";}
        btn.classList.add("choose-btn--active");btn.textContent="選択中";
        selectedBtn = btn;selectedName = name;
      });
      list.appendChild(row);
    });
  }

  function updateBadges(){
    if (sendBadge) sendBadge.textContent = `残り ${remainSend()} 回`;
    if (regBadge)  regBadge.textContent  = `登録残り ${remainReg()} 名`;
    if (shareBtn){
      shareBtn.disabled = remainSend()<=0;
      if (remainSend()<=0) shareBtn.textContent="上限到達"; else shareBtn.textContent="共有";
    }
  }

  addBtn?.addEventListener("click", () => {
    const name = (addInput?.value||"").trim();
    if (!name) return;
    if ((state.customers||[]).length >= MAX_CUSTOMERS){ alert("無料版では顧客登録は5名までです。"); return; }
    if (state.customers.includes(name)){ alert("同じ名前がすでに登録されています。"); return; }
    state.customers.push(name); addInput.value=""; save(); renderList(); updateBadges();
  });

  insertBtn?.addEventListener("click", () => {
    const start = message.selectionStart ?? message.value.length;
    const end = message.selectionEnd ?? message.value.length;
    const before = message.value.slice(0, start);
    const after = message.value.slice(end);
    message.value = before + "{name}" + after;
    message.focus();
    message.selectionStart = message.selectionEnd = start + "{name}".length;
  });

  function buildMessage(){
    return selectedName ? message.value.replaceAll("{name}", selectedName) : message.value;
  }

  shareBtn?.addEventListener("click", async () => {
    if (remainSend()<=0){ alert("無料版の送信上限（5回）に達しました。"); return; }
    const text = buildMessage();
    state.count = (state.count||0)+1; save(); updateBadges();
    try{
      if (navigator.share){
        await navigator.share({ text });
      } else {
        location.href = "https://line.me/R/msg/text/?" + encodeURIComponent(text);
      }
    }catch(e){ console.log(e); }
  });

  renderList();
  updateBadges();
})();