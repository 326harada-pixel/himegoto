/* himegoto v1.27β - 要件のみ追加、UIは現状維持 */
(() => {
  const LS_KEYS = {
    CUSTOMERS: 'hime_customers_v1',
    SELECTED:  'hime_selected_v1',
    QUOTA_CNT: 'hime_quota_cnt_v1',
    QUOTA_DAY: 'hime_quota_day_v1'
  };

  const LIMITS = { customers: 5, quotaPerDay: 5 };

  // Elements
  const listEl = document.querySelector('.customer-list');
  const addInput = document.getElementById('add-input');
  const addBtn = document.getElementById('add-btn');
  const regRemain = document.getElementById('reg-remain');

  const msgEl = document.getElementById('message');
  const remainBadge = document.getElementById('remain-badge');
  const insertBtn = document.getElementById('insert-name');
  const shareBtn  = document.getElementById('share-btn');

  // ---- LocalStorage helpers
  const load = (k, d) => {
    try { const v = JSON.parse(localStorage.getItem(k)); return (v ?? d); } catch { return d; }
  };
  const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  // ---- Quota (per day)
  function ensureQuotaDay() {
    const today = new Date(); today.setHours(0,0,0,0);
    const stored = load(LS_KEYS.QUOTA_DAY, 0);
    if (stored !== today.getTime()) {
      save(LS_KEYS.QUOTA_DAY, today.getTime());
      save(LS_KEYS.QUOTA_CNT, 0);
    }
  }
  function getRemainQuota() {
    ensureQuotaDay();
    const used = load(LS_KEYS.QUOTA_CNT, 0);
    return Math.max(0, LIMITS.quotaPerDay - used);
  }
  function incQuota() {
    ensureQuotaDay();
    const used = load(LS_KEYS.QUOTA_CNT, 0) + 1;
    save(LS_KEYS.QUOTA_CNT, used);
    renderQuota();
  }
  function renderQuota() {
    const remain = getRemainQuota();
    if (remainBadge) remainBadge.textContent = `残り ${remain} 回`;
    if (shareBtn) shareBtn.disabled = remain <= 0;
  }

  // ---- Customers
  function getCustomers() { return load(LS_KEYS.CUSTOMERS, []); }
  function setCustomers(arr) { save(LS_KEYS.CUSTOMERS, arr); renderCustomers(); }
  function getSelected() { return load(LS_KEYS.SELECTED, null); }
  function setSelected(name) { save(LS_KEYS.SELECTED, name); renderCustomers(); }

  function renderCustomers() {
    if (!listEl) return;
    const customers = getCustomers();
    const selected = getSelected();

    listEl.innerHTML = '';
    customers.forEach((name, idx) => {
      const row = document.createElement('div');
      row.className = 'row';

      const left = document.createElement('div');
      left.textContent = name;

      const actions = document.createElement('div');
      actions.className = 'row-actions';

      const choose = document.createElement('button');
      const active = selected === name;
      choose.className = `choose-btn ${active ? 'choose-btn--active' : ''}`;
      choose.textContent = active ? '選択中' : '選択';
      choose.addEventListener('click', () => setSelected(name));

      const del = document.createElement('button');
      del.className = 'del-btn';
      del.textContent = '削除';
      del.addEventListener('click', () => {
        const after = getCustomers().filter((_, i) => i !== idx);
        // 選択中を消したら選択解除
        if (getSelected() === name) setSelected(null);
        setCustomers(after);
        updateRegRemain();
      });

      actions.appendChild(choose);
      actions.appendChild(del);
      row.appendChild(left);
      row.appendChild(actions);
      listEl.appendChild(row);
    });
  }

  function updateRegRemain() {
    if (!regRemain) return;
    const remain = Math.max(0, LIMITS.customers - getCustomers().length);
    regRemain.textContent = `登録残り ${remain} 名`;
  }

  if (addBtn && addInput) {
    addBtn.addEventListener('click', () => {
      const name = (addInput.value || '').trim();
      if (!name) return;
      const arr = getCustomers();
      if (arr.length >= LIMITS.customers) { alert('無料版は5名までです'); return; }
      if (arr.includes(name)) { alert('同じ名前が既にあります'); return; }
      arr.push(name);
      setCustomers(arr);
      addInput.value = '';
      updateRegRemain();
    });
  }

  // ---- Message helpers
  if (insertBtn && msgEl) {
    insertBtn.addEventListener('click', () => {
      const tag = '{name}';
      const start = msgEl.selectionStart ?? msgEl.value.length;
      const end   = msgEl.selectionEnd   ?? msgEl.value.length;
      const before = msgEl.value.slice(0, start);
      const after  = msgEl.value.slice(end);
      msgEl.value = before + tag + after;
      msgEl.focus();
      msgEl.setSelectionRange(start + tag.length, start + tag.length);
    });
  }

  // ---- Share (Web Share API / fallback なし：コピーはしない)
  if (shareBtn && msgEl) {
    shareBtn.addEventListener('click', async () => {
      if (getRemainQuota() <= 0) { alert('無料版の1日5回の上限に達しました'); return; }
      const sel = getSelected();
      if (!sel) { alert('顧客を選択してください'); return; }

      // デフォ文自体は変更しない。共有用だけ置換。
      const toShare = msgEl.value.replaceAll('{name}', sel);

      try {
        if (navigator.share) {
          await navigator.share({ text: toShare });
          incQuota();
        } else {
          // 共有未対応端末：何もしない（コピーはしない）
          alert('この端末は共有に対応していません。対応ブラウザでお試しください。');
        }
      } catch (e) {
        // キャンセルはノーカウント
        console.debug('share cancelled or failed', e);
      }
    });
  }

  // ---- Initial render
  renderCustomers();
  updateRegRemain();
  renderQuota();
})();
