
(() => {
  'use strict';
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  const LS = {
    CUSTOMERS: 'hime_customers_v1',
    SELECTED : 'hime_selected_v1',
    QUOTA_CNT: 'hime_quota_cnt_v1',
    QUOTA_DAY: 'hime_quota_day_v1',
    PLAN     : 'hime_plan_v1',
    MEMOS    : 'hime_memos_v1',
    PROFILES : 'hime_profiles_v1'
  };
  const load = (k, d=null) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
  const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const todayKey = () => new Date().toISOString().slice(0,10);

  // Drawer
  const openDrawer = () => { $('#drawer')?.setAttribute('aria-hidden','false'); $('#scrim')?.classList.add('on'); };
  const closeDrawer = () => { $('#drawer')?.setAttribute('aria-hidden','true'); $('#scrim')?.classList.remove('on'); };

  document.addEventListener('DOMContentLoaded', () => {
    // menu
    $('#menu-btn')?.addEventListener('click', openDrawer);
    $('#drawer-close')?.addEventListener('click', closeDrawer);
    $('#scrim')?.addEventListener('click', closeDrawer);

    // install prompt (no-op fallback)
    $('#install-btn')?.addEventListener('click', () => alert('ホーム画面に追加からインストールしてください'));

    // customers
    const addInput = $('#add-input');
    const addBtn   = $('#add-btn');
    const list     = $('#customers');

    const getCustomers = () => load(LS.CUSTOMERS, []);
    const setCustomers = (arr) => save(LS.CUSTOMERS, arr);
    const getSelected  = () => load(LS.SELECTED, null);
    const setSelected  = (n) => save(LS.SELECTED, n);

    function renderCustomers(){
      if(!list) return;
      const cur = getSelected();
      list.innerHTML = '';
      getCustomers().forEach(name => {
        const row = document.createElement('div');
        row.className = 'row between';
        const left = document.createElement('div');
        left.textContent = name;
        const actions = document.createElement('div');
        const memo = document.createElement('a');
        memo.href = `/customer.html?name=${encodeURIComponent(name)}`;
        memo.className = 'ghost';
        memo.textContent = 'メモ';
        const choose = document.createElement('button');
        choose.className = cur===name ? 'primary' : 'ghost';
        choose.textContent = cur===name ? '選択中' : '選択';
        choose.addEventListener('click', ()=>{ setSelected(name); renderCustomers(); updateRemain(); });
        const del = document.createElement('button');
        del.className='danger ghost';
        del.textContent='削除';
        del.addEventListener('click', ()=>{
          const arr = getCustomers().filter(x=>x!==name);
          setCustomers(arr);
          if(getSelected()===name) setSelected(arr[0]||null);
          renderCustomers(); updateRemain();
        });
        actions.appendChild(memo);
        actions.appendChild(choose);
        actions.appendChild(del);
        row.appendChild(left);
        row.appendChild(actions);
        list.appendChild(row);
      });
    }

    addBtn?.addEventListener('click', ()=>{
      const name = (addInput?.value||'').trim();
      if(!name) return;
      const arr = getCustomers();
      if(arr.includes(name)) { alert('同名は追加できません'); return; }
      if(arr.length>=5 && (localStorage.getItem(LS.PLAN)||'free')==='free'){ alert('無料版は5名までです'); return; }
      arr.push(name); setCustomers(arr); setSelected(name);
      addInput.value=''; renderCustomers();
    });

    // name insert
    const msg = $('#message');
    $('#insert-name')?.addEventListener('click', ()=>{
      const sel = getSelected(); if(!sel || !msg) { alert('先に顧客を選択してください'); return; }
      const t = msg; const ins = sel;
      const start = t.selectionStart ?? t.value.length;
      const end   = t.selectionEnd ?? t.value.length;
      t.value = t.value.slice(0,start) + ins + t.value.slice(end);
      const pos = start + ins.length;
      t.setSelectionRange(pos,pos); t.focus();
    });

    // share (count on click; navigator.share fallback to LINE)
    function quotaResetIfNeeded(){
      const d = load(LS.QUOTA_DAY, ''); 
      if(d !== todayKey()){ save(LS.QUOTA_DAY, todayKey()); save(LS.QUOTA_CNT, 0); }
    }
    function quotaUse(){ quotaResetIfNeeded(); const c = load(LS.QUOTA_CNT,0)+1; save(LS.QUOTA_CNT,c); return c; }
    function remain(){ quotaResetIfNeeded(); const used = load(LS.QUOTA_CNT,0); const cap = 9999; return Math.max(0, cap - used); }
    function updateRemain(){ const r = $('#remain-badge'); if(r) r.textContent = `残り ${remain()}`; }
    updateRemain();

    $('#share-btn')?.addEventListener('click', async()=>{
      const used = quotaUse(); updateRemain();
      const text = msg?.value || '';
      try {
        if(navigator.share){ await navigator.share({ text }); }
        else {
          const url = `https://line.me/R/share?text=${encodeURIComponent(text)}`;
          window.location.href = url;
        }
      } catch(e){ /* 共有ダイアログを閉じてもカウントは戻さない */ }
    });

    // backup string
    const btxt = $('#backup-text');
    function makeBackupPayload(){
      return {
        v: 'HIME1',
        customers: getCustomers(),
        selected: getSelected(),
        quota_cnt: load(LS.QUOTA_CNT,0),
        quota_day: load(LS.QUOTA_DAY,''),
        plan: localStorage.getItem(LS.PLAN)||'free',
        memos: load(LS.MEMOS, {}),
        profiles: load(LS.PROFILES, {})
      };
    }
    function makeBackupString(){
      const raw = JSON.stringify(makeBackupPayload());
      const b64 = btoa(unescape(encodeURIComponent(raw))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
      return 'HIME1.'+b64;
    }
    function parseBackupString(s){
      const m = s && s.match(/^HIME1\.([A-Za-z0-9\-_]+)$/); if(!m) throw new Error('format');
      const b64 = m[1].replace(/-/g,'+').replace(/_/g,'/'); const pad = b64.length%4? '==='.slice(b64.length%4):'';
      const json = decodeURIComponent(escape(atob(b64+pad))); return JSON.parse(json);
    }
    $('#backup-make')?.addEventListener('click', ()=>{ const s = makeBackupString(); if(btxt){ btxt.value = s; btxt.select(); } });
    $('#backup-copy')?.addEventListener('click', async()=>{
      try{ await navigator.clipboard.writeText(btxt?.value || makeBackupString()); alert('コピーしました'); }catch{ alert('コピーできませんでした'); }
    });
    $('#backup-restore-text')?.addEventListener('click', ()=>{
      try {
        const d = parseBackupString(btxt?.value||'');
        save(LS.CUSTOMERS, Array.isArray(d.customers)? d.customers: []);
        save(LS.SELECTED, d.selected ?? null);
        save(LS.QUOTA_CNT, d.quota_cnt ?? 0);
        save(LS.QUOTA_DAY, d.quota_day ?? '');
        localStorage.setItem(LS.PLAN, d.plan || 'free');
        save(LS.MEMOS, d.memos || {});
        save(LS.PROFILES, d.profiles || {});
        renderCustomers(); updateRemain();
        alert('復元しました');
      } catch(e){ alert('文字列の形式が正しくありません'); }
    });

    renderCustomers();
  });
})();
