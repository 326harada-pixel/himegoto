/* himegoto ver.1.31β - unified app.js (Home only)
   - No header right injection (keeps logo centered)
   - Customers / Quota / Share / Backup-Restore
   - SW register + auto-update (minimal)
*/
(() => {
  const $ = (sel, root=document)=>root.querySelector(sel);
  const $$ = (sel, root=document)=>Array.from(root.querySelectorAll(sel));

  // Elements
  const listEl = document.querySelector('.customer-list');
  const addInput = document.getElementById('add-input');
  const addBtn = document.getElementById('add-btn');
  const regRemain = document.getElementById('reg-remain');
  const msgEl = document.getElementById('message');
  const insertBtn = document.getElementById('insert-name');
  const shareBtn = document.getElementById('share-btn');
  const remainBadge = document.getElementById('remain-badge');

  // Storage
  const LS_KEYS = {
    PLAN:       'hime_plan_v1',
    CUSTOMERS:  'hime_customers_v1',
    SELECTED:   'hime_selected_v1',
    QUOTA_CNT:  'hime_quota_cnt_v1',
    QUOTA_DAY:  'hime_quota_day_v1'
  };
  const LIMITS = { customers: 5, quotaPerDay: 5 };
  const getPlan = () => (localStorage.getItem(LS_KEYS.PLAN) || 'free');
  const isPro = () => getPlan() === 'pro';
  const load = (k, def) => { try{ const v = JSON.parse(localStorage.getItem(k)); return v ?? def; }catch{ return def; } };
  const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  // Quota
  function ensureQuotaDay(){
    const today = new Date(); today.setHours(0,0,0,0);
    const stored = load(LS_KEYS.QUOTA_DAY, 0);
    if (stored !== today.getTime()) { save(LS_KEYS.QUOTA_DAY, today.getTime()); save(LS_KEYS.QUOTA_CNT, 0); }
  }
  function getRemainQuota(){
    ensureQuotaDay();
    const used = load(LS_KEYS.QUOTA_CNT, 0);
    return Math.max(0, LIMITS.quotaPerDay - used);
  }
  function consumeQuota(){
    ensureQuotaDay();
    const used = load(LS_KEYS.QUOTA_CNT, 0);
    save(LS_KEYS.QUOTA_CNT, used + 1);
    renderQuota();
  }
  function renderQuota(){
    const remain = getRemainQuota();
    if (remainBadge) remainBadge.textContent = `残り ${remain} 回`;
    if (shareBtn) shareBtn.disabled = remain <= 0;
  }

  // Customers
  function updateRegRemain(){
    if (!regRemain) return;
    regRemain.textContent = isPro() ? `(上限なし)` : `(無料版は ${LIMITS.customers} 名まで)`;
  }
  function getCustomers(){ return load(LS_KEYS.CUSTOMERS, []); }
  function setCustomers(arr){ save(LS_KEYS.CUSTOMERS, arr); renderCustomers(); updateRegRemain(); }
  function getSelected(){ return load(LS_KEYS.SELECTED, null); }
  function setSelected(name){ save(LS_KEYS.SELECTED, name); renderCustomers(); }

  function renderCustomers(){
    if (!listEl) return;
    const customers = getCustomers();
    const selected = getSelected();
    listEl.innerHTML = '';
    customers.forEach((name, idx) => {
      const row = document.createElement('div');
      row.className = 'row';

      const span = document.createElement('span');
      span.textContent = name;

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
        if (getSelected() === name) setSelected(null);
        setCustomers(after);
      });

      actions.appendChild(choose);
      actions.appendChild(del);
      row.appendChild(span);
      row.appendChild(actions);
      listEl.appendChild(row);
    });
  }

  if (addBtn && addInput){
    addBtn.addEventListener('click', () => {
      const name = (addInput.value || '').trim();
      if (!name) { alert('名前を入力してください'); return; }
      const arr = getCustomers();
      if (!isPro() && arr.length >= LIMITS.customers) { alert('無料版は5名までです'); return; }
      if (arr.includes(name)) { alert('同じ名前が既にあります'); return; }
      arr.push(name);
      setCustomers(arr);
      addInput.value = '';
    });
  }

  // Message helpers
  if (insertBtn && msgEl) {
    insertBtn.addEventListener('click', () => {
      const tag = '{name}';
      const start = msgEl.selectionStart ?? msgEl.value.length;
      const end   = msgEl.selectionEnd   ?? msgEl.value.length;
      msgEl.setRangeText(tag, start, end, 'end');
      msgEl.focus();
    });
  }

  // Share (copy to clipboard)
  if (shareBtn && msgEl) {
    shareBtn.addEventListener('click', async () => {
      const sel = getSelected();
      const raw = msgEl.value || '';
      const text = raw.replaceAll('{{name}}', sel ?? '').replaceAll('{name}', sel ?? '');
      try{
        await navigator.clipboard.writeText(text);
        consumeQuota();
        alert('本文をコピーしました。必要なトークで貼り付けてください。');
      }catch(e){
        alert('コピーに失敗しました');
      }
    });
  }

  // Backup & Restore
  const backupBtn = document.getElementById('backup-btn');
  const restoreBtn = document.getElementById('restore-btn');
  const restoreFile = document.getElementById('restore-file');

  function makeBackupData(){
    return {
      customers: getCustomers(),
      selected: getSelected(),
      quota_cnt: load(LS_KEYS.QUOTA_CNT, 0),
      quota_day: load(LS_KEYS.QUOTA_DAY, 0),
      plan: getPlan(),
      exported_at: new Date().toISOString()
    };
  }
  function downloadJSON(filename, dataObj){
    const blob = new Blob([JSON.stringify(dataObj, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 0);
  }
  function handleBackup(){
    const data = makeBackupData();
    const y = new Date();
    const stamp = `${y.getFullYear()}${String(y.getMonth()+1).padStart(2,'0')}${String(y.getDate()).padStart(2,'0')}`;
    downloadJSON(`himegoto_backup_${stamp}.json`, data);
    alert('バックアップファイルを作成しました。LINEのキープメモ等に保管してください。');
  }
  function handleRestoreFile(file){
    const reader = new FileReader();
    reader.onload = () => {
      try{
        const data = JSON.parse(reader.result);
        save(LS_KEYS.CUSTOMERS, Array.isArray(data.customers)? data.customers: []);
        save(LS_KEYS.SELECTED, data.selected ?? null);
        save(LS_KEYS.QUOTA_CNT, data.quota_cnt ?? 0);
        save(LS_KEYS.QUOTA_DAY, data.quota_day ?? 0);
        if (data.plan) localStorage.setItem(LS_KEYS.PLAN, data.plan);
        renderCustomers(); renderQuota(); updateRegRemain();
        alert('復元が完了しました');
      }catch(e){ console.error(e); alert('復元に失敗しました'); }
    };
    reader.readAsText(file, 'utf-8');
  }
  if (backupBtn) backupBtn.addEventListener('click', handleBackup);
  if (restoreBtn && restoreFile){
    restoreBtn.addEventListener('click', ()=> restoreFile.click());
    restoreFile.addEventListener('change', ev => { const f = ev.target.files && ev.target.files[0]; if (f) handleRestoreFile(f); ev.target.value=''; });
  }

  // Initial renders
  renderCustomers(); updateRegRemain(); renderQuota();

  // Drawer
  (function(){
    const d=document.getElementById('drawer'),s=document.getElementById('scrim');
    if(!d||!s) return;
    document.getElementById('menuBtn')?.addEventListener('click',()=>{d.classList.add('open');s.classList.add('show');});
    s.addEventListener('click',()=>{d.classList.remove('open');s.classList.remove('show');});
    d.addEventListener('click',e=>{if(e.target.matches('a')){d.classList.remove('open');s.classList.remove('show');}});
  
/* install button logic */
let __deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e)=>{
  e.preventDefault();
  __deferredPrompt = e;
  const btn = document.getElementById('install-btn');
  if (btn) btn.classList.add('show');
});
const __installBtn = document.getElementById('install-btn');
if (__installBtn){
  __installBtn.addEventListener('click', async ()=>{
    if (!__deferredPrompt) return;
    __installBtn.disabled = true;
    try{
      __deferredPrompt.prompt();
      await __deferredPrompt.userChoice;
    }finally{
      __deferredPrompt = null;
      __installBtn.classList.remove('show');
      __installBtn.disabled = false;
    }
  });
}

})();

  // Service Worker (keep logo centered: no header UI injection)
  
/* SW register (minimal) */
async function registerSW(){
  if(!('serviceWorker' in navigator)) return;
  try{
    const reg = await navigator.serviceWorker.register('/service-worker.js');
    if (reg && reg.waiting) reg.waiting.postMessage({type:'SKIP_WAITING'});
  }catch(e){ console.warn(e); }
}
async function boot(){ await registerSW(); }
boot();


/* install button logic */
let __deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e)=>{
  e.preventDefault();
  __deferredPrompt = e;
  const btn = document.getElementById('install-btn');
  if (btn) btn.classList.add('show');
});
const __installBtn = document.getElementById('install-btn');
if (__installBtn){
  __installBtn.addEventListener('click', async ()=>{
    if (!__deferredPrompt) return;
    __installBtn.disabled = true;
    try{
      __deferredPrompt.prompt();
      await __deferredPrompt.userChoice;
    }finally{
      __deferredPrompt = null;
      __installBtn.classList.remove('show');
      __installBtn.disabled = false;
    }
  });
}

})();
