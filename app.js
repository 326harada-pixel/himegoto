(() => {
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  // Customer selection state (shared behavior for pages that have it)
  const message = $("#message");
  let selectedBtn = null;
  let selectedName = null;
  const rows = $$(".customer-list .row");
  rows.forEach(row => {
    const btn = row.querySelector(".choose-btn");
    if (!btn) return;
    btn.textContent = "選択";
    btn.addEventListener("click", () => {
      if (selectedBtn && selectedBtn !== btn) {
        selectedBtn.classList.remove("choose-btn--active");
        selectedBtn.textContent = "選択";
      }
      btn.classList.add("choose-btn--active");
      btn.textContent = "選択中";
      selectedBtn = btn;
      selectedName = row.dataset.name || "{name}";
    });
  });

  // Copy/Share (replace token only at action time)
  const write = async () => {
    const src = message ? message.value : "";
    const out = selectedName ? src.replaceAll("{name}", selectedName) : src;
    await navigator.clipboard.writeText(out);
  };
  const copyBtn = $("#copy-btn");
  const shareBtn = $("#share-btn");
  if (copyBtn) copyBtn.addEventListener("click", async () => { try { await write(); toast("コピーしました"); } catch(e){ alert("コピーに失敗しました"); } });
  if (shareBtn) shareBtn.addEventListener("click", async () => { try { await write(); toast("クリップボードに保存しました。LINEで貼り付けてください。"); } catch(e){ alert("共有に失敗しました"); } });

  // Privacy modal (if exists)
  const modal = $("#privacy-modal");
  const openBtn = $("#privacy-open");
  const closeBtn = $("#privacy-close");
  if (modal && openBtn && closeBtn){
    openBtn.addEventListener("click", () => { modal.classList.add("show"); modal.setAttribute("aria-hidden","false"); });
    closeBtn.addEventListener("click", () => { modal.classList.remove("show"); modal.setAttribute("aria-hidden","true"); });
    modal.addEventListener("click", (e)=>{ if(e.target===modal){ modal.classList.remove("show"); modal.setAttribute("aria-hidden","true"); } });
  }

  // Simple toast
  function toast(msg){
    const t = document.createElement("div");
    t.textContent = msg;
    t.style.position = "fixed"; t.style.left = "50%"; t.style.top = "16px"; t.style.transform = "translateX(-50%)";
    t.style.padding = "10px 14px"; t.style.background = "linear-gradient(90deg,#ff93d3,#ff5fa9)";
    t.style.color = "#fff"; t.style.borderRadius = "999px"; t.style.boxShadow = "0 6px 18px rgba(255,95,169,.25)";
    document.body.appendChild(t); setTimeout(() => t.remove(), 1500);
  }
})();