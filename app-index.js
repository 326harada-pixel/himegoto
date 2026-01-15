// app-index.js（完全修正版 — メッセージ自動保存を最小追記）
// 仕様：{name}はそのまま挿入／共有時のみ選択名に置換
// 無料版：顧客5名まで／送信1日5回（共有ボタン「タップ時」に即減算）
// 残数表示：見出し右「残◯人」「残◯回」／説明文は下段
(function () {
  const $ = (s) => document.querySelector(s);
  const on = (el, ev, fn) => el && el.addEventListener(ev, fn);

  // --- DOM ---
  const lst = $('#customerList');
  const nameI = $('#nameInput');
  const addB = $('#addBtn');

  const msg = $('#messageBox');
  const ins = $('#insertName');
  const rem = $('#remain');
  const share = $('#shareBtn');

  const remainCust = $('#remainCustomers');  // 見出し横「残◯人」
  const remainShare = $('#remainShares');    // 見出し横「残◯回」

  // --- Keys / Limits ---
  const KC = 'hime_customers';
  const KS = 'hime_selected';
  const SEND_KEY = 'hime_send_cnt_v1'; // 送信回数保存キー（既存仕様に合わせる）
  const MAX_CUSTOMERS = 5;
  const MAX_SENDS = 5;

  // --- Premium (Firestore) ---
  // 最小変更：Firestore の plan/proUntil を読める場合だけ無制限にする
  // 参照候補：
  //  - users/{uid}
  //  - users/{uid}/profile/info
  const PREMIUM = { loaded: false, isPro: false, untilMs: 0 };

  function toMs(v) {
    try {
      if (!v) return 0;
      if (typeof v === 'number') return v;
      if (typeof v === 'string') {
        const t = Date.parse(v);
        return Number.isFinite(t) ? t : 0;
      }
      // Firestore Timestamp (compat)
      if (typeof v.toDate === 'function') return v.toDate().getTime();
      if (typeof v.seconds === 'number') return v.seconds * 1000;
    } catch {}
    return 0;
  }

  function setPremiumUI() {
    // 残時間表示
    const dEl = document.getElementById('premiumDays');
    const hEl = document.getElementById('premiumHours');
    const mEl = document.getElementById('premiumMinutes');
    const now = Date.now();
    const left = Math.max(0, (PREMIUM.untilMs || 0) - now);
    const mins = Math.floor(left / 60000);
    const days = Math.floor(mins / (60 * 24));
    const hours = Math.floor((mins - days * 60 * 24) / 60);
    const minutes = Math.max(0, mins - days * 60 * 24 - hours * 60);
    if (dEl) dEl.textContent = String(days);
    if (hEl) hEl.textContent = String(hours);
    if (mEl) mEl.textContent = String(minutes);

    // 上限表示（見出し横）
    if (PREMIUM.isPro) {
      if (remainCust) remainCust.textContent = '上限なし';
      if (remainShare) remainShare.textContent = '送信残り 無制限';
    }
  }

  async function loadPremiumFromFirestore() {
    // firebase が無い場合は何もしない（ローカル保存だけで動く）
    try {
      if (!window.firebase || !firebase.auth || !firebase.firestore) return;
      const auth = firebase.auth();
      const db = firebase.firestore();

      const user = auth.currentUser || await new Promise((resolve) => {
        const off = auth.onAuthStateChanged((u) => {
          try { off && off(); } catch {}
          resolve(u || null);
        });
      });
      if (!user) return;

      // まず users/{uid} を見る
      let plan = '';
      let untilMs = 0;
      try {
        const udoc = await db.collection('users').doc(user.uid).get();
        const d = udoc && udoc.exists ? (udoc.data() || {}) : {};
        plan = String(d.plan || '');
        untilMs = toMs(d.proUntil);
      } catch {}

      // 次に profile/info も見る（上書き）
      try {
        const pdoc = await db.collection('users').doc(user.uid).collection('profile').doc('info').get();
        const d = pdoc && pdoc.exists ? (pdoc.data() || {}) : {};
        if (d.plan != null) plan = String(d.plan || '');
        const ms2 = toMs(d.proUntil);
        if (ms2) untilMs = ms2;
      } catch {}

      PREMIUM.loaded = true;
      PREMIUM.untilMs = untilMs || 0;
      PREMIUM.isPro = (plan === 'pro') && (PREMIUM.untilMs > Date.now());

      // UI と残数を更新
      setPremiumUI();
      updateCustomerRemainUI();
      updateSendRemainUI();
    } catch {}
  }

  // --- State I/O ---
  function load() {
    try {
      return {
        list: JSON.parse(localStorage.getItem(KC) || '[]'),
        sel: JSON.parse(localStorage.getItem(KS) || 'null'),
      };
    } catch {
      return { list: [], sel: null };
    }
  }
  function save(list, sel) {
    localStorage.setItem(KC, JSON.stringify(list || []));
    localStorage.setItem(KS, JSON.stringify(sel));
  }

  // --- Send Counter (per day) ---
  function loadSend() {
    try { return JSON.parse(localStorage.getItem(SEND_KEY) || '{}') || {}; }
    catch { return {}; }
  }
  function saveSend(d) {
    localStorage.setItem(SEND_KEY, JSON.stringify(d || {}));
  }
  function ensureToday(d) {
    const today = new Date().toDateString(); // JST環境でも安定
    if (!d || d.date !== today) d = { date: today, count: 0 };
    return d;
  }

  // --- UI Counters ---
  function updateCustomerRemainUI() {
    if (!remainCust) return;
    const st = load();
    if (PREMIUM.isPro) {
      remainCust.textContent = '上限なし';
      return;
    }
    const left = Math.max(0, MAX_CUSTOMERS - (st.list || []).length);
    remainCust.textContent = `残 ${left}人`;
  }
  function updateSendRemainUI() {
    if (!remainShare) return;
    if (PREMIUM.isPro) {
      remainShare.textContent = '送信残り 無制限';
      return;
    }
    let d = ensureToday(loadSend());
    const left = Math.max(0, MAX_SENDS - (d.count || 0));
    remainShare.textContent = `送信残り ${left}回`;
  }

  // --- Render list ---
  function render() {
    const st = load();
    lst.innerHTML = '';
    (st.list || []).forEach((nm, i) => {
      const li = document.createElement('li');
      li.innerHTML = `
        <span>${nm}</span>
        <span>
          <button class="btn ${st.sel === i ? 'primary' : ''}" data-a="sel" data-i="${i}">
            ${st.sel === i ? '選択中' : '選択'}
          </button>
          <a class="btn" href="customer.html#${encodeURIComponent(nm)}">メモ</a>
          <button class="btn" data-a="del" data-i="${i}">削除</button>
        </span>`;
      lst.appendChild(li);
    });
    updateCustomerRemainUI();
  }

  // --- Add customer (free: 5 max) ---
  on(addB, 'click', () => {
    const v = (nameI && nameI.value || '').trim();
    if (!v) return;
    const st = load();
    if (!PREMIUM.isPro && (st.list || []).length >= MAX_CUSTOMERS) {
      alert('無料版では顧客の登録は5名までです。');
      return;
    }
    st.list.push(v);
    st.sel = st.list.length - 1;
    save(st.list, st.sel);
    if (nameI) nameI.value = '';
    render();
  });

  // --- Select / Delete in list ---
  on(lst, 'click', (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    const a = t.getAttribute('data-a');
    const i = Number(t.getAttribute('data-i'));
    const st = load();
    if (a === 'sel') {
      st.sel = i;
      save(st.list, st.sel);
      render();
    } else if (a === 'del') {
      st.list.splice(i, 1);
      if (st.sel === i) st.sel = null;
      save(st.list, st.sel);
      render();
    }
  });

  // --- Insert {name} (literal) ---
  on(ins, 'click', () => {
    if (!msg) return;
    const s = msg.selectionStart || 0;
    const e = msg.selectionEnd || 0;
    const tag = '{name}';
    msg.value = (msg.value || '').slice(0, s) + tag + (msg.value || '').slice(e);
    msg.focus();
    msg.selectionStart = msg.selectionEnd = s + tag.length;
    updateRemain();
  });

  // --- Char counter ---
  const limit = 10000;
  function updateRemain() {
    if (!msg || !rem) return;
    rem.textContent = Math.max(0, limit - (msg.value || '').length);
  }
  if (msg) {
    // --- ここから最小追記（メッセージ自動保存と復元） ---
    // 読み込み時に復元（既存の localStorage キー名に合わせる）
    msg.value = localStorage.getItem('hime_msg') || '';
    // 入力ごとに保存し、文字数カウンタも更新
    on(msg, 'input', () => {
      localStorage.setItem('hime_msg', msg.value);
      updateRemain();
    });
    // --- ここまで最小追記 ---
    updateRemain();
  }

  // --- Share (tap = consume 1 count immediately) ---
  on(share, 'click', async () => {
    if (!msg) return;

    // 1) 先に消費（タップで減算する仕様）
    if (!PREMIUM.isPro) {
      let d = ensureToday(loadSend());
      if ((d.count || 0) >= MAX_SENDS) {
        updateSendRemainUI();
        alert('無料版では1日の送信は5回までです。');
        return;
      }
      d.count = (d.count || 0) + 1;
      saveSend(d);
    }
    updateSendRemainUI();

    // 2) {name}置換 → 共有 or クリップボード
    const st = load();
    const selName = (st.sel != null && st.list[st.sel]) ? st.list[st.sel] : null;
    const out = selName ? (msg.value || '').replaceAll('{name}', selName) : (msg.value || '');

    try {
      if (navigator.share) {
        await navigator.share({ text: out });
      } else {
        await navigator.clipboard.writeText(out);
        alert('共有に非対応のためコピーしました。');
      }
    } catch {
      // キャンセルなどでもカウントは戻さない（仕様通り）
    }
  });

  // --- Backup (Base64 string) ---
  const mk = document.getElementById('makeString');
  const cp = document.getElementById('copyString');
  const rs = document.getElementById('restoreFromString');
  const ar = document.getElementById('backupStringArea');

  const enc = (o) => btoa(unescape(encodeURIComponent(JSON.stringify(o))));
  const dec = (b) => JSON.parse(decodeURIComponent(escape(atob(b))));

  const collect = () => {
    const d = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (/^hime/i.test(k)) d[k] = localStorage.getItem(k);
    }
    return d;
  };
  const apply = (data) => {
    Object.keys(data || {}).forEach((k) => localStorage.setItem(k, data[k]));
  };

  on(mk, 'click', () => {
    if (!ar) return;
    try {
      ar.value = enc(collect());
    } catch {
      alert('バックアップ文字列の作成に失敗しました。');
    }
  });
  on(cp, 'click', async () => {
    if (!ar || !ar.value) return;
    try { await navigator.clipboard.writeText(ar.value); } catch {}
  });
  on(rs, 'click', () => {
    if (!ar || !ar.value) return;
    try {
      apply(dec(ar.value.trim()));
      alert('復元しました。再読み込みします。');
      location.reload();
    } catch {
      alert('文字列の形式が正しくありません。');
    }
  });

  // --- Init ---
  render();
  updateSendRemainUI();
  loadPremiumFromFirestore();
})();
