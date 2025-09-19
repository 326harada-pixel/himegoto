/***** バージョン表示 *****/
console.warn('[himegoto] app.js v-send-daily-5-jst+reset');

/***** 設定（GAS の最新URL） *****/
const GAS_URL = "https://script.google.com/macros/s/AKfycbxJDyUKg5CyEoNAvatG3hgesVNsfYYVfrHrdfx7jMFf97KyyhI6HNJqItdUOzNCQGk/exec";
const DEVICE_ID_KEY = 'himegoto_device_id';

/***** 無料版の上限 *****/
const FREE_CUSTOMER_LIMIT   = 5; // 顧客登録 上限
const FREE_SEND_DAILY_LIMIT = 5; // 送信（共有）1日あたり 上限

/***** ローカル保存キー *****/
const EXP_KEY        = 'hime_pro_until_v2'; // Pro期限 YYYY/MM/DD
const SEND_DAY_KEY   = 'hime_send_day_v1';  // 送信カウントの対象日（JST, YYYY-MM-DD）
const SEND_COUNT_KEY = 'hime_send_cnt_v1';  // 当日の送信カウント

/***** JST の“今日”を作るユーティリティ（端末タイムゾーンに依存しない） *****/
function todayJST() {
  // 現在のUTCミリ秒に +9時間（JST）してから日付をとる
  const now = new Date();
  const jstMs = now.getTime() + 9*60*60*1000;
  return new Date(jstMs);
}
function todayJST_YMD() {
  const d = todayJST();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth()+1).padStart(2,'0');
  const dd= String(d.getUTCDate()).padStart(2,'0');
  return `${y}-${m}-${dd}`; // 例: 2025-09-19
}

/***** 端末ID *****/
function getDeviceId(){
  let id=localStorage.getItem(DEVICE_ID_KEY);
  if(!id){ id=self.crypto?.randomUUID?.()||(Date.now()+'-'+Math.random()); localStorage.setItem(DEVICE_ID_KEY,id); }
  return id;
}

/***** GAS呼び出し（プリフライト回避：ヘッダ無し） *****/
async function callGas(action, payload={}, {retries=0,delay=300}={}){
  const url=`${GAS_URL}?action=${encodeURIComponent(action)}&t=${Date.now()}`;
  const body=JSON.stringify({action, ...payload});
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

/***** 日付系（残日数表示用） *****/
function daysLeftFromYMD(ymd){
  if(!ymd) return 0;
  const [y,m,d] = ymd.split('/').map(Number);
  if(!y||!m||!d) return 0;
  const today = new Date(); today.setHours(0,0,0,0);
  const end   = new Date(y, m-1, d, 23,59,59,999);
  return Math.max(0, Math.ceil((end - today)/86400000));
}

/***** Pro期限（ローカル保持） *****/
function getLocalExpiry(){ return (localStorage.getItem(EXP_KEY)||'').trim(); }
function setLocalExpiry(ymd){ if(ymd && /^\d{4}\/\d{2}\/\d{2}$/.test(ymd)) localStorage.setItem(EXP_KEY, ymd); }
function isProActive(){ return daysLeftFromYMD(getLocalExpiry()) > 0; }
function updateExpiryBadgeFromServer(data){
  const badge=document.getElementById('pro-expiry-badge')||document.getElementById('pro-remaining-badge');
  if(!badge) return;
  const ymd = (data && data.expiresAt)||'';
  const dl  = Number(data && data.daysLeft || 0);
  if(ymd){ setLocalExpiry(ymd); }
  badge.textContent = ymd ? `有料版：期限 ${ymd}（残り ${dl} 日）` : '有料版：期限 ー';
}

/***** 無料送信カウンタ（JSTで日次リセット） *****/
function ensureDailyBucket(){
  const today = todayJST_YMD();
  const savedDay = localStorage.getItem(SEND_DAY_KEY);
  if (savedDay !== today) {
    localStorage.setItem(SEND_DAY_KEY, today);
    localStorage.setItem(SEND_COUNT_KEY, '0');
  }
}
function getSendCount(){
  ensureDailyBucket();
  return parseInt(localStorage.getItem(SEND_COUNT_KEY)||'0',10)||0;
}
function setSendCount(n){
  ensureDailyBucket();
  localStorage.setItem(SEND_COUNT_KEY, String(Math.max(0, n|0)));
  updateSendLeft();
}
function incSendCount(){ setSendCount(getSendCount()+1); }
function decSendCount(){ setSendCount(getSendCount()-1); }
function sendLeft(){
  ensureDailyBucket();
  return Math.max(0, FREE_SEND_DAILY_LIMIT - getSendCount());
}
function updateSendLeft(){
  const el=document.getElementById('send-left');
  if(el) el.textContent = sendLeft();
}

/***** 名簿の状態管理 *****/
function getState(){ const s=JSON.parse(localStorage.getItem('hime_state')||'{}'); s.customers??=[]; s.selected??=null; return s; }
function setState(s){ localStorage.setItem('hime_state',JSON.stringify(s)); render(); }
function freeLeft(){ const s=getState(); return Math.max(0, FREE_CUSTOMER_LIMIT - s.customers.length); }

/***** UI描画 *****/
function render(){
  const s=getState();
  const freeLeftEl=document.getElementById('free-left');
  if(freeLeftEl) freeLeftEl.textContent=freeLeft();

  const box=document.getElementById('customer-list');
  if(!box) return;
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

/***** モーダル（認証中） *****/
const modalEl = () => document.getElementById('modal');
const modalTextEl = () => document.getElementById('modal-text');
function showModal(msg='処理中です…'){
  const m = modalEl(); if(!m) return;
  if (modalTextEl()) modalTextEl().textContent = msg;
  m.classList.add('show'); m.setAttribute('aria-hidden','false');
}
function hideModal(){ const m=modalEl(); if(!m) return; m.classList.remove('show'); m.setAttribute('aria-hidden','true'); }

/***** 初期化 *****/
document.addEventListener('DOMContentLoaded', ()=>{
  // 日次バケット初期化 → 残回数UI反映
  ensureDailyBucket();
  updateSendLeft();

  // 名簿UI
  render();

  // 起動時：サーバ確定値で Pro 表示更新
  callGas('status',{deviceId:getDeviceId()})
    .then(updateExpiryBadgeFromServer)
    .catch(()=>{});

  // 顧客追加（★「リセット」/ "reset" で当日の送信回数を0に戻すギミックを追加）
  const btnAdd = document.getElementById('btn-add');
  if(btnAdd){
    btnAdd.onclick=()=>{
      const inp=document.getElementById('name-input'); 
      const name=(inp?.value||'').trim(); 
      if(!name) return alert('名前を入れてね');

      // ★ リセット・ギミック：顧客は追加せず、当日の送信回数だけ0に
      if (name === 'リセット' || name.toLowerCase() === 'reset') {
        setSendCount(0); // ensureDailyBucket() と UI更新は setSendCount 内で実行
        alert('送信回数をリセットしました。（本日 0/5）');
        if (inp) inp.value = '';
        return;
      }

      const s=getState(); 
      if(s.customers.includes(name)) return alert('同じ名前があるよ');
      if(!isProActive() && s.customers.length>=FREE_CUSTOMER_LIMIT) return alert('無料枠がいっぱいです');
      s.customers.push(name); 
      if(inp) inp.value=''; 
      setState(s);
    };
  }

  // {name} 挿入
  const btnIns=document.getElementById('btn-insert-name');
  if(btnIns){
    btnIns.onclick=()=>{
      const ta=document.getElementById('msg-template');
      if(!ta) return;
      const start = ta.selectionStart ?? ta.value.length;
      const end   = ta.selectionEnd ?? ta.value.length;
      ta.setRangeText('{name}', start, end, 'end');
      ta.dispatchEvent(new Event('input',{bubbles:true}));
      ta.focus();
    };
  }

  // 共有（送信回数：JSTで1日5回に制御。キャンセル時ロールバック）
  const btnShare = document.getElementById('btn-share');
  if(btnShare){
    let sharing = false;
    btnShare.onclick = async ()=>{
      if(sharing) return;
      const s=getState(); if(!s.selected) return alert('まず顧客を「選ぶ」で選択してね');

      // Pro は無制限 / 無料は当日残回数チェック
      if(!isProActive()){
        ensureDailyBucket();
        if (sendLeft()<=0) return alert('無料版の本日送信回数（5回）を使い切りました');
      }

      const tpl=document.getElementById('msg-template')?.value||'';
      const text=tpl.replaceAll('{name}', s.selected).trim();
      if(!text) return alert('本文が空です');

      sharing = true;
      btnShare.disabled = true;

      // 無料版は押下時に先行カウント（多重押し対策）。shareキャンセル時のみロールバック。
      let counted = false;
      if(!isProActive()){
        incSendCount();
        counted = true;
      }

      try{
        if(navigator.share){
          await navigator.share({ text });
          // 成功：カウント維持
        }else{
          // フォールバック（LINE URL）は戻りが取れないためカウント維持
          location.href = 'https://line.me/R/msg/text/?' + encodeURIComponent(text);
        }
      }catch(err){
        // キャンセルのみロールバック
        if(counted){ decSendCount(); }
      }finally{
        // ボタン復帰
        setTimeout(()=>{ btnShare.disabled = false; sharing = false; }, 600);
      }
    };
  }

  // コード認証（モーダルで二度押し防止）
  const btnVerify = document.getElementById('btn-verify-code');
  if(btnVerify){
    let verifying=false;
    btnVerify.onclick = async ()=>{
      if(verifying) return;
      const code=(document.getElementById('code-input')?.value||'').trim().toUpperCase();
      if(!code) return alert('コードを入力してね');

      verifying=true; btnVerify.disabled=true; showModal('認証を処理中です。少しお待ちください…');
      await new Promise(r=>setTimeout(r,0));
      try{
        const data=await callGas('redeem',{code,deviceId:getDeviceId()});
        updateExpiryBadgeFromServer(data);
        alert('有料版が更新されました');
        (document.getElementById('code-input')||{}).value='';
      }catch(e){
        alert('認証に失敗：'+(e.message||e));
      }finally{
        hideModal(); verifying=false; btnVerify.disabled=false;
      }
    };
  }

  // 残日数バッジの手動更新
  const btnRecalc = document.getElementById('btn-recalc');
  if(btnRecalc){
    btnRecalc.onclick = ()=>{
      callGas('status',{deviceId:getDeviceId()})
        .then(updateExpiryBadgeFromServer)
        .catch(()=>{});
    };
  }

  // ご意見ボタン（任意）
  const fb=document.getElementById('feedback-btn');
  if(fb){ fb.onclick=()=>{ location.href='https://line.me/ti/p/_kahjcCa3-'; }; }

  // SW登録（任意）
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('./service-worker.js').catch(()=>{});
  }
});