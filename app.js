/* himegoto app.js v1.27b-JST-reset */
/* 仕様
  - 無料版の送信上限: 1日5回（JSTで0:00リセット）
  - 顧客登録上限: 5名
  - 共有ボタン: 共有パネルを開いた時点で1回消費（キャンセルでも減算）
*/

(() => {
  // ---------- DOMヘルパ ----------
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // ---------- 定数 ----------
  const MAX_SEND = 5;
  const MAX_CUSTOMERS = 5;
  const LS_KEY = "hime_state";

  // JSTの "YYYY-MM-DD" を返す
  const todayJST = () => {
    const z = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
    const d = new Date(z); // ローカルパースでOK（上の時刻はJST）
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  // 次のJST深夜0時までのミリ秒
  const msUntilNextJSTMidnight = () => {
    const z = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
    const d = new Date(z);
    const next = new Date(d.getTime());
    next.setHours(24, 0, 0, 0); // JST日内の24:00
    return next - d;
  };

  // ---------- 状態 ----------
  const load = () => {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); }
    catch { return {}; }
  };
  const save = (s) => localStorage.setItem(LS_KEY, JSON.stringify(s));

  const today = todayJST();
  let state = load();
  if (state.date !== today) {
    state = { date: today, count: 0, customers: state.customers || [] };
    save(state);
  } else {
    // 安全フィールド
    state.count = state.count ?? 0;
    state.customers = state.customers ?? [];
  }

  // ---------- 要素 ----------
  const listEl = $(".customer-list");
  const addBtn = $("#add-btn");
  const addInput = $("#add-input");
  const msgEl = $("#message");
  const shareBtn = $("#share-btn");
  const insertBtn = $("#insert-name");
  const sendBadge = $("#remain-badge");
  const regBadge = $("#reg-remain");

  // ---------- 選択中の顧客 ----------
  let selectedName = null;
  let selectedBtn = null;

  // ---------- 表示更新 ----------
  const remainSend = () => Math.max(0, MAX_SEND - (state.count || 0));
  const remainReg  = () => Math.max(0, MAX_CUSTOMERS - (state.customers?.length || 0));

  const updateBadges = () => {
    if (sendBadge) sendBadge.textContent = `残り ${remainSend()} 回`;
    if (regBadge)  regBadge.textContent  = `登録残り ${remainReg()} 名`;
    if (shareBtn) {
      const over = remainSend() <= 0;
      shareBtn.disabled = over;
      shareBtn.textContent = over ? "上限到達" : "共有";
    }
  };

  const renderList = () => {
    listEl.innerHTML = "";
    (state.customers || []).forEach((name) => {
      const row = document.createElement("div");
      row.className = "row";
      row.dataset.name = name;
      row.innerHTML = `
        <span>${name}</span>
        <div class="row-actions">
          <button class="choose-btn">選択</button>
          <button class="del-btn">削除</button>
        </div>
      `;
      const choose = row.querySelector(".choose-btn");
      const del = row.querySelector(".del-btn");

      choose.addEventListener("click", () => {
        if (selectedBtn && selectedBtn !== choose) {
          selectedBtn.classList.remove("choose-btn--active");
          selectedBtn.textContent = "選択";
        }
        choose.classList.add("choose-btn--active");
        choose.textContent = "選択中";
        selectedBtn = choose;
        selectedName = name;
      });

      del.addEventListener("click", () => {
        const i = state.customers.indexOf(name);
        if (i >= 0) state.customers.splice(i, 1);
        if (selectedName === name) { selectedName = null; selectedBtn = null; }
        save(state);
        renderList();
        updateBadges();
      });

      listEl.appendChild(row);
    });
  };

  // ---------- 動作 ----------
  addBtn?.addEventListener("click", () => {
    const name = (addInput?.value || "").trim();
    if (!name) return;
    if ((state.customers || []).length >= MAX_CUSTOMERS) {
      alert("無料版では顧客登録は5名までです。");
      return;
    }
    if (state.customers.includes(name)) {
      alert("同じ名前がすでに登録されています。");
      return;
    }
    state.customers.push(name);
    addInput.value = "";
    save(state);
    renderList();
    updateBadges();
  });

  insertBtn?.addEventListener("click", () => {
    const start = msgEl.selectionStart ?? msgEl.value.length;
    const end = msgEl.selectionEnd ?? msgEl.value.length;
    const before = msgEl.value.slice(0, start);
    const after  = msgEl.value.slice(end);
    msgEl.value = before + "{name}" + after;
    msgEl.focus();
    const pos = start + "{name}".length;
    msgEl.selectionStart = msgEl.selectionEnd = pos;
  });

  const buildMessage = () =>
    selectedName ? msgEl.value.replaceAll("{name}", selectedName) : msgEl.value;

  const openShare = async (text) => {
    // 共有パネル／LINE遷移を開く前にカウント消費（キャンセルでも減らす仕様）
    state.count = (state.count || 0) + 1;
    save(state);
    updateBadges();

    try {
      if (navigator.share) {
        await navigator.share({ text });
      } else {
        // LINE 共有URL（テキストのみ）
        location.href = "https://line.me/R/msg/text/?" + encodeURIComponent(text);
      }
    } catch (e) {
      // キャンセルや例外でもカウントは戻さない（コピー回避不可のため）
      console.log("share error:", e);
    }
  };

  shareBtn?.addEventListener("click", async () => {
    if (remainSend() <= 0) {
      alert("無料版の送信上限（5回）に達しました。");
      return;
    }
    const text = buildMessage();
    await openShare(text);
  });

  // ---------- 日跨ぎ自動リセット（JST） ----------
  const armMidnightReset = () => {
    const ms = msUntilNextJSTMidnight();
    setTimeout(() => {
      state.date = todayJST();
      state.count = 0;
      save(state);
      updateBadges();
      // 次の日もスケジュール
      armMidnightReset();
    }, ms + 250); // ゆとり
  };

  // 初期描画
  renderList();
  updateBadges();
  armMidnightReset();
})();
