/* himegoto app core */
(() => {
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];

  const state = {
    customers: JSON.parse(localStorage.getItem('hgt_customers') || '[]'),
    freeLeft: Number(localStorage.getItem('hgt_free_left') || 5),
    sendLeft: Number(localStorage.getItem('hgt_send_left') || 5),
    selected: null
  };

  const renderList = () => {
    const wrap = $("#customer-list");
    wrap.innerHTML = "";
    state.customers.forEach((name, idx) => {
      const row = document.createElement("div");
      row.className = "customer-item";
      row.innerHTML = `<span class="name">${name}</span>
        <span>
          <button class="btn btn-ghost" data-i="${idx}" data-act="pick">選ぶ</button>
          <button class="btn btn-ghost" data-i="${idx}" data-act="del">削除</button>
        </span>`;
      wrap.appendChild(row);
    });
  };

  const save = () => {
    localStorage.setItem('hgt_customers', JSON.stringify(state.customers));
    localStorage.setItem('hgt_free_left', String(state.freeLeft));
    localStorage.setItem('hgt_send_left', String(state.sendLeft));
    $("#free-left").textContent = state.freeLeft;
    $("#send-left").textContent = state.sendLeft;
  };

  const insertName = () => {
    const ta = $("#msg-template");
    const p = ta.selectionStart;
    const name = state.selected || "{name}";
    ta.setRangeText(name, p, p, "end");
    ta.focus();
  };

  const share = async () => {
    if (state.sendLeft <= 0) return alert("無料送信回数を使い切りました。");
    const name = state.selected || "{name}";
    const msg = $("#msg-template").value.replaceAll("{name}", name);
    if (navigator.share) {
      try { await navigator.share({ text: msg }); state.sendLeft--; save(); }
      catch {}
    } else {
      await navigator.clipboard.writeText(msg);
      alert("本文をコピーしました。LINEへ貼り付けてください。");
      state.sendLeft--; save();
    }
  };

  // events
  $("#btn-add").addEventListener("click", () => {
    const v = $("#name-input").value.trim();
    if (!v) return;
    if (state.freeLeft <= 0) return alert("無料枠を使い切りました。");
    state.customers.push(v);
    state.freeLeft--;
    $("#name-input").value = "";
    save(); renderList();
  });

  $("#customer-list").addEventListener("click", (e) => {
    const t = e.target.closest("button"); if (!t) return;
    const i = Number(t.dataset.i);
    if (t.dataset.act === "pick") { state.selected = state.customers[i]; alert(`「${state.selected}」を選択しました。`); }
    if (t.dataset.act === "del") { state.customers.splice(i,1); renderList(); save(); }
  });

  $("#btn-insert-name").addEventListener("click", insertName);
  $("#btn-share").addEventListener("click", share);

  // auth modal
  $("#btn-login").addEventListener("click", async () => {
    if (!window.FIREBASE_CONFIG) { alert("ログインに失敗しました: FIREBASE_CONFIG missing"); return; }
    try {
      await window.hgtAuthModal.startPhoneLogin();
    } catch (e) {
      alert(`ログインに失敗しました: ${e.message || e}`);
    }
  });

  // init
  $("#free-left").textContent = state.freeLeft;
  $("#send-left").textContent = state.sendLeft;
  renderList();
})();
