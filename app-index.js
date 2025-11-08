
/* app-index.js — hardened minimal patch (追加/最小限置換のみ) */
(() => {
  'use strict';

  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  // === de-dupe guard (multi-fire protection) ===
  let lastAct = { key:'', t:0 };
  const onceGuard = (key, span=300) => {
    const now = Date.now();
    if (lastAct.key === key && (now - lastAct.t) < span) return false;
    lastAct = { key, t: now };
    return true;
  };

  // === card/section detection ===
  const findCard = (el) => {
    let n = el;
    while (n && n !== document) {
      if (n.classList && (n.classList.contains('card') || n.classList.contains('section') || n.classList.contains('box'))) return n;
      n = n.parentElement;
    }
    return null;
  };

  // === message textarea (exclude backup areas) ===
  const getMessageArea = () => {
    const first =
      $('#messageInput') ||
      $('textarea#message') ||
      $('textarea[name="message"]') ||
      $('textarea.message') ||
      $('textarea[data-role="message"]');
    if (first) return first;
    const areas = $$('textarea');
    for (const ta of areas) {
      const id  = (ta.id || '').toLowerCase();
      const nm  = (ta.name || '').toLowerCase();
      const ph  = (ta.getAttribute('placeholder') || '').toLowerCase();
      if (id.includes('backup') || nm.includes('backup') || ph.includes('バックアップ') || ph.includes('backup')) continue;
      if (id.includes('message') || nm.includes('message') || ph.includes('メッセージ')) return ta;
    }
    for (const ta of areas) {
      const id  = (ta.id || '').toLowerCase();
      const nm  = (ta.name || '').toLowerCase();
      if (!id.includes('backup') && !nm.includes('backup')) return ta;
    }
    return null;
  };

  // === backup (HIME1. + Base64URL) ===
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

  const collectAllLS = () => {
    const data = {};
    try {
      for (let i=0;i<localStorage.length;i++){ const k = localStorage.key(i); data[k]=localStorage.getItem(k); }
    } catch {}
    return BK_PREFIX + b64url.enc(JSON.stringify({ts:Date.now(), data}));
  };
  const restoreAllLS = (raw) => {
    try {
      if (!raw || !raw.startsWith(BK_PREFIX)) return false;
      const json = b64url.dec(raw.slice(BK_PREFIX.length));
      const o = JSON.parse(json);
      if (!o || !o.data) return false;
      Object.keys(o.data).forEach(k=>{ try{ localStorage.setItem(k, o.data[k]); }catch{} });
      return true;
    } catch { return false; }
  };

  const nearestTextarea = (btn) => {
    const card = findCard(btn);
    if (card) { const ta = card.querySelector('textarea'); if (ta) return ta; }
    return $('#backupText') || $('#backupArea') || $('textarea[name="backup"]') || $('textarea');
  };

  // === {name} literal insert at caret ===
  const insertLiteralNameTag = () => {
    if (!onceGuard('insert_name')) return;
    try {
      const ta = getMessageArea();
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

  // === add customer (input detection expanded) ===
  const readCustomerNameNear = (btn) => {
    const card = findCard(btn) || document;
    const cands = [
      'input#customerName','input#customer','input#name',
      'input[name="customerName"]','input[name="customer"]','input[name="name"]',
      'input.customer-name','input.customer','input.hime-customer',
      'input[type="text"]'
    ];
    for (const sel of cands) {
      const el = card.querySelector(sel);
      if (el && el.value && el.value.trim()) return el;
    }
    return null;
  };

  const addCustomer = (btn) => {
    if (!onceGuard('add_customer')) return;
    try {
      const input = readCustomerNameNear(btn);
      const name = input ? input.value.trim() : '';
      if (!name) return;
      // generic keys (既存互換)
      const KEYS = ['hg_customers_v1','hime_customers','customers'];
      let list = null, keyUsed = null;
      for (const k of KEYS) {
        try {
          const v = localStorage.getItem(k);
          if (v) { list = JSON.parse(v); keyUsed = k; break; }
        } catch {}
      }
      if (!Array.isArray(list)) { list = []; keyUsed = keyUsed || KEYS[0]; }
      if (!list.includes(name)) list.push(name);
      try { localStorage.setItem(keyUsed, JSON.stringify(list)); } catch {}
      // also mark selected (互換キー考慮)
      const SEL_KEYS = ['hg_selected_v1','hime_selected','selected'];
      for (const k of SEL_KEYS) { try { localStorage.setItem(k, JSON.stringify(name)); } catch {} }
      try { window.hime_render && window.hime_render(); } catch {}
      try { input.value=''; } catch {}
    } catch {}
  };

  // === install prompt ===
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt',(e)=>{
    try{
      e.preventDefault();
      deferredPrompt = e;
      const btn = $('#installBtn') || $('button.install') || $('[data-action="install"]');
      if (btn) btn.style.display='';
    }catch{}
  });
  window.addEventListener('appinstalled',()=>{
    try{
      const btn = $('#installBtn') || $('button.install') || $('[data-action="install"]');
      if (btn) btn.style.display='none';
      deferredPrompt=null;
    }catch{}
  });
  const triggerInstall = async()=>{
    if (!onceGuard('install', 800)) return;
    try{
      if(!deferredPrompt) return;
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt=null;
    }catch{}
  };

  // === share (system share sheet if available) ===
  const doShare = () => {
    if (!onceGuard('share', 800)) return;
    try {
      const ta = getMessageArea();
      const text = (ta && ta.value) ? ta.value : '';
      if (navigator.share && text) {
        navigator.share({ text }).catch(()=>{});
      } else if (text) {
        // fallback: クリップボード（UI変更不可のため最低限）
        if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).catch(()=>{});
        else { try { ta.select(); document.execCommand('copy'); } catch {} }
      }
    } catch {}
  };

  // === click delegation (minimal) ===
  document.addEventListener('click', (ev)=>{
    const t = ev.target.closest('button, a');
    if (!t) return;
    const label = (t.textContent||'').trim();

    try {
      // 顧客追加
      if (t.matches('#addBtn,[data-action="add"]') || label === '追加') {
        ev.preventDefault();
        addCustomer(t);
        return;
      }
      // {name} をそのまま挿入
      if (t.matches('#insertNameBtn,[data-action="insert-name"]') || label.includes('{name}')) {
        ev.preventDefault();
        insertLiteralNameTag();
        return;
      }
      // バックアップ作る
      if (t.matches('#makeBackupBtn,[data-action="make-backup"]') || label.includes('文字列を作る') || label.includes('バックアップを作る')) {
        ev.preventDefault();
        const ta = nearestTextarea(t);
        const s = collectAllLS();
        if (ta) { ta.value = s; try{ ta.dispatchEvent(new Event('input',{bubbles:true})); }catch{} }
        return;
      }
      // コピー
      if (t.matches('#copyBackupBtn,[data-action="copy-backup"]') || label === 'コピー') {
        ev.preventDefault();
        const ta = nearestTextarea(t);
        if (!ta || !ta.value) return;
        if (navigator.clipboard?.writeText) navigator.clipboard.writeText(ta.value).catch(()=>{});
        else { try{ ta.select(); document.execCommand('copy'); }catch{} }
        return;
      }
      // 復元
      if (t.matches('#restoreFromTextBtn,[data-action="restore-text"]') || label.includes('文字列から復元') || label.includes('復元する')) {
        ev.preventDefault();
        const ta = nearestTextarea(t);
        if (!ta || !ta.value) return;
        restoreAllLS(ta.value.trim());
        return;
      }
      // インストール
      if (t.matches('#installBtn,[data-action="install"]') || label.includes('インストール')) {
        ev.preventDefault();
        triggerInstall();
        return;
      }
      // 共有（ボタン名が「共有」想定）
      if (t.matches('#shareBtn,[data-action="share"]') || label === '共有') {
        ev.preventDefault();
        doShare();
        return;
      }
    } catch {}
  }, {passive:false});

  // 初期: インストールボタンは非表示（発火で表示）
  try { const b = $('#installBtn') || $('button.install') || $('[data-action="install"]'); if (b) b.style.display='none'; } catch {}

})();
