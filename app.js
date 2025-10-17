(() => {
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  // Tabs
  $$(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      $$(".tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const target = btn.dataset.target;
      $$(".page").forEach(p => p.classList.remove("visible"));
      $("#" + target).classList.add("visible");
      // keep version badge visible; it's in header
    });
  });

  // Default message
  const message = $("#message");

  // Customer selection
  let selectedRow = null;
  const rows = $$(".customer-list .row");
  rows.forEach(row => {
    row.querySelector(".choose-btn").addEventListener("click", () => {
      if (selectedRow) selectedRow.classList.remove("selected");
      row.classList.add("selected");
      selectedRow = row;
      const name = row.dataset.name || "{name}";
      replaceNameToken(name);
      // Emphasize also the pressed button (via CSS .selected)
    });
  });

  function replaceNameToken(name){
    const val = message.value;
    const newVal = val.replaceAll("{name}", name);
    message.value = newVal;
  }

  // Clipboard helpers
  $("#copy-btn").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(message.value);
      toast("コピーしました");
    } catch (e) {
      alert("コピーに失敗しました");
    }
  });

  $("#share-btn").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(message.value);
      toast("テキストをクリップボードに保存しました。LINEで貼り付けてください。");
    } catch (e) {
      alert("共有に失敗しました");
    }
  });

  // Quota indicators (static initial values as per spec)
  const FREE = 5;
  let reg = 0;
  $("#free-quota").textContent = FREE;
  $("#reg-count").textContent = reg;
  $("#remain-badge").textContent = `残り ${Math.max(FREE - reg, 0)}`;

  // Privacy modal
  const modal = $("#privacy-modal");
  $("#privacy-open").addEventListener("click", () => {
    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");
  });
  $("#privacy-close").addEventListener("click", () => {
    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");
  });
  modal.addEventListener("click", (e) => {
    if(e.target === modal){
      modal.classList.remove("show");
      modal.setAttribute("aria-hidden", "true");
    }
  });

  // Simple toast
  function toast(msg){
    const t = document.createElement("div");
    t.textContent = msg;
    t.style.position = "fixed";
    t.style.left = "50%";
    t.style.top = "16px";
    t.style.transform = "translateX(-50%)";
    t.style.padding = "10px 14px";
    t.style.background = "linear-gradient(90deg,#ff93d3,#ff5fa9)";
    t.style.color = "#fff";
    t.style.borderRadius = "999px";
    t.style.boxShadow = "0 6px 18px rgba(255,95,169,.25)";
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 1500);
  }

  // Ensure version text exists on every view (header)
  // Already present via .version-badge
})();