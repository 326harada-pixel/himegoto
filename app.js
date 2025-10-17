(() => {
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  // --- Daily send limit (5/day) ---
  const MAX_SEND = 5;
  const todayKey = new Date().toISOString().slice(0,10); // YYYY-MM-DD
  const stateRaw = localStorage.getItem("hime_send_state");
  let state = { date: todayKey, count: 0 };
  if (stateRaw) {
    try { state = JSON.parse(stateRaw) || state; } catch { state = { date: todayKey, count: 0 }; }
  }
  if (state.date !== todayKey) state = { date: todayKey, count: 0 };
  function save() { localStorage.setItem("hime_send_state", JSON.stringify(state)); }
  const remain = () => Math.max(0, MAX_SEND - state.count);

  const message = $("#message");
  let selectedBtn = null;
  let selectedName = null;

  // Customer selection
  $$('.customer-list .row').forEach(row => {
    const btn = row.querySelector('.choose-btn');
    if(!btn) return;
    btn.textContent = '選択';
    btn.addEventListener('click', () => {
      if (selectedBtn && selectedBtn !== btn) {
        selectedBtn.classList.remove('choose-btn--active');
        selectedBtn.textContent = '選択';
      }
      btn.classList.add('choose-btn--active');
      btn.textContent = '選択中';
      selectedBtn = btn;
      selectedName = row.dataset.name || '{name}';
    });
  });

  // Insert {name}
  const insertBtn = $("#insert-name");
  if (insertBtn && message) {
    insertBtn.addEventListener("click", () => {
      const start = message.selectionStart ?? message.value.length;
      const end = message.selectionEnd ?? message.value.length;
      const before = message.value.slice(0, start);
      const after = message.value.slice(end);
      message.value = before + "{name}" + after;
      message.focus();
      message.selectionStart = message.selectionEnd = start + "{name}".length;
    });
  }

  // Build outgoing message (textarea itself is never mutated)
  function buildMessage() {
    const src = message ? message.value : "";
    return selectedName ? src.replaceAll("{name}", selectedName) : src;
  }

  // Quota UI
  const badge = $("#remain-badge");
  const free = $("#free-quota");
  const reg = $("#reg-count");
  const shareBtn = $("#share-btn");
  function updateQuotaUI() {
    if (badge) badge.textContent = `残り送信 ${remain()} 回`;
    if (free) free.textContent = MAX_SEND;
    if (reg) reg.textContent = 0;
    if (shareBtn) {
      shareBtn.disabled = remain() <= 0;
      shareBtn.textContent = remain() <= 0 ? "上限に達しました" : "LINEで共有";
    }
  }
  updateQuotaUI();

  // LINE deep link (no clipboard)
  if (shareBtn) {
    shareBtn.addEventListener("click", () => {
      if (remain() <= 0) {
        alert("無料版の1日あたりの送信上限（5回）に達しました。");
        return;
      }
      const text = buildMessage();
      state.count = Math.min(MAX_SEND, state.count + 1);
      save();
      updateQuotaUI();
      const url = "https://line.me/R/msg/text/?" + encodeURIComponent(text);
      window.location.href = url;
    });
  }

})();