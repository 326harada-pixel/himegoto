/* =========================
   設定
========================= */
const GAS_URL = "REPLACE_WITH_YOUR_GAS_URL"; // あなたの最新GASウェブアプリURLで置換
const FEEDBACK_LINE_URL = "https://line.me/ti/p/_kahjcCa3-";

const DEVICE_ID_KEY = 'himegoto_device_id';
const EXP_KEY = 'hime_pro_until_v2';        // "YYYY/MM/DD" を保存（JST想定）
const FREE_LIMIT = 5;                        // 1日5回（ベータ：ローカル管理）
const PAGE_SIZE = 10;                        // 顧客一覧の1ページ件数

/* =========================
   端末ID
========================= */
function getDeviceId(){
  let id=localStorage.getItem(DEVICE_ID_KEY);
  if(!id){
    id=self.crypto?.randomUUID?.()||(Date.now()+'-'+Math.random());
    localStorage.setItem(DEVICE_ID_KEY,id);
  }
  return id;
}

/* =========================
   GAS呼び出し（CORS簡易化：ヘッダ付けない）
========================= */
async function callGas(action, payload={}, {retries=0,delay=300}={}){
  const url=`${GAS_URL}?action=${encodeURIComponent(action)}&t=${Date.now()}`;
  const body=JSON.stringify({action, ...payload}); // ヘッダー無＝プリフライト回避
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

/* =========================
   日付ユーティリティ（JST固定）
========================= */
function ymdFromDate_JST(d){
  const j = new Date(d.getTime());
  // JST補正：UTC+9
  const offset = (9 * 60 + j.getTimezoneOffset()) * 60000;
  j.setTime(j.getTime() + offset);
  const y=j.getUTCFullYear(), m=String(j.getUTCMonth()+1).padStart(2,'0'), dd=String(j.getUTCDate()).padStart(2,'0');
  return `${y}/${m}/${dd}`;
}
function daysLeftFromYMD_JST(ymd){
  if(!ymd) return 0;
  const [y,m,d] = ymd.split('/').map(Number);
  if(!y||!m||!d) return 0;
  const now = new Date();
  const todayYMD = ymdFromDate_JST(now);

  // 期限は「当日 23:59:59 JST」まで有効の想定
  const end = new Date(Date.UTC(y, m-1, d, 14, 59, 59, 999)); // JST 23:59:59 = UTC 14:59:59
  const diff = end - now;
  return Math.max(0, Math.ceil(diff/86400000));
}

/* =========================
   モーダル
========================= */
const modalEl = ()=>document.getElementById('modal');
const modalTextEl = ()=>document.getElementById('modal-text');
function showModal(msg='処理中です…'){
  const m=modalEl(); if(!m) return;
  if(modalTextEl()) modalTextEl().textContent = msg;
  m.classList.add('show'); m.setAttribute('aria-hidden','false');
}
function hideModal(){ const m=modalEl(); if(!m) return; m.classList.remove('show'); m.setAttribute('aria-hidden','true'); }

/* =========================
   状態とストレージ
========================= */
function getState(){
  const s=JSON.parse(localStorage.getItem('hime_state')||'{}');
  s.customers ??= [];     // 顧客配列
  s.selected  ??= null;   // 選択中の名前
  s.page      ??= 1;      // 現在ページ
  s.sentToday ??= {};     // 本日送信済みの顧客名（後ろ回し用）
  return s;
}
function setState(s){ localStorage.setItem('hime_state',JSON.stringify(s)); render(); }

function getLocalExpiry(){ return (localStorage.getItem(EXP_KEY)||'').trim(); }
function setLocalExpiry(ymd){ if(ymd && /^\d{4}\/\d{2}\/\d{2}$/.test(ymd)) localStorage.setItem(EXP_KEY, ymd); }

/* “１日５回”カウンタ（ローカル） */
function todayKey(){ return ymdFromDate_JST(new Date()); }
function getFreeCount(){
  const key='free_count_'+todayKey();
  return parseInt(localStorage.getItem(key)||'0',10);
}
function incFreeCount(){
  const key='free_count_'+todayKey();
  localStorage.setItem(key, String(getFreeCount()+1));
}
function resetFreeCountIfNewDay(){
  // 日付が変われば key も変わるので何もしなくてOK
}

/* =========================
   UI描画
========================= */
function render(){
  const s=getState();

  // 残回数
  const leftEl=document.getElementById('free-left');
  if(leftEl){
    const used=getFreeCount();
    leftEl.textContent = Math.max(0, FREE_LIMIT - used);
  }

  // 期限バッジ
  const badge=document.getElementById('pro-expiry-badge');
  if(badge){
    const ymd=getLocalExpiry();
    const days=daysLeftFromYMD_JST(ymd);
    badge.textContent = ymd ? `有料版：期限 ${ymd}` : `有料版：期限 ー`;
  }

  // 顧客リスト（ページング）
  const list=document.getElementById('customer-list');
  const pageInd=document.getElementById('page-indicator');
  const btnPrev=document.getElementById('btn-prev');
  const btnNext=document.getElementById('btn-next');

  if(list){
    list.innerHTML='';
    const total=s.customers.length;
    const totalPages=Math.max(1, Math.ceil(total / PAGE_SIZE));
    s.page = Math.min(Math.max(1, s.page), totalPages);

    const start=(s.page-1)*PAGE_SIZE;
    const rows=s.customers.slice(start, start+PAGE_SIZE);

    if(rows.length===0){
      list.innerHTML = '<p class="muted">まだいません</p>';
    }else{
      rows.forEach((nm, idx)=>{
        const row=document.createElement('div'); row.className='customer';
        const name=document.createElement('div'); name.className='nm'; name.textContent=nm;

        const sel=document.createElement('button'); sel.className='btn btn-ghost'; sel.textContent=(s.selected===nm)?'選択中':'選ぶ';
        if(s.selected===nm){ sel.style.background='#2ecc71'; sel.style.color='#fff'; }
        sel.onclick=()=>{ s.selected=nm; setState(s); };

        const del=document.createElement('button'); del.className='btn btn-danger'; del.textContent='削除';
        del.onclick=()=>{ if(!confirm(`「${nm}」を削除します。`))return; 
          const absIdx = start + idx;
          s.customers.splice(absIdx,1);
          if(s.selected===nm) s.selected=null;
          setState(s);
        };

        row.append(name, sel, del);
        list.appendChild(row);
      });
    }

    // ページング制御
    if(pageInd) pageInd.textContent = `${s.page} / ${Math.max(1, Math.ceil(total / PAGE_SIZE))}`;
    if(btnPrev) { btnPrev.disabled = (s.page<=1); btnPrev.onclick=()=>{ s.page=Math.max(1, s.page-1); setState(s); }; }
    if(btnNext) { btnNext.disabled = (s.page>=totalPages); btnNext.onclick=()=>{ s.page=Math.min(totalPages, s.page+1); setState(s); }; }
  }
}

/* 期限バッジをサーバ基準に同期（成功したらローカル更新） */
async function syncExpiryFromServer(){
  try{
    const data = await callGas('status',{deviceId:getDeviceId()},{retries:1});
    // data.expiresAt が "YYYY/MM/DD" で来る想定（なければ remainingDays から算出）
    if(data && (data.expiresAt || typeof data.remainingDays === 'number')){
      if(data.expiresAt && /^\d{4}\/\d{2}\/\d{2}$/.test(data.expiresAt)){
        setLocalExpiry(data.expiresAt.trim());
      }else{
        const d=new Date(); d.setHours(0,0,0,0);
        d.setDate(d.getDate() + Number(data.remainingDays||0));
        setLocalExpiry( ymdFromDate_JST(d) );
      }
    }
  }catch(e){
    // 失敗時はローカル表示のまま
    console.warn('status sync failed', e);
  }finally{
    render();
  }
}

/* =========================
   初期化
========================= */
document.addEventListener('DOMContentLoaded', ()=>{
  resetFreeCountIfNewDay();
  render();
  // 期限をサーバ基準で上書き同期
  syncExpiryFromServer();

  // 規約
  document.getElementById('btn-open-terms')?.addEventListener('click', ()=>{
    location.href = 'terms.html';
  });

  // ご意見LINE
  document.getElementById('btn-feedback')?.addEventListener('click', ()=>{
    window.open(FEEDBACK_LINE_URL, '_blank');
  });

  // 顧客追加
  document.getElementById('btn-add')?.addEventListener('click', ()=>{
    const inp=document.getElementById('name-input');
    const name=(inp?.value||'').trim();
    if(!name) return alert('名前を入れてね');

    const s=getState();
    if(s.customers.includes(name)) return alert('同じ名前があるよ');
    // 無料枠チェック：送信ではなく登録は無制限（要望あれば変更可）
    s.customers.push(name);
    if(inp) inp.value='';
    setState(s);
  });

  // {name} 挿入
  document.getElementById('btn-insert-name')?.addEventListener('click', ()=>{
    const ta=document.getElementById('msg-template');
    if(!ta) return;
    const start = ta.selectionStart ?? ta.value.length;
    const end   = ta.selectionEnd ?? ta.value.length;
    ta.setRangeText('{name}', start, end, 'end');
    ta.dispatchEvent(new Event('input',{bubbles:true}));
    ta.focus();
  });

  // 送信（共有API→LINEテキストURLフォールバック）
  document.getElementById('btn-send')?.addEventListener('click', async ()=>{
    const s=getState();
    if(!s.selected) return alert('まず顧客を「選ぶ」で選択してね');

    // 無料カウント（ローカル）：有料期限内ならカウント不要
    const isPro = daysLeftFromYMD_JST(getLocalExpiry()) > 0;
    if(!isPro){
      const used=getFreeCount();
      if(used >= FREE_LIMIT) return alert('無料版の本日回数が上限に達しました');
    }

    const tpl=document.getElementById('msg-template')?.value||'';
    const text=tpl.replaceAll('{name}', s.selected).trim();
    if(!text) return alert('本文が空です');

    // 確認ダイアログ（誤送信防止）
    const ok = confirm(`「${s.selected}」へ送信します。よろしいですか？\n\n--- 送信内容 ---\n${text.substring(0,120)}${text.length>120?'…':''}`);
    if(!ok) return;

    // 共有
    try{
      if(navigator.share){
        await navigator.share({text});
      }else{
        location.href='https://line.me/R/msg/text/?'+encodeURIComponent(text);
      }
    }catch(e){
      // ユーザーキャンセルなどは無視
      return;
    }

    // 送信後の処理：無料カウント増加・顧客を後ろへ回す（当日中）
    if(!isPro) incFreeCount();
    // 後ろへ回す
    const idx = s.customers.indexOf(s.selected);
    if(idx>=0){
      const [nm] = s.customers.splice(idx,1);
      s.customers.push(nm);
    }
    setState(s);
  });

  // コード認証（二度押し防止＋モーダル）
  let verifying=false;
  document.getElementById('btn-verify-code')?.addEventListener('click', async ()=>{
    if(verifying) return;
    const code=(document.getElementById('code-input')?.value||'').trim().toUpperCase();
    if(!code) return alert('コードを入力してね');

    verifying=true;
    showModal('認証を処理中です。少しお待ちください…');
    await new Promise(r=>setTimeout(r,0)); // モーダル描画を確実に

    try{
      const data = await callGas('redeem',{code, deviceId:getDeviceId()},{retries:0});
      if(data && data.ok){
        // expiresAt 優先、なければ remainingDays から算出
        if(data.expiresAt && /^\d{4}\/\d{2}\/\d{2}$/.test(data.expiresAt)){
          setLocalExpiry(data.expiresAt.trim());
        }else if(typeof data.remainingDays === 'number'){
          const d=new Date(); d.setHours(0,0,0,0);
          d.setDate(d.getDate() + Number(data.remainingDays||0));
          setLocalExpiry( ymdFromDate_JST(d) );
        }
        render();
        alert('有料版が更新されました');
        const inp=document.getElementById('code-input'); if(inp) inp.value='';
      }else{
        alert('認証に失敗しました：' + (data?.error||'UNKNOWN'));
      }
    }catch(e){
      alert(`通信エラー：${e.message||e}`);
    }finally{
      hideModal(); verifying=false;
    }
  });

  // SW登録（静的のみキャッシュ、APIは毎回ネット）
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('./service-worker.js').catch(()=>{});
  }

});