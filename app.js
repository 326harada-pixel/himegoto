/* build-20251109c */
(() => {
  const LS_KEY = 'hime_data_v1';
  const BK_PREFIX = 'HIME1.';

  const $ = (id) => document.getElementById(id);

  // Drawer
  const overlay = $('overlay');
  const drawer = $('drawer');
  function openDrawer() {
    overlay.style.display = 'block'; drawer.classList.add('open'); drawer.setAttribute('aria-hidden','false');
  }
  function closeDrawer() {
    overlay.style.display = 'none'; drawer.classList.remove('open'); drawer.setAttribute('aria-hidden','true');
  }
  $('menuBtn').addEventListener('click', openDrawer);
  $('closeDrawer').addEventListener('click', closeDrawer);
  overlay.addEventListener('click', closeDrawer);

  // Install button
  let deferredPrompt = null;
  const installBtn = $('installBtn');
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); deferredPrompt = e; installBtn.classList.remove('hidden');
  });
  installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    installBtn.classList.add('hidden');
  });
  // If already installed (standalone), hide
  if (window.matchMedia('(display-mode: standalone)').matches) {
    installBtn.classList.add('hidden');
  }

  // Beta popup 1/day
  const lastPopup = localStorage.getItem('hime_beta_popup_date');
  const today = new Date().toISOString().slice(0,10);
  if (lastPopup !== today) {
    alert('現在ベータ版のため、内部を不定期で更新しています。動作が不安定になることがありますが、順次改善中です。');
    localStorage.setItem('hime_beta_popup_date', today);
  }

  // Data helpers
  function load() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '{"customers":[],"selected":null,"quota":5}'); }
    catch { return {"customers":[],"selected":null,"quota":5}; }
  }
  function save(data) { localStorage.setItem(LS_KEY, JSON.stringify(data)); }

  // Render customers
  const list = $('customerList');
  function render() {
    const data = load();
    list.innerHTML = '';
    data.customers.forEach((c, idx) => {
      const row = document.createElement('div');
      row.className = 'customer';
      const left = document.createElement('div');
      left.textContent = c.name;
      const actions = document.createElement('div');
      actions.className = 'actions';
      const sel = document.createElement('button'); sel.className='pill'; sel.textContent = (data.selected===idx?'選択中':'選択');
      sel.addEventListener('click', () => { data.selected = idx; save(data); render(); });
      const memo = document.createElement('button'); memo.className='pill'; memo.textContent='メモ';
      memo.addEventListener('click', () => {
        location.href = `customer.html?name=${encodeURIComponent(c.name)}`;
      });
      const del = document.createElement('button'); del.className='pill'; del.textContent = '削除';
      del.addEventListener('click', () => { data.customers.splice(idx,1); if (data.selected===idx) data.selected=null; save(data); render();});
      actions.appendChild(memo); actions.appendChild(sel); actions.appendChild(del);
      row.appendChild(left); row.appendChild(actions);
      list.appendChild(row);
    });
    $('quotaNote').textContent = `残り ${data.quota} 回`;
  }
  render();

  // Add customer
  $('addBtn').addEventListener('click', () => {
    const name = $('newName').value.trim();
    if (!name) return;
    const data = load();
    if (data.customers.length >= 5) { alert('無料版は5名までです'); return; }
    data.customers.push({name, memo:''});
    $('newName').value='';
    save(data); render();
  });

  // Insert name
  $('insertName').addEventListener('click', () => {
    const data = load();
    if (data.selected==null) { alert('顧客を選択してください'); return; }
    const name = data.customers[data.selected].name;
    const box = $('msgBox');
    const start = box.selectionStart || 0;
    const end = box.selectionEnd || 0;
    box.value = box.value.slice(0,start) + name + box.value.slice(end);
  });

  // Share (dummy consume quota)
  $('shareBtn').addEventListener('click', () => {
    const data = load();
    if (data.quota<=0){ alert('本日の共有回数がありません'); return; }
    data.quota -= 1; save(data); render();
    alert('共有しました（ダミー）');
  });

  // Backup (Base64 string only)
  function toB64(jsonStr) { return BK_PREFIX + btoa(unescape(encodeURIComponent(jsonStr))); }
  function fromB64(b64) {
    if (!b64.startsWith(BK_PREFIX)) throw new Error('フォーマットが違います');
    const raw = b64.replace(BK_PREFIX,'');
    return decodeURIComponent(escape(atob(raw)));
  }
  $('makeStr').addEventListener('click', () => {
    const data = load();
    const payload = {v:1, ts: Date.now(), data};
    $('backupArea').value = toB64(JSON.stringify(payload));
  });
  $('copyStr').addEventListener('click', async () => {
    const v = $('backupArea').value.trim();
    if (!v){ alert('文字列がありません'); return; }
    try{ await navigator.clipboard.writeText(v); alert('コピーしました'); }catch{ alert('コピーに失敗'); }
  });
  $('restoreStr').addEventListener('click', () => {
    const v = $('backupArea').value.trim();
    if (!v){ alert('文字列を貼り付けてください'); return; }
    try{
      const obj = JSON.parse(fromB64(v));
      if (obj && obj.data) { save(obj.data); render(); alert('復元しました'); }
      else throw new Error('不正');
    }catch(e){ alert('復元に失敗しました'); }
  });
})();