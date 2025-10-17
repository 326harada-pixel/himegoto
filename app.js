(() => {
  const $ = s => document.querySelector(s);
  const LS_KEY = 'hime_customers';
  const LS_SELECTED = 'hime_selected';

  const defaults = {
    message: '今日はありがとう♥{name}さんが来てくれてホント助かった😅また週末にでもさっきのお話の続き聞きたいな✨次は金曜日出勤してるから、もし{name}さんの都合が良かったらやけど来てくれると嬉しいな(,,>᎑<,,)待ってるね♥♡♥'
  };

  const customerInput = $('#customerInput');
  const addBtn = $('#addBtn');
  const list = $('#customerList');
  const regCount = $('#regCount');
  const freeCount = $('#freeCount');
  const messageEl = $('#message');
  const insertBtn = $('#insertName');
  const shareBtn = $('#shareBtn');

  let customers = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
  let selected = localStorage.getItem(LS_SELECTED) || '';

  function save() {
    localStorage.setItem(LS_KEY, JSON.stringify(customers));
    localStorage.setItem(LS_SELECTED, selected);
    render();
  }

  function render() {
    regCount.textContent = customers.length + '件';
    const remain = Math.max(0, 5 - customers.length);
    freeCount.textContent = '無料版：残り ' + remain + ' 件';

    list.innerHTML = '';
    customers.forEach(name => {
      const el = document.createElement('div');
      el.className = 'item';

      const left = document.createElement('div');
      left.className = 'name';
      left.textContent = name;

      const actions = document.createElement('div');
      actions.className = 'actions';

      const select = document.createElement('button');
      select.className = 'badge' + (selected === name ? ' selecting' : '');
      select.textContent = '選ぶ';
      select.addEventListener('click', () => {
        selected = name;
        alert(`「${name}」を選択しました。`);
        save();
      });

      const del = document.createElement('button');
      del.className = 'badge';
      del.textContent = '削除';
      del.addEventListener('click', () => {
        customers = customers.filter(n => n !== name);
        if (selected === name) selected = '';
        save();
      });

      actions.append(select, del);
      el.append(left, actions);
      list.appendChild(el);
    });

    if (!messageEl.value) messageEl.value = defaults.message;
  }

  addBtn?.addEventListener('click', () => {
    const v = (customerInput.value || '').trim();
    if (!v) return;
    if (customers.includes(v)) {
      alert('同じ名前がすでにあります');
      return;
    }
    if (customers.length >= 5) {
      alert('無料枠の上限に達しています');
      return;
    }
    customers.push(v);
    customerInput.value = '';
    save();
  });

  insertBtn?.addEventListener('click', () => {
    const nm = selected || '{name}';
    const start = messageEl.selectionStart ?? messageEl.value.length;
    const end = messageEl.selectionEnd ?? messageEl.value.length;
    const txt = messageEl.value;
    messageEl.value = txt.slice(0, start) + nm + txt.slice(end);
    messageEl.focus();
    messageEl.selectionStart = messageEl.selectionEnd = start + nm.length;
  });

  shareBtn?.addEventListener('click', async () => {
    const nm = selected || '{name}';
    const text = messageEl.value.replaceAll('{name}', nm);
    if (navigator.share) {
      try { await navigator.share({ text }); }
      catch (e) {}
    } else {
      navigator.clipboard?.writeText(text);
      alert('本文をコピーしました。LINEで貼り付けてください。');
    }
  });

  document.querySelector('#loginBtn')?.addEventListener('click', () => {
    alert('現在テスト版のためログインできません。');
  });

  render();
})();  
