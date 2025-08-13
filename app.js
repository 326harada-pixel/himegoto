/***** バージョン表示（デバッグ用） *****/
console.warn('[himegoto] app.js v-fresh-1');

/***** 設定：あなたの最新GAS URLに置き換えてね *****/
const GAS_URL = "https://script.google.com/macros/s/AKfycbxLLNo23ANP9lxzyEJYXDbkiUtTfGlvfN3d3uC1oonZuBf23_qpVndJzbPbBTt0f-Y/exec";
const DEVICE_ID_KEY = 'himegoto_device_id';
const FREE_LIMIT = 5;
const EXP_KEY = 'hime_pro_until_v2'; // 期限保存用（yyyy/MM/dd）

/***** 端末ID *****/
function getDeviceId(){
  let id=localStorage.getItem(DEVICE_ID_KEY);
  if(!id){ id=self.crypto?.randomUUID?.()||(Date.now()+'-'+Math.random()); localStorage.setItem(DEVICE_ID_KEY,id); }
  return id;
}

/***** GAS呼び出し（プリフライトを起こさない：ヘッダ付けない） *****/
async function callGas(action, payload={}, {retries=0,delay=300}={}){
  const url=`${GAS_URL}?action=${encodeURIComponent(action)}&t=${Date.now()}`;
  const body=JSON.stringify({action, ...payload});
  for(let i=0;i<=retries;i++){
    try{
      const res=await fetch(url,{method:'POST', body});
      const txt=await res.text();
      let data; try{ data=JSON.parse(txt);}catch{ data={ok:false,error:'BAD_RESPONSE',raw:txt}; }
      if(res.ok && data.ok!==false) return data;
      throw new Error(data.error||res.statusText||'API_ERROR');
    }catch(e){
      if(i===retries) throw e;
      await new Promise(r=>setTimeout(r,delay));
    }
  }
}

/***** 日付ユーティリティ *****/
function ymdFromDate(d){
  const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), dd=String(d.getDate()).padStart(2,'0');
  return `${y}/${m}/${dd}`;
}
function daysLeftFromYMD(ymd){
  if(!ymd) return 0;
  const [y,m,d] = ymd.split('/').map(Number);
  if(!y||!m||!d) return 0;
  const today=new Date(); today.setHours(0,0,0,0);
  const end=new Date(y,m-1,d,23,59,59,999);
  return Math.max(0, Math.ceil((end - today)/86400000));
}

/***** モーダル *****/
const modalEl = () => document.getElementById('modal');
const modalTextEl = () => document.getElementById('modal-text');
function showModal(msg='処理中です…'){
  const m=modalEl(); if(!m) return;
  const t=modalTextEl(); if(t) t.textContent=msg;
  m.classList.add('show'); m.setAttribute('aria-hidden','false');
}
function hideModal(){ const m=modalEl(); if(!m) return; m.classList.remove('show'); m.setAttribute('aria-hidden','true'); }

/***** 状態管理 *****/
function getState(){ const s=JSON.parse(localStorage.getItem('hime_state')||'{}'); s.customers??=[]; s.selected??=null; return s; }
function setState(s){ localStorage.setItem('hime_state',JSON.stringify(s)); render(); }
function freeLeft(){ const s=getState(); return Math.max(0, FREE_LIMIT - s.customers.length); }

/***** 期限（ローカル保持） *****/
function getLocalExpiry(){ return (localStorage.getItem(EXP_KEY)||'').trim(); }
function setLocalExpiry(ymd){ if(/^\d{4}\/\d{2}\/\d{2}$/.test(ymd||'')) localStorage.setItem(EXP_KEY, ymd); }
function isProActive(){ return daysLeftFromYMD(getLocalExpiry()) > 0; }
function updateExpiryBadge(){
  const el=document.getElementById('pro-expiry-badge'); if(!el) return;
  const ymd=getLocalExpiry(); const days=daysLeftFromYMD(ymd);
  el.textContent = ymd ? `有料版：期限 ${ymd}（残り ${days} 日）` : '有料版：期限 ー';
}

/***** UI *****/
function render(){
  const s=getState();
  const freeLeftEl=document.getElementById('free-left'); if(freeLeftEl) freeLeftEl.textContent=freeLeft();
  const box=document.getElementById('customer-list'); if(!box) return;
  box.innerHTML='';
  if(!s.customers.length){ box.innerHTML='<p class="muted">まだいません</p>'; return; }
  s.customers.forEach((nm,idx)=>{
    const row=document.createElement('div'); row.className='customer';
    const name=document.createElement('div'); name.className='nm'; name.textContent=nm;
    const sel=document.createElement('button'); sel.className='btn btn-ghost'; sel.textContent=(s.selected===nm)?'選択中':'選ぶ';
    if(s.selected===nm){ sel.style.background='#2ecc71'; sel.style.color='#fff'; }
    sel.onclick=()=>{ s.selected=nm; setState(s); };
    const del=document.createElement('button'); del.className='btn btn-danger'; del.textContent='削除';
    del.onclick=()=>{ if(!confirm(`「${nm}」を削除します。`))return; s.customers.splice(idx,1); if(s.selected===nm)s.selected=null; setState(s); };
    row.append(name,sel,del); box.appendChild(row);
  });
}

/***** 初期化 *****/
document.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('modal-cancel')?.addEventListener('click', hideModal);

  render();
  updateExpiryBadge();

  // 顧客追加
  document.getElementById('btn-add')?.addEventListener('click', ()=>{
    const inp=document.getElementById('name-input'); const name=(inp?.value||'').trim(); if(!name) return alert('名前を入れてね');
    const s=getState(); if(s.customers.includes(name)) return alert('同じ名前があるよ');
    if(freeLeft()<=0 && !isProActive()) return alert('無料枠がいっぱいです');
    s.customers.push(name); if(inp) inp.value=''; setState(s);
  });

  // コード認証（二度押し防止＋即モーダル）
  const btnVerify=document.getElementById('btn-verify-code');
  let verifying=false;
  btnVerify?.addEventListener('click', async ()=>{
    if(verifying) return;
    const inp=document.getElementById('code-input');
    const code=(inp?.value||'').trim().toUpperCase();
    if(!code) return alert('コードを入力してね');

    verifying=true;
    btnVerify.disabled=true;
    showModal('認証を処理中です。少しお待ちください…');
    await new Promise(r=>setTimeout(r,0)); // モーダル描画させる

    try{
      const data=await callGas('redeem',{code,deviceId:getDeviceId()});
      if(data && data.ok){
        if(data.expiresAt) setLocalExpiry(String(data.expiresAt).trim());
        else if(Number.isFinite(Number(data.remainingDays))){
          const d=new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()+Number(data.remainingDays||0));
          setLocalExpiry( ymdFromDate(d) );
        }
        updateExpiryBadge();
        alert('有料版が更新されました');
        if(inp) inp.value='';
      }else{
        alert('認証に失敗しました：' + (data && data.error ? data.error : 'UNKNOWN'));
      }
    }catch(e){
      alert('通信エラー：' + String(e?.message||e));
    }finally{
      hideModal();
      verifying=false;
      btnVerify.disabled=false;
    }
  });

  // {name} 挿入
  document.getElementById('btn-insert-name')?.addEventListener('click', ()=>{
    const ta=document.getElementById('msg-template'); if(!ta) return;
    const s = ta.selectionStart ?? ta.value.length;
    const e = ta.selectionEnd ?? ta.value.length;
    ta.setRangeText('{name}', s, e, 'end');
    ta.dispatchEvent(new Event('input',{bubbles:true}));
    ta.focus();
  });

  // コピーして送信
  document.getElementById('btn-copy')?.addEventListener('click', ()=>{
    const s=getState(); if(!s.selected) return alert('まず顧客を「選ぶ」で選択してね');
    const tpl=document.getElementById('msg-template')?.value||'';
    const text=tpl.replaceAll('{name}', s.selected);
    (async ()=>{
      try{ await navigator.clipboard.writeText(text); }catch{}
      if(navigator.share){ try{ await navigator.share({text}); return; }catch{} }
      location.href='https://line.me/R/msg/text/?'+encodeURIComponent(text);
    })();
  });

  // SW
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('./service-worker.js').catch(()=>{});
  }
});
