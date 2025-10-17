(() => {
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  const message = $("#message");
  let selectedBtn = null;
  let selectedName = null;

  // Customer selection
  const rows = $$(".customer-list .row");
  rows.forEach(row => {
    const btn = row.querySelector(".choose-btn");
    if(!btn) return;
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

  // LINE share: open LINE with prefilled text; textarea is never mutated
  function buildMessage(){
    const src = message ? message.value : "";
    return selectedName ? src.replaceAll("{name}", selectedName) : src;
  }

  const shareBtn = $("#share-btn");
  if (shareBtn){
    shareBtn.textContent = "LINEで共有";
    shareBtn.addEventListener("click", () => {
      const text = buildMessage();
      const url = "https://line.me/R/msg/text/?" + encodeURIComponent(text);
      // Open LINE (will fall back to web if app not available)
      window.location.href = url;
    });
  }

  // Optional: copy button (kept for desktop fallback)
  const copyBtn = $("#copy-btn");
  if (copyBtn){
    copyBtn.addEventListener("click", async () => {
      try{
        await navigator.clipboard.writeText(buildMessage());
        toast("コピーしました");
      }catch(e){ alert("コピーに失敗しました"); }
    });
  }

  // Toast
  function toast(msg){
    const t = document.createElement("div");
    t.textContent = msg;
    t.style.position = "fixed"; t.style.left = "50%"; t.style.top = "16px"; t.style.transform = "translateX(-50%)";
    t.style.padding = "10px 14px"; t.style.background = "linear-gradient(90deg,#ff93d3,#ff5fa9)";
    t.style.color = "#fff"; t.style.borderRadius = "999px"; t.style.boxShadow = "0 6px 18px rgba(255,95,169,.25)";
    document.body.appendChild(t); setTimeout(() => t.remove(), 1500);
  }
})();