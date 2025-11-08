(function () {
  const $ = (s) => document.querySelector(s);
  const on = (el, ev, fn) => el && el.addEventListener(ev, fn);

  const lst = $('#customerList');
  const nameI = $('#nameInput');
  const addB = $('#addBtn');
  const msg = $('#messageBox');
  const ins = $('#insertName');
  const rem = $('#remain');
  const share = $('#shareBtn');
  const remainCust = $('#remainCustomers');
  const remainShare = $('#remainShares');

  const KC = 'hime_customers';
  const KS = 'hime_selected';
  const KL = 'hime_sharelog';

  const MAX_CUSTOMERS = 5;
  const MAX_SENDS = 5;

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

  function save(l, s) {
    localStorage.setItem(KC, JSON.stringify(l || []));
    localStorage.setItem(KS, JSON.stringify(s));
  }

  // 残数表示更新
  function updateCounters() {
    const st = load();
    const custRemain = Math.max(0, MAX_CUSTOMERS - st.list.length);
    if (remainCust) remainCust.textContent = `残 ${custRemain}人`;

    const log = JSON.parse(localStorage.getItem(KL) || '{}');
    const today = new Date().toLocaleDateString('ja-JP');
    const count = log.date === today ? (log.count || 0) : 0;
    const shareRemain = Math.max(0, MAX_SENDS - count);
    if (remainShare) remainShare.textContent = `残 ${shareRemain}回`;
  }

  // 顧客追加
  on(addB, 'click', () => {
    const v = (nameI && nameI.value || '').trim();
    if (!v) return;
    const st = load();
    if (st.list.length >= MAX_CUSTOMERS) {
      alert('無料版では顧客の登録は5名までです。');
      return;
    }
    st.list.push(v);
    st.sel = st.list.length - 1;
    save(st.list, st.sel);
    if (nameI) nameI.value = '';
    render();
    updateCounters();
  });

  // 顧客表示
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
  }

  // 削除・選択
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
      updateCounters();
    }
  });

  // 名前挿入
  on(ins, 'click', () => {
    if (!msg) return;
    const s = msg.selectionStart || 0;
    const e = msg.selectionEnd || 0;
    msg.value = msg.value.slice(0, s) + '{name}' + msg.value.slice(e);
    msg.focus();
    msg.selectionStart = msg.selectionEnd = s + 6;
  });

  // 共有
  on(share, 'click', async () => {
    const st = load();
    const nm = st.sel != null ? st.list[st.sel] : null;
    const log = JSON.parse(localStorage.getItem(KL) || '{}');
    const today = new Date().toLocaleDateString('ja-JP');
    if (log.date !== today) { log.date = today; log.count = 0; }

    if (log.count >= MAX_SENDS) {
      alert('無料版では1日の送信は5回までです。');
      return;
    }

    const out = nm ? msg.value.replaceAll('{name}', nm) : msg.value;
    try {
      if (navigator.share) await navigator.share({ text: out });
      else {
        await navigator.clipboard.writeText(out);
        alert('共有に非対応のためコピーしました。');
      }
      log.count++;
      localStorage.setItem(KL, JSON.stringify(log));
      updateCounters();
    } catch { }
  });

  updateCounters();
  render();
})();
