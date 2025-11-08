
/* app-index.js — fail-safe event layer (最上位ルール順守: 追加/最小限置換のみ) */
(() => {
  'use strict';
  if (window.__HG_EVT_PATCHED__) return;
  window.__HG_EVT_PATCHED__ = true;

  const $  = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  const last = new Map();
  const once = (key, ms=300) => {
    const now = Date.now();
    const t = last.get(key)||0;
    if (now - t < ms) return false;
    last.set(key, now);
    return true;
  };

  const findCard = (el) => {
    let n = el;
    while (n && n !== document) {
      if (n.classList && (n.classList.contains('card') || n.classList.contains('section') || n.classList.contains('box') || n.classList.contains('panel'))) return n;
      n = n.parentElement;
    }
    return document;
  };

  const getLocalMessageArea = (btn) => {
    const root = findCard(btn);
    const explicit = root.querySelector('#messageInput, textarea#message, textarea[name="message"], textarea.message, textarea[data-role="message"]');
    if (explicit) return explicit;
    const areas = Array.from(root.querySelectorAll('textarea'));
    const score = (ta) => {
      let s = 0;
      const id  = (ta.id || '').toLowerCase();
      const nm  = (ta.name || '').toLowerCase();
      const ph  = (ta.getAttribute('placeholder') || '').toLowerCase();
      const lab = (ta.previousElementSibling && ta.previousElementSibling.textContent || '').toLowerCase();
      if (id.includes('backup') || nm.includes('backup') || ph.includes('backup') || ph.includes('バックアップ') || lab.includes('バックアップ')) s -= 10;
      if (id.includes('message') || nm.includes('message') || ph.includes('メッセージ') || ph.includes('message') || lab.includes('メッセージ')) s += 5;
      const rows = parseInt(ta.getAttribute('rows')||'0',10);
      if (rows && rows <= 5) s += 1;
      return s;
    };
    let best=null, bestScore=-1e9;
    for (const ta of areas) {
      const sc = score(ta);
      if (sc > bestScore) { bestScore=sc; best=ta; }
    }
    return best;
  };

  const getLocalBackupArea = (btn) => {
    const root = findCard(btn);
    const areas = Array.from(root.querySelectorAll('textarea'));
    if (!areas.length) return null;
    const score = (ta) => {
      let s = 0;
      const id  = (ta.id || '').toLowerCase();
      const nm  = (ta.name || '').toLowerCase();
      const ph  = (ta.getAttribute('placeholder') || '').toLowerCase();
      const lab = (ta.previousElementSibling && ta.previousElementSibling.textContent || '').toLowerCase();
      if (id.includes('backup') || nm.includes('backup') || ph.includes('backup') || ph.includes('バックアップ') || lab.includes('バックアップ')) s += 10;
      const rows = parseInt(ta.getAttribute('rows')||'0',10);
      if (rows && rows >= 6) s += 2;
      return s;
    };
    let best=null, bestScore=-1e9;
    for (const ta of areas) {
      const sc = score(ta);
      if (sc > bestScore) { bestScore=sc; best=ta; }
    }
    return (bestScore >= 5) ? best : null;
  };

  const BK_PREFIX = 'HIME1.';
  const b64url = {
    enc(str){
      try { return btoa(unescape(encodeURIComponent(str))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
      catch(_){
        const bytes = new TextEncoder().encode(str);
        let bin=''; bytes.forEach(b=>bin+=String.fromCharCode(b));
        return btoa(bin).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
      }
    },
    dec(data){
      let s = (data||'').replace(/-/g,'+').replace(/_/g,'/');
      while (s.length%4) s+='=';
      try { return decodeURIComponent(escape(atob(s))); }
      catch(_){
        const bin = atob(s);
        const u8 = new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) u8[i]=bin.charCodeAt(i);
        return new TextDecoder().decode(u8);
      }
    }
  };
  const collectAll = () => {
    const data = {};
    try { for (let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); data[k]=localStorage.getItem(k); } } catch {}
    return BK_PREFIX + b64url.enc(JSON.stringify({ts:Date.now(), data}));
  };
  const restoreAll = (raw) => {
    try {
      if (!raw || !raw.startsWith(BK_PREFIX)) return false;
      const json = b64url.dec(raw.slice(BK_PREFIX.length));
      const o = JSON.parse(json);
      if (!o || !o.data) return false;
      Object.keys(o.data).forEach(k=>{ try{ localStorage.setItem(k, o.data[k]); }catch{} });
      return true;
    } catch { return false; }
  };

  const insertLiteralNameTag = (btn) => {
    if (!once('insert_name', 250)) return;
    try {
      const ta = getLocalMessageArea(btn);
      if (!ta) return;
      const tag = '{name}';
      const start = ta.selectionStart ?? (ta.value||'').length;
      const end   = ta.selectionEnd   ?? (ta.value||'').length;
      const v = ta.value || '';
      ta.value = v.slice(0,start) + tag + v.slice(end);
      const pos = start + tag.length;
      try { ta.setSelectionRange(pos, pos); } catch {}
      try { ta.dispatchEvent(new Event('input',{bubbles:true})); } catch {}
    } catch {}
  };

  const addCustomer = (btn) => {
    if (!once('add_customer', 300)) return;
    try {
      const root = findCard(btn);
      const inputs = Array.from(root.querySelectorAll('input[type="text"], input:not([type])'));
      let best=null;
      const score = (inp) => {
        let s=0;
        const id=(inp.id||'').toLowerCase(), nm=(inp.name||'').toLowerCase(), ph=(inp.placeholder||'').toLowerCase();
        if (id.includes('customer')||nm.includes('customer')||ph.includes('顧客')||ph.includes('お客')) s+=5;
        if (id.includes('name')||nm.includes('name')||ph.includes('名前')) s+=2;
        return s;
      };
      for (const inp of inputs){ if (!inp.value || !inp.value.trim()) continue; const sc=score(inp); if (!best || sc>best.sc){ best={el:inp, sc}; } }
      const input = best && best.el;
      const name = input ? input.value.trim() : '';
      if (!name) return;

      const keys = ['hg_customers_v1','hime_customers','customers'];
      let list=null, useKey=keys[0];
      for (const k of keys){ try{ const v=localStorage.getItem(k); if (v){ list=JSON.parse(v); useKey=k; break; } }catch{} }
      if (!Array.isArray(list)) list=[];
      if (!list.includes(name)) list.push(name);
      try { localStorage.setItem(useKey, JSON.stringify(list)); } catch {}
      const selKeys = ['hg_selected_v1','hime_selected','selected'];
      for (const k of selKeys){ try{ localStorage.setItem(k, JSON.stringify(name)); } catch{} }
      try { window.hime_render && window.hime_render(); } catch {}
      try { input && (input.value=''); } catch {}
    } catch {}
  };

  const doShare = (btn) => {
    if (!once('share', 600)) return;
    try {
      const ta = getLocalMessageArea(btn);
      const text = (ta && ta.value) ? ta.value : '';
      if (!text) return;
      if (navigator.share) navigator.share({ text }).catch(()=>{});
      else if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).catch(()=>{});
      else { try{ ta.select(); document.execCommand('copy'); }catch{} }
    } catch {}
  };

  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt',(e)=>{
    try{ e.preventDefault(); deferredPrompt = e;
      const b = $('#installBtn') || $('button.install') || $('[data-action="install"]');
      if (b) b.style.display='';
    }catch{}
  });
  window.addEventListener('appinstalled',()=>{
    try{ const b = $('#installBtn') || $('button.install') || $('[data-action="install"]');
      if (b) b.style.display='none'; deferredPrompt=null;
    }catch{}
  });
  const triggerInstall = async()=>{
    if (!once('install', 800)) return;
    try{ if(!deferredPrompt) return; deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt=null; }catch{}
  };

  const isLabel = (el, re) => re.test((el.textContent||'').trim());
  const closestBtn = (el) => el.closest('button, a, [role="button"], .btn, .button, .tap, [data-action]');

  document.addEventListener('click', (ev)=>{
    const t = closestBtn(ev.target);
    if (!t) return;
    try {
      if (t.matches('#addBtn,[data-action="add"]') || isLabel(t, /追加/)) { ev.preventDefault(); addCustomer(t); return; }
      if (t.matches('#insertNameBtn,[data-action="insert-name"]') || isLabel(t, /\{name\}|差し?込/)) { ev.preventDefault(); insertLiteralNameTag(t); return; }
      if (t.matches('#makeBackupBtn,[data-action="make-backup"]') || isLabel(t, /(文字列を作る|バックアップを作る|作成)/)) {
        ev.preventDefault();
        const ta = getLocalBackupArea(t);
        if (ta) { const s = collectAll(); ta.value = s; try{ ta.dispatchEvent(new Event('input',{bubbles:true})); }catch{} }
        return;
      }
      if (t.matches('#copyBackupBtn,[data-action="copy-backup"]') || isLabel(t, /コピー/)) {
        ev.preventDefault();
        const ta = getLocalBackupArea(t);
        if (ta && ta.value) {
          if (navigator.clipboard?.writeText) navigator.clipboard.writeText(ta.value).catch(()=>{});
          else { try{ ta.select(); document.execCommand('copy'); }catch{} }
        }
        return;
      }
      if (t.matches('#restoreFromTextBtn,[data-action="restore-text"]') || isLabel(t, /(文字列から復元|復元する|復元)/)) {
        ev.preventDefault();
        const ta = getLocalBackupArea(t);
        if (ta && ta.value) restoreAll(ta.value.trim());
        return;
      }
      if (t.matches('#shareBtn,[data-action="share"]') || isLabel(t, /共有|シェア/)) { ev.preventDefault(); doShare(t); return; }
      if (t.matches('#installBtn,[data-action="install"]') || isLabel(t, /インストール/)) { ev.preventDefault(); triggerInstall(); return; }
    } catch {}
  }, {passive:false});

  try { const b = $('#installBtn') || $('button.install') || $('[data-action="install"]'); if (b) b.style.display='none'; } catch {}

})();
