/* himegoto v1.27β - JST 0:00 リセット対応 / 全入れ替え用 */
(() => {
  // ====== 定数・ストレージ鍵 ======
  const LS_KEY = "hime_state";
  const LIMITS = { sendsPerDay: 5, customers: 5 };

  // ====== JST（Asia/Tokyo）の日付キー YYYY-MM-DD を返す ======
  const jstDateKey = () => {
    // Intlでタイムゾーンを固定してズレを防止（端末のTZ設定に依存しない）
    const fmt = new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
    const parts = fmt.formatToParts(new Date());
    const y = parts.find(p => p.type === "year").value;
    const m = parts.find(p => p.type === "month").value;
    const d = parts.find(p => p.type === "day").value;
    return `${y}-${m}-${d}`;
  };

  // ====== 状態のロード／セーブ ======
  const loadState = () => {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); }
    catch { return {}; }
  };
  const saveState = (s) => localStorage.setItem(LS_KEY, JSON.stringify(s));

  // ====== 初期状態の整備（JST基準） ======
  const ensureTodayState = (prev) => {
    const today = jstDateKey();
    if (!prev || prev.date !== today) {
      return {
        date: today,
        count: 0,                             // 当日の送信回数
        customers: prev?.customers || []      // 顧客は引き継ぐ
      };
    }
    // date一致ならそのまま
    return { date: today, count: prev.count || 0, customers: prev.customers || [] };
  };

  let state = ensureTodayState(loadState());
  saveState(state); // 形式を揃えて保存

  // ====== 要素参照 ======
  const $ = (sel, root = document) => root.querySelector(sel);
  const listEl      = $(".customer-list");
  const addBtn      = $("#add-btn");
  const addInput    = $("#add-input");
  const msgEl       = $("#message");
  const shareBtn    = $("#share-btn");
  const insertBtn   = $("#insert-name");
  const sendBadge   = $("#remain-badge");
  const regBadge    = $("#reg-remain");

  // 選択状態
  let selectedName = null;
  let selectedBtn  = null;

  // ====== 残数関連 ======
  const remainSends    = () => Math.max(0, LIMITS.sendsPerDay - (state.count || 0));
  const remainRegister = () => Math.max(0, LIMITS.customers - (state.customers?.length || 0));

  const renderBadges = () => {
    if (sendBadge) sendBadge.textContent = `残り ${remainSends()} 回`;
    if (regBadge)  regBadge.textContent  = `登録残り ${remainRegister()} 名`;
    if (shareBtn) {
      const exhausted = remainSends() <= 0;
      shareBtn.disabled = exhausted;
      shareBtn.textContent = exhausted ? "上限到達" : "共有";
    }
  };

  // ====== 顧客リスト描画 ======
  const renderList = () => {
    if (!listEl) return;
    listEl.innerHTML = "";
    (state.customers || []).forEach((name) => {
      const row = document.createElement("div");
      row.className = "row";
      row.dataset.name = name;

      const nameSpan = document.createElement("span");
      nameSpan.textContent = name;

      const actions = document.createElement("div");
      actions.className = "row-actions";

      const choose = document.createElement("button");
      const isActive = selectedName === name;
      choose.className = `choose-btn ${isActive ? "choose-btn--active" : ""}`;
      choose.textContent = isActive ? "選択中" : "選択";
      choose.addEventListener("click", () => {
        // 既存の選択ボタンを戻す
        if (selectedBtn && selectedBtn !== choose) {
          selectedBtn.classList.remove("choose-btn--active");
          selectedBtn.textContent = "選択";
        }
        // 新しい選択
        selectedBtn = choose;
        selectedName = name;
        choose.classList.add("choose-btn--active");
        choose.textContent = "選択中";
      });

      const del = document.createElement("button");
      del.className = "del-btn";
      del.textContent = "削除";
      del.addEventListener("click", () => {
        const i = state.customers.indexOf(name);
        if (i >= 0) state.customers.splice(i, 1);
        if (selectedName === name) { selectedName = null; selectedBtn = null; }
        saveState(state);
        renderList();
        renderBadges();
      });

      actions.appendChild(choose);
      actions.appendChild(del);
      row.appendChild(nameSpan);
      row.appendChild(actions);
      listEl.appendChild(row);
    });
  };

  // ====== 顧客追加 ======
  addBtn?.addEventListener("click", () => {
    const name = (addInput?.value || "").trim();
    if (!name) return;
    const arr = state.customers || [];
    if (arr.length >= LIMITS.customers) { alert("無料版では顧客登録は5名までです。"); return; }
    if (arr.includes(name)) { alert("同じ名前が既に登録されています。"); return; }
    arr.push(name);
    state.customers = arr;
    addInput.value = "";
    saveState(state);
    renderList();
    renderBadges();
  });

  // ====== {name} 挿入（本文は常にユーザーが見る内容を保持。置換は共有時のみ） ======
  insertBtn?.addEventListener("click", () => {
    if (!msgEl) return;
    const tag = "{name}";
    const start = msgEl.selectionStart ?? msgEl.value.length;
    const end   = msgEl.selectionEnd   ?? msgEl.value.length;
    const before = msgEl.value.slice(0, start);
    const after  = msgEl.value.slice(end);
    msgEl.value = before + tag + after;
    msgEl.focus();
    const pos = start + tag.length;
    msgEl.setSelectionRange?.(pos, pos);
  });

  // ====== 共有処理（Web Share APIのみ／未対応はアラート） ======
  const buildShareText = () => {
    // デフォ文自体は変更しない。共有テキスト生成時のみ{name}→選択名に置換。
    const base = msgEl?.value || "";
    return selectedName ? base.replaceAll("{name}", selectedName) : base;
  };

  shareBtn?.addEventListener("click", async () => {
    // 当日チェック＆0:00跨ぎ対応（JST）
    const today = jstDateKey();
    if (state.date !== today) {
      state.date = today;
      state.count = 0;
      saveState(state);
      renderBadges();
    }

    if (remainSends() <= 0) { alert("無料版の送信上限（1日5回）に達しました。"); return; }
    if (!selectedName)     { alert("顧客を選択してください。"); return; }

    const text = buildShareText();

    try {
      if (navigator.share) {
        await navigator.share({ text });
        // 成功時のみカウント増加（キャンセルはAbortErrorでrejectされる）
        state.count = (state.count || 0) + 1;
        saveState(state);
        renderBadges();
      } else {
        // 共有に非対応：コピーは行わない（仕様）
        alert("この端末・ブラウザは共有に対応していません。対応ブラウザ（例：Chrome）をご利用ください。");
      }
    } catch (e) {
      // キャンセルや失敗時はカウント増やさない
      // console.debug("share cancelled/failed", e);
    }
  });

  // ====== 深夜0:00（JST）またぎの自動検知（1分ごと） ======
  setInterval(() => {
    const today = jstDateKey();
    if (state.date !== today) {
      state.date = today;
      state.count = 0;
      saveState(state);
      renderBadges();
    }
  }, 60 * 1000);

  // ====== 初期描画 ======
  renderList();
  renderBadges();
})();
