/* ===== ﾋﾒｺﾞﾄ app.js  =====
   - 起動/復帰/定期で SW を自動update → 新SWは即適用（skipWaiting）→ 自動リロード
   - ヘッダ中央ロゴ / 右側インストールボタン
==================================== */

const $ = (sel, root=document)=>root.querySelector(sel);
const $$ = (sel, root=document)=>Array.from(root.querySelectorAll(sel));

/* ---------- PWA: インストール ---------- */
let deferredPrompt = null;
function isStandalone(){
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}
function ensureInstallButton(){
  const header = $('.header'); if(!header) return;
  let right = header.querySelector('.right');
  if(!right){ right = document.createElement('div'); right.className='right'; header.appendChild(right); }
  let btn = $('#install-btn', right);
  if(!btn){
    btn = document.createElement('button');
    btn.id='install-btn'; btn.className='install-btn'; btn.textContent='インストール'; btn.style.display='none';
    right.appendChild(btn);
  }
  btn.style.display = (!isStandalone() && deferredPrompt) ? 'inline-block' : 'none';
  btn.onclick = async ()=>{
    if(!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice; deferredPrompt=null; ensureInstallButton();
  };
}
window.addEventListener('beforeinstallprompt', (e)=>{ e.preventDefault(); deferredPrompt=e; ensureInstallButton(); });
window.addEventListener('appinstalled', ()=>{ deferredPrompt=null; ensureInstallButton(); });

/* ---------- ヘッダ中央ロゴ ---------- */
function centerLogo(){
  const header=$('.header'); if(!header) return;
  let logo = header.querySelector('.logo-img');
  if(!logo){
    const img = header.querySelector('img[src*="logo_himegoto"]') || header.querySelector('img.logo, img[alt*="himegoto"]');
    if(img){
      img.classList.add('logo-img');
      let wrap = header.querySelector('.logo-wrap');
      if(!wrap){ wrap=document.createElement('div'); wrap.className='logo-wrap'; header.appendChild(wrap); }
      wrap.appendChild(img);
    }
  }
}

/* ---------- SW: 登録 & 自動更新仕組み ---------- */
async function registerSW(){
  if(!('serviceWorker' in navigator)) return null;
  const reg = await navigator.serviceWorker.register('/service-worker.js', { updateViaCache:'none' });

  // 新SWが待機したら即適用
  if(reg.waiting){ reg.waiting.postMessage({type:'SKIP_WAITING'}); }
  reg.addEventListener('updatefound', ()=>{
    const sw = reg.installing;
    if(!sw) return;
    sw.addEventListener('statechange', ()=>{
      if(sw.state==='installed' && reg.waiting){
        reg.waiting.postMessage({type:'SKIP_WAITING'});
      }
    });
  });

  // コントローラ切り替えで一度だけ自動リロード
  navigator.serviceWorker.addEventListener('controllerchange', ()=>{
    if(!window.__reloaded){ window.__reloaded=true; location.reload(); }
  });
  return reg;
}

async function checkForUpdate(reg){
  try{
    reg = reg || await navigator.serviceWorker.getRegistration();
    if(!reg) return;
    await reg.update();                 // 新しいSWがあれば取りに行く
    if(reg.waiting){                    // 取得できたら即適用
      reg.waiting.postMessage({type:'SKIP_WAITING'});
    }
  }catch(_){}
}

/* 起動時・復帰時・定期に更新チェック */
let swReg = null;
let lastCheck = 0;
const CHECK_INTERVAL_MS = 30*60*1000;   // 30分ごと

async function boot(){
  centerLogo();
  ensureInstallButton();
  swReg = await registerSW();

  // 起動時にまず1回
  await checkForUpdate(swReg);

  // 画面復帰時（ホームアイコンから開いた時や他アプリから戻った時）
  document.addEventListener('visibilitychange', async ()=>{
    if(document.visibilityState === 'visible'){
      const now = Date.now();
      if(now - lastCheck > 10*1000){   // 10秒以上空いていれば
        lastCheck = now;
        await checkForUpdate(swReg);
      }
    }
  });

  // 定期チェック（起動中）
  setInterval(()=>{ checkForUpdate(swReg); }, CHECK_INTERVAL_MS);

  // ドロワーに「更新」も追加（手動トリガー用）
  addRefreshMenu(()=>checkForUpdate(swReg));
}

function addRefreshMenu(onClick){
  const ul = $('.drawer .nav'); if(!ul || $('#nav-refresh')) return;
  const li=document.createElement('li'); const b=document.createElement('button');
  b.id='nav-refresh'; b.className='nav-btn'; b.type='button'; b.textContent='更新（最新に入れ替え）';
  b.addEventListener('click', onClick); li.appendChild(b); ul.appendChild(li);
}

document.addEventListener('DOMContentLoaded', boot);
    function loadSelectedMemo(){
      if(!memoArea) return;
      const sel=getSelected(); const mem=getMemos();
      memoArea.value = sel && mem[sel] ? mem[sel] : '';
    }
    
    memoSave?.addEventListener('click', ()=>{
      const sel=getSelected(); if(!sel){ alert('先に顧客を選択してください'); return; }
      const mem=getMemos(); mem[sel]=memoArea.value||''; setMemos(mem); alert('メモを保存しました');
    });
    memoArea?.addEventListener('input', ()=>{
      const sel=getSelected(); if(!sel) return;
      const mem=getMemos(); mem[sel]=memoArea.value||''; setMemos(mem);
    });
    
    function makeBackupString(){
      const payload={ customers:getCustomers(), selected:getSelected(), quota_cnt:load(LS_KEYS.QUOTA_CNT,0), quota_day:load(LS_KEYS.QUOTA_DAY,0), plan:getPlan(), memos:getMemos(), v:'HIME1' };
      const raw=JSON.stringify(payload);
      const b64=btoa(unescape(encodeURIComponent(raw))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
      return 'HIME1.'+b64;
    }
    function parseBackupString(s){
      const m=s&&s.match(/^HIME1\.([A-Za-z0-9\-_]+)$/); if(!m) throw new Error('invalid');
      const b64=m[1].replace(/-/g,'+').replace(/_/g,'/'); const pad=b64.length%4? '==='.slice(b64.length%4):'';
      const json=decodeURIComponent(escape(atob(b64+pad))); return JSON.parse(json);
    }
    const btxt=document.getElementById('backup-text');
    document.getElementById('backup-make')?.addEventListener('click',()=>{ const s=makeBackupString(); if(btxt){ btxt.value=s; btxt.select(); } });
    document.getElementById('backup-copy')?.addEventListener('click', async()=>{ try{ await navigator.clipboard.writeText(btxt?.value||makeBackupString()); alert('バックアップ文字列をコピーしました'); }catch{ alert('コピーできませんでした'); } });
    document.getElementById('backup-restore-text')?.addEventListener('click',()=>{ try{ const d=parseBackupString(btxt?.value||''); save(LS_KEYS.CUSTOMERS, Array.isArray(d.customers)? d.customers:[]); save(LS_KEYS.SELECTED, d.selected??null); save(LS_KEYS.QUOTA_CNT, d.quota_cnt??0); save(LS_KEYS.QUOTA_DAY, d.quota_day??0); if(d.plan) localStorage.setItem(LS_KEYS.PLAN,d.plan); if(d.memos) localStorage.setItem(LS_KEYS.MEMOS, JSON.stringify(d.memos)); renderCustomers(); renderQuota(); updateRegRemain(); loadSelectedMemo(); alert('文字列から復元しました'); }catch(e){ alert('文字列の形式が正しくありません'); } });
    