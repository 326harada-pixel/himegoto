(() => {
  // ========= 共通ユーティリティ =========
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // JST（日本時間）で YYYY-MM-DD 生成
  const jstDateKey = () => {
    const fmt = new Intl.DateTimeFormat('ja-JP', {
      timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit'
    });
    const [{value:y},,{value:m},,{value:d}] = fmt.formatToParts(new Date());
    return `${y}-${m}-${d}`;
  };

  // ========= アプリ設定 =========
  const MAX_SEND = 5;           // 1日の送信上限
  const MAX_CUSTOMERS = 5;      // 無料の顧客登録上限

  // ========= ステート =========
  const todayKey = jstDateKey();
  // { date: 'YYYY-MM-DD', count: 0.., customers: ['山田', ...], selected: '山田' }
  let state = {};
  try { state = JSON.parse(localStorage.getItem('hime_state') || '{}'); } catch(e) { state = {}; }

  if (state.date !== todayKey) {
    // 日付が変わったらJST基準でカウントのみリセット
    state = { date: todayKey, count: 0, customers: state.customers || [], selected: null };
  } else {
    state.date = todayKey;
    state.customers = state.customers || [];
  }

  const save = () => localStorage.setItem('hime_state', JSON.stringify(state));
  const remainSend = () => Math.max(0, MAX_SEND - (state.count || 0));
  const remainReg  = () => Math.max(0, MAX_CUSTOMERS - (state.customers?.length || 0));

  // ========= 要素取得 =========
  const list       = $('.customer-list');
  const addBtn     = $('#add-btn');
  const addInput   = $('#add-input');
  const message    = $('#message');
  const shareBtn   = $('#share-btn');
  const insertBtn  = $('#insert-name');
  const sendBadge  = $('#remain-badge');
  const regBadge   = $('#reg-remain');

  // ========= リスト描画 =========
  function renderList() {
    if (!list) return;
    list.innerHTML = '';

    (state.customers || []).forEach((name) => {
      const row = document.createElement('div');
      row.className = 'row';
      row.dataset.name = name;

      row.innerHTML = `
        <span>${name}</span>
        <div class="row-actions">
          <a class="memo-btn" href="./customer.html?name=${encodeURIComponent(name)}">メモ</a>
          <button class="choose-btn">${state.selected === name ? '選択中' : '選択'}</button>
          <button class="del-btn">削除</button>
        </div>
      `;

      const choose = row.querySelector('.choose-btn');
      const del    = row.querySelector('.del-btn');

      // 選択中の見た目
      if (state.selected === name) {
        choose.classList.add('choose-btn--active'); // ピンク強調はCSS側の既存クラスを利用
      }

      // 「選択」
      choose.addEventListener('click', () => {
        state.selected = name;
        save();
        renderList();
      });

      // 「削除」
      del.addEventListener('click', () => {
        const i = state.customers.indexOf(name);
        if (i >= 0) state.customers.splice(i, 1);
        if (state.selected === name) state.selected = null;
        save();
        renderList();
        updateBadges();
      });

      list.appendChild(row);
    });
  }

  // ========= バッジ更新 =========
  function updateBadges() {
    if (sendBadge) sendBadge.textContent = `残り ${remainSend()} 回`;
    if (regBadge)  regBadge.textContent  = `登録残り ${remainReg()} 名`;
    if (shareBtn) {
      const left = remainSend();
      shareBtn.disabled = left <= 0;
      shareBtn.textContent = left <= 0 ? '上限到達' : '共有';
    }
  }

  // ========= 追加 =========
  addBtn?.addEventListener('click', () => {
    const name = (addInput?.value || '').trim();
    if (!name) return;
    if ((state.customers || []).length >= MAX_CUSTOMERS) { alert('無料版では顧客登録は5名までです。'); return; }
    if (state.customers.includes(name)) { alert('同じ名前がすでに登録されています。'); return; }
    state.customers.push(name);
    if (!state.selected) state.selected = name;
    addInput.value = '';
    save();
    renderList();
    updateBadges();
  });

  // ========= {name} 差し込み =========
  insertBtn?.addEventListener('click', () => {
    if (!message) return;
    const start = message.selectionStart ?? message.value.length;
    const end   = message.selectionEnd   ?? message.value.length;
    const before = message.value.slice(0, start);
    const after  = message.value.slice(end);
    const token  = '{name}';
    message.value = before + token + after;
    message.focus();
    message.selectionStart = message.selectionEnd = start + token.length;
  });

  // ========= 共有（押した瞬間にカウント消費） =========
  function buildMessage() {
    const name = state.selected || '';
    return name ? (message?.value || '').replaceAll('{name}', name) : (message?.value || '');
  }

  shareBtn?.addEventListener('click', async () => {
    // クリック時に先に減らす（コピー共有を含めカウント）
    if (remainSend() <= 0) { alert('無料版の送信上限（5回）に達しました。'); return; }

    state.count = (state.count || 0) + 1;
    save();
    updateBadges();

    const text = buildMessage();
    try {
      if (navigator.share) {
        await navigator.share({ text });
      } else {
        // LINEのテキスト共有URL
        location.href = 'https://line.me/R/msg/text/?' + encodeURIComponent(text);
      }
    } catch (e) {
      // 共有を閉じてもカウントは消費する仕様（ユーザー要件）
      console.log(e);
    }
  });

  // 初期描画
  renderList();
  updateBadges();
})();
