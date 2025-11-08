// app-index.js（{name}はそのまま挿入／共有時のみ選択名で置換）
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

  const KC = 'hime_customers';
  const KS = 'hime_selected';

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
  render();

  // 顧客の追加
  on(addB, 'click', () => {
    const v = (nameI && nameI.value || '').trim();
    if (!v) return;
    const st = load();
    st.list.push(v);
    st.sel = st.list.length - 1;
    save(st.list, st.sel);
    if (nameI) nameI.value = '';
    render();
  });

  // 顧客リストの選択／削除
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

  // {name} は「そのまま」挿入（置換はしない）
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

  // 文字数カウンタ
  const limit = 10000;
  function updateRemain() {
    if (!msg || !rem) return;
    rem.textContent = Math.max(0, limit - (msg.value || '').length);
  }
  if (msg) {
    on(msg, 'input', updateRemain);
    updateRemain();
  }

  // 共有：この時だけ選択中の顧客名で {name} を置換
  on(share, 'click', async () => {
    if (!msg) return;
    const st = load();
    const selName = (st.sel != null && st.list[st.sel]) ? st.list[st.sel] : null;
    const out = selName ? (msg.value || '').replaceAll('{name}', selName) : (msg.value || '');
    try {
      if (navigator.share) {
        await navigator.share({ text: out });
      } else {
        await navigator.clipboard.writeText(out);
        alert('共有に非対応のためテキストをコピーしました。');
      }
    } catch { /* noop */ }
  });

  // —— バックアップ（文字列）——
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
  const apply = (d) => Object.keys(d || {}).forEach((k) => localStorage.setItem(k, d[k]));

  on(mk, 'click', () => {
    if (!ar) return;
    ar.value = enc(collect());
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
})();
