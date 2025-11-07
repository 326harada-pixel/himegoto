/* himegoto ver.1.31β stable */
(function(){
  const ready = (fn)=> (document.readyState==='loading') ? document.addEventListener('DOMContentLoaded', fn, {once:true}) : fn();
  ready(init);

  function q(sel,root=document){ return root.querySelector(sel); }
  function qa(sel,root=document){ return Array.from(root.querySelectorAll(sel)); }

  function init(){
    const listEl=q('.customer-list'), addInput=q('#add-input'), addBtn=q('#add-btn');
    const regRemain=q('#reg-remain'), msgEl=q('#message'), insertBtn=q('#insert-name');
    const shareBtn=q('#share-btn'), remainBadge=q('#remain-badge');
    const memoArea=q('#customer-memo'), memoSave=q('#memo-save');
    const backupBtn=q('#backup-btn'), restoreBtn=q('#restore-btn'), restoreFile=q('#restore-file');
    const drawer=q('#drawer'), scrim=q('#scrim'), menuBtn=q('#menuBtn'), installBtn=q('#install-btn');

    const LS_KEYS={ PLAN:'hime_plan_v1', CUSTOMERS:'hime_customers_v1', SELECTED:'hime_selected_v1', QUOTA_CNT:'hime_quota_cnt_v1', QUOTA_DAY:'hime_quota_day_v1' };
    const LIMITS={ customers:5, quotaPerDay:5 };
    const getPlan=()=> localStorage.getItem(LS_KEYS.PLAN)||'free';
    const isPro =()=> getPlan()==='pro';
    const load=(k,def)=>{ try{ const v=JSON.parse(localStorage.getItem(k)); return v??def; }catch{ return def; } };
    const save=(k,v)=> localStorage.setItem(k, JSON.stringify(v));

    function ensureQuotaDay(){ const t=new Date(); t.setHours(0,0,0,0); const d=load(LS_KEYS.QUOTA_DAY,0); if(d!==t.getTime()){ save(LS_KEYS.QUOTA_DAY,t.getTime()); save(LS_KEYS.QUOTA_CNT,0);} }
    function getRemainQuota(){ ensureQuotaDay(); const u=load(LS_KEYS.QUOTA_CNT,0); return Math.max(0, LIMITS.quotaPerDay-u); }
    function consumeQuota(){ ensureQuotaDay(); const u=load(LS_KEYS.QUOTA_CNT,0); save(LS_KEYS.QUOTA_CNT,u+1); renderQuota(); }
    function renderQuota(){ const r=getRemainQuota(); if(remainBadge) remainBadge.textContent=`残り ${r} 回`; if(shareBtn) shareBtn.disabled = r<=0; }

    function updateRegRemain(){ if(regRemain) regRemain.textContent = isPro()? '(上限なし)' : `(無料版は ${LIMITS.customers} 名まで)`; }
    function getCustomers(){ return load(LS_KEYS.CUSTOMERS,[]); }
    function setCustomers(a){ save(LS_KEYS.CUSTOMERS,a); renderCustomers(); updateRegRemain(); }
    function getSelected(){ return load(LS_KEYS.SELECTED,null); }
    function setSelected(n){ save(LS_KEYS.SELECTED,n); renderCustomers(); loadSelectedMemo(); }

    function renderCustomers(){
      if(!listEl) return;
      const cs=getCustomers(), sel=getSelected();
      listEl.innerHTML='';
      cs.forEach((name,idx)=>{
        const row=document.createElement('div'); row.className='row';
        const span=document.createElement('span'); span.textContent=name;
        const actions=document.createElement('div'); actions.className='row-actions';

        const choose=document.createElement('button');
        const active = sel===name;
        choose.className = `choose-btn ${active?'choose-btn--active':''}`;
        choose.textContent = active? '選択中':'選択';
        choose.addEventListener('click', ()=> setSelected(name));

        const del=document.createElement('button'); del.className='del-btn'; del.textContent='削除';
        del.addEventListener('click', ()=>{ const after=getCustomers().filter((_,i)=>i!==idx); if(getSelected()===name) setSelected(null); setCustomers(after); });

        actions.appendChild(choose); actions.appendChild(del);
        row.appendChild(span); row.appendChild(actions);
        listEl.appendChild(row);
      });
    }

    if(addBtn&&addInput){
      addBtn.addEventListener('click', (e)=>{
        e.preventDefault();
        const name=(addInput.value||'').trim();
        if(!name){ alert('名前を入力してください'); return; }
        const arr=getCustomers();
        if(!isPro() && arr.length>=LIMITS.customers){ alert('無料版は5名までです'); return; }
        if(arr.includes(name)){ alert('同じ名前が既にあります'); return; }
        arr.push(name); setCustomers(arr); addInput.value='';
      });
    }

    if(insertBtn&&msgEl){
      insertBtn.addEventListener('click', (e)=>{
        e.preventDefault();
        const tag='{name}';
        try{
          msgEl.focus();
          const s=typeof msgEl.selectionStart==='number'? msgEl.selectionStart : (msgEl.value?.length||0);
          const t=typeof msgEl.selectionEnd==='number'? msgEl.selectionEnd : (msgEl.value?.length||0);
          if(typeof msgEl.setRangeText==='function'){ msgEl.setRangeText(tag,s,t,'end'); }
          else{ const v=msgEl.value||''; msgEl.value=v.slice(0,s)+tag+v.slice(t); if(msgEl.setSelectionRange){ const pos=s+tag.length; msgEl.setSelectionRange(pos,pos);} }
        }catch{ msgEl.value=(msgEl.value||'')+tag; }
      });
    }

    if(shareBtn&&msgEl){
      shareBtn.addEventListener('click', async()=>{
        const sel=getSelected();
        const raw=msgEl.value||'';
        const text=raw.replaceAll('{{name}}', sel??'').replaceAll('{name}', sel??'');
        consumeQuota(); // 押した瞬間に消費
        try{
          if(navigator.share){ await navigator.share({text}); }
          else{ window.open('https://line.me/R/msg/text/?'+encodeURIComponent(text),'_blank'); }
        }catch(e){ console.warn('share canceled/failed', e); }
      });
    }

    function makeBackupData(){ return { customers:getCustomers(), selected:getSelected(), quota_cnt:load(LS_KEYS.QUOTA_CNT,0), quota_day:load(LS_KEYS.QUOTA_DAY,0), plan:getPlan(), exported_at:new Date().toISOString() }; }
    function downloadJSON(name,obj){ const blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=name; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(url); a.remove();},0); }
    function handleBackup(){ const d=makeBackupData(); const y=new Date(); const stamp=`${y.getFullYear()}${String(y.getMonth()+1).padStart(2,'0')}${String(y.getDate()).padStart(2,'0')}`; downloadJSON(`himegoto_backup_${stamp}.json`, d); alert('バックアップを作成しました'); }
    function handleRestoreFile(file){ const r=new FileReader(); r.onload=()=>{ try{ const d=JSON.parse(r.result); save(LS_KEYS.CUSTOMERS, Array.isArray(d.customers)? d.customers:[]); save(LS_KEYS.SELECTED, d.selected??null); save(LS_KEYS.QUOTA_CNT, d.quota_cnt??0); save(LS_KEYS.QUOTA_DAY, d.quota_day??0); if(d.plan) localStorage.setItem(LS_KEYS.PLAN,d.plan); renderCustomers(); renderQuota(); updateRegRemain(); alert('復元が完了しました'); }catch(e){ alert('復元に失敗しました'); } }; r.readAsText(file,'utf-8'); }

    backupBtn?.addEventListener('click', handleBackup);
    if(restoreBtn&&restoreFile){
      restoreBtn.addEventListener('click', ()=> restoreFile.click());
      restoreFile.addEventListener('change', ev=>{ const f=ev.target.files?.[0]; if(f) handleRestoreFile(f); ev.target.value=''; });
    }

    if(menuBtn&&drawer&&scrim){
      menuBtn.addEventListener('click', ()=>{drawer.classList.add('open'); scrim.classList.add('show');});
      scrim.addEventListener('click', ()=>{drawer.classList.remove('open'); scrim.classList.remove('show');});
      drawer.addEventListener('click', e=>{ if(e.target.matches('a')){drawer.classList.remove('open'); scrim.classList.remove('show');} });
    }

    let __deferredPrompt=null;
    window.addEventListener('beforeinstallprompt', (e)=>{ e.preventDefault(); __deferredPrompt=e; document.getElementById('install-btn')?.classList.add('show'); });
    document.getElementById('install-btn')?.addEventListener('click', async()=>{
      const btn=document.getElementById('install-btn');
      if(__deferredPrompt){ try{ btn.disabled=true; __deferredPrompt.prompt(); await __deferredPrompt.userChoice; }finally{ __deferredPrompt=null; btn.classList.remove('show'); btn.disabled=false; } }
      else{ alert('ブラウザのメニューから「ホーム画面に追加」を選んでください。'); }
    });

    renderCustomers(); updateRegRemain(); renderQuota(); loadSelectedMemo();
  }
})();
    function loadSelectedMemo(){
      if(!memoArea) return;
      const sel = getSelected();
      const memos = getMemos();
      memoArea.value = sel && memos[sel] ? memos[sel] : '';
    }
    
    memoSave?.addEventListener('click', ()=>{
      const sel = getSelected(); if(!sel) { alert('先に顧客を選択してください'); return; }
      const memos = getMemos(); memos[sel] = memoArea.value||''; setMemos(memos);
      alert('メモを保存しました');
    });
    memoArea?.addEventListener('input', ()=>{
      const sel = getSelected(); if(!sel) return;
      const memos = getMemos(); memos[sel] = memoArea.value||''; setMemos(memos);
    });
    