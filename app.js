/***** バージョン表示（デバッグ用） *****/
console.warn('[himegoto] app.js v7.0');

/***** 設定（最新のGAS URLに差し替え可） *****/
const GAS_URL = "https://script.google.com/macros/s/AKfycbxJDyUKg5CyEoNAvatG3hgesVNsfYYVfrHrdfx7jMFf97KyyhI6HNJqItdUOzNCQGk/exec";
const DEVICE_ID_KEY = 'himegoto_device_id';
const FREE_LIMIT = 5;

/***** 期限日保存キー（ローカル専用） *****/
const EXP_KEY = 'hime_pro_until_v2';

/***** 端末ID *****/
function getDeviceId(){
  let id=localStorage.getItem(DEVICE_ID_KEY);
  if(!id){ id=self.crypto?.randomUUID?.()||(Date.now()+'-'+Math.random()); localStorage.setItem(DEVICE_ID_KEY,id); }
  return id;
}

/***** GAS呼び出し（プリフライト防止：ヘッダ付けない） *****/
async function callGas(action, payload={}, {retries=0,delay=300}={}){
  const url=`${GAS_URL}?action=${encodeURIComponent(action)}&t=${Date.now()}`;
  const body=JSON.stringify({action, ...payload}); // Content-Type 付けない→プリフライト回避
  for(let i=0;i<=retries;i++){
    try{
      const res=await fetch(url,{method:'POST', body});
      const text=await res.text();
      let data; try{ data=JSON.parse(text);}catch{ data={ok:false,error:'BAD_RESPONSE',raw:text}; }
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
  const today = new Date(); today.setHours(0,0,0,0);
  const end   = new Date(y, m-1, d, 23,59,59,999);
  return Math.max(0, Math.ceil((end - today)/86400000));
}

/***** モーダル *****/
const modalEl = () => document.getElementById('modal');
const modalTextEl = () => document.getElementById('modal-text');
function showModal(msg='処理中です…'){
  const m = modalEl(); if(!m) return;
  if (modalTextEl()) modalTextEl().textContent = msg;
  m.classList.add('show');
  m.setAttribute('aria-hidden','false');
}
function hideModal(){
  const m = modalEl(); if(!m) return;
  m.classList.remove('show');
  m.setAttribute('aria-hidden','true');
}

/***** 状態管理（顧客名簿） *****/
function getState(){ const s=JSON.parse(localStorage.getItem('hime_state')||'{}'); s.customers??=[]; s.selected??=null; return s; }
function setState(s){ localStorage.setItem('hime_state',JSON.stringify(s)); render(); }
function freeLeft(){ const s=getState(); return Math.max(0, FREE_LIMIT - s.customers.length); }

/***** 期限のローカル保持＆表示 *****/
function getLocalExpiry(){ return (localStorage.getItem(EXP_KEY)||'').trim(); }
function setLocalExpiry(ymd){
  if(ymd && /^\d{4}\/\d{2}\/\d{2}$/.test(ymd)){ localStorage.setItem(EXP_KEY, ymd); }
}
function isProActive(){ return daysLeftFromYMD(getLocalExpiry()) > 0; }

function updateExpiryBadge(){
  const badge=document.getElementById('pro-expiry-badge') || document.getElementById('pro-remaining-badge');
  if(!badge) return;
  const ymd = getLocalExpiry();
  const days = daysLeftFromYMD(ymd);
  if(ymd){
    badge.textContent = `有料版：期限 ${ymd}（残り ${days} 日）`;
  }else{
    const label = (badge.id === 'pro-remaining-badge') ? `有料版：残り 0 日` : '有料版：期限 ー';
    badge.textContent = label;
  }
}

/***** UI描画 *****/
function render(){
  const s=getState();

  // 無料枠バッジ
  const freeLeftEl=document.getElementById('free-left');
  if(freeLeftEl) freeLeftEl.textContent=freeLeft();

  // 顧客一覧
  const box=document.getElementById('customer-list'); 
  if(!box) return;
  box.innerHTML='';
  if(!s.customers.length){
    box.innerHTML='<p class="muted">まだいません</p>';
    return;
  }
  s.customers.forEach((nm,idx)=>{
    const row=document.createElement('div'); row.className='customer';
    const name=document.createElement('div'); name.className='nm'; name.textContent=nm;

    const sel=document.createElement('button'); sel.className='btn btn-ghost'; sel.textContent=(s.selected===nm)?'選択中':'選ぶ';
    if(s.selected===nm){ sel.style.background='#2ecc71'; sel.style.color='#fff'; }
    sel.onclick=()=>{ const st=getState(); st.selected=nm; setState(st); };

    const del=document.createElement('button'); del.className='btn btn-danger'; del.textContent='削除';
    del.onclick=()=>{ if(!confirm(`「${nm}」を削除します。`))return; const st=getState(); st.customers.splice(idx,1); if(st.selected===nm) st.selected=null; setState(st); };

    row.append(name,sel,del); box.appendChild(row);
  });
}

/***** 初期化 *****/
document.addEventListener('DOMContentLoaded',()=>{
  // モーダル×
  const modalCancel = document.getElementById('modal-cancel');
  if(modalCancel) modalCancel.onclick = hideModal;

  render();
  updateExpiryBadge();

  // 顧客追加
  const btnAdd = document.getElementById('btn-add');
  if(btnAdd){
    btnAdd.addEventListener('click', ()=>{
      const inp=document.getElementById('name-input');
      const name=(inp?.value||'').trim();
      if(!name) return alert('名前を入れてね');

      const s=getState();
      if(s.customers.includes(name)) return alert('同じ名前があるよ');

      if(!isProActive() && s.customers.length >= FREE_LIMIT){
        return alert('無料枠がいっぱいです');
      }
      s.customers.push(name);
      if(inp) inp.value='';
      setState(s);
    });
  }

  // コード認証（モーダルで二度押し防止）
  const btnVerify = document.getElementById('btn-verify-code');
  let verifying = false;
  if(btnVerify){
    btnVerify.addEventListener('click', async ()=>{
      if (verifying) return;
      const codeInput = document.getElementById('code-input');
      const code=(codeInput?.value||'').trim().toUpperCase();
      if(!code){ alert('コードを入力してね'); return; }

      verifying = true;
      btnVerify.disabled = true;
      showModal('認証を処理中です。少しお待ちください…');
      await new Promise(r=>setTimeout(r,0)); // モーダル確実表示

      try{
        const data = await callGas('redeem',{code,deviceId:getDeviceId()},{retries:0});
        if (data && data.ok){
          if (data.expiresAt && /^\d{4}\/\d{2}\/\d{2}$/.test((data.expiresAt||'').trim())){
            setLocalExpiry((data.expiresAt||'').trim());
          } else if (Number.isFinite(Number(data.remainingDays))){
            const d=new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()+Number(data.remainingDays||0));
            setLocalExpiry( ymdFromDate(d) );
          }
          updateExpiryBadge();
          alert('有料版が更新されました');
          if(codeInput) codeInput.value='';
        }else{
          alert('認証に失敗しました：' + (data && data.error ? data.error : 'UNKNOWN'));
        }
      }catch(e){
        alert(`通信エラー：${e.message||e}`);
      }finally{
        hideModal();
        verifying = false;
        btnVerify.disabled = false;
      }
    });
  }

  // 残日数を再計算
  const btnRecalc = document.getElementById('btn-recalc');
  if(btnRecalc){
    btnRecalc.addEventListener('click', async ()=>{
      try{
        const data = await callGas('status',{deviceId:getDeviceId()},{retries:0});
        const left = Number(data?.remainingDays||0);
        const d=new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()+left);
        setLocalExpiry( ymdFromDate(d) );
        updateExpiryBadge();
      }catch(e){
        alert('再計算に失敗：'+(e.message||e));
      }
    });
  }

  // {name} 挿入
  const btnIns = document.getElementById('btn-insert-name');
  if(btnIns){
    btnIns.addEventListener('click', ()=>{
      const ta=document.getElementById('msg-template');
      if(!ta) return;
      const start = ta.selectionStart ?? ta.value.length;
      const end   = ta.selectionEnd ?? ta.value.length;
      ta.setRangeText('{name}', start, end, 'end');
      ta.dispatchEvent(new Event('input',{bubbles:true}));
      ta.focus();
    });
  }

  // コピー
  const btnCopy = document.getElementById('btn-copy');
  if(btnCopy){
    btnCopy.addEventListener('click', async ()=>{
      const s=getState(); if(!s.selected)return alert('まず顧客を「選ぶ」で選択してね');
      const tpl=document.getElementById('msg-template')?.value||'';
      const text=tpl.replaceAll('{name}',s.selected);
      try{ await navigator.clipboard.writeText(text); alert('コピーしました'); }catch{ alert('コピーできませんでした'); }
    });
  }

  // 共有（LINEに渡す）
  const btnShare = document.getElementById('btn-share');
  if(btnShare){
    btnShare.addEventListener('click', async ()=>{
      const s=getState(); if(!s.selected)return alert('まず顧客を「選ぶ」で選択してね');
      const tpl=document.getElementById('msg-template')?.value||'';
      const text=tpl.replaceAll('{name}',s.selected);

      try{
        if(navigator.share){
          await navigator.share({text});
        }else{
          location.href='https://line.me/R/msg/text/?'+encodeURIComponent(text);
        }
      }catch(e){
        // ユーザーキャンセルなどは無視
      }
    });
  }

  // SW登録（キャッシュ更新用）
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('/service-worker.js?c=v7.1').catch(()=>{});
  }
});
