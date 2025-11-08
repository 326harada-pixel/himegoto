/* app-index.js (safe add-on)
 * - Strictly additive: does not remove or restructure existing DOM
 * - Robust event delegation: works even if element IDs differ
 * - Backup: Base64URL (prefix HIME1.)
 * - Restore merges into localStorage; does not delete unknown keys
 * - Install button wiring (id=installBtn or text 'インストール')
 */
(function(){
  'use strict';

  // --- small utilities ---
  const d = document;
  const $ = (sel, root) => (root||d).querySelector(sel);
  const $$ = (sel, root) => Array.from((root||d).querySelectorAll(sel));
  const on = (root, evt, selectorOrHandler, handler) => {
    // if handler omitted, attach directly
    if (typeof selectorOrHandler === 'function') {
      root.addEventListener(evt, (e)=>{ try{ selectorOrHandler(e); }catch(_){} }, {passive:false});
    } else {
      root.addEventListener(evt, (e)=>{
        const t = e.target.closest(selectorOrHandler);
        if (t && root.contains(t)) { try{ handler.call(t, e); }catch(_){ /* swallow */ } }
      }, {passive:false});
    }
  };

  const b64urlEncode = (str) => {
    try {
      return btoa(unescape(encodeURIComponent(str))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    } catch(e) {
      // fallback per-character
      const utf8 = new TextEncoder().encode(str);
      let bin='';
      utf8.forEach(b=>bin+=String.fromCharCode(b));
      return btoa(bin).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    }
  };
  const b64urlDecode = (data) => {
    data = (data||'').replace(/-/g,'+').replace(/_/g,'/');
    while (data.length % 4) data += '=';
    try {
      return decodeURIComponent(escape(atob(data)));
    } catch(e) {
      const bin = atob(data);
      const buf = new Uint8Array(bin.length);
      for (let i=0;i<bin.length;i++) buf[i]=bin.charCodeAt(i);
      return new TextDecoder().decode(buf);
    }
  };

  // --- backup core ---
  const BK_PREFIX = 'HIME1.';
  const isHimeString = (s) => typeof s === 'string' && s.startsWith(BK_PREFIX);

  const collect = () => {
    // collect known important keys first (if存在), then the rest
    const keys = [];
    try {
      for (let i=0;i<localStorage.length;i++){
        const k = localStorage.key(i);
        keys.push(k);
      }
    } catch(_){}
    const obj = { _ts: Date.now(), _ver:'1', data:{} };
    keys.forEach(k=>{
      try {
        obj.data[k] = localStorage.getItem(k);
      } catch(_){}
    });
    return obj;
  };

  const makeString = () => {
    const json = JSON.stringify(collect());
    return BK_PREFIX + b64urlEncode(json);
  };

  const putIntoArea = (text) => {
    // Try common selectors
    const area = $('#backupText') || $('#backupArea') ||
                 document.querySelector('textarea[name="backup"]') ||
                 document.querySelector('textarea');
    if (area) {
      area.value = text;
      try { area.dispatchEvent(new Event('input',{bubbles:true})); }catch(_){}
      return true;
    }
    return false;
  };

  const readFromArea = () => {
    const area = $('#backupText') || $('#backupArea') ||
                 document.querySelector('textarea[name="backup"]') ||
                 document.querySelector('textarea');
    return area ? (area.value || '') : '';
  };

  const restoreFromString = (raw) => {
    let s = raw || readFromArea();
    if (!s) return false;
    if (!isHimeString(s)) return false;
    try {
      const json = b64urlDecode(s.slice(BK_PREFIX.length));
      const payload = JSON.parse(json);
      const data = payload && payload.data || {};
      Object.keys(data).forEach(k=>{
        try { localStorage.setItem(k, data[k]); } catch(_){}
      });
      return true;
    } catch(_){ return false; }
  };

  const copyText = async (t) => {
    try {
      await navigator.clipboard.writeText(t);
      return true;
    } catch(_){
      // fallback
      const ok = putIntoArea(t);
      if (ok) {
        const sel = document.getSelection();
        const area = $('#backupText') || $('#backupArea') || document.querySelector('textarea[name="backup"]') || document.querySelector('textarea');
        if (area) { area.select(); try{ document.execCommand('copy'); }catch(_){ } }
      }
      return false;
    }
  };

  // --- wire buttons (event delegation; no reliance on specific IDs) ---
  on(document, 'click', (e)=>{
    const btn = e.target.closest('button, [role="button"]');
    if (!btn) return;

    const label = (btn.getAttribute('data-action') || btn.id || btn.textContent || '').trim();

    // make string
    if (/(make\-string|makeStr|文字列を作る|バックアップを作る)/.test(label)) {
      e.preventDefault();
      try {
        const s = makeString();
        putIntoArea(s);
      } catch(_){}
      return;
    }

    // copy
    if (/(copy\-string|copyStr|コピー)/.test(label)) {
      e.preventDefault();
      const s = readFromArea() || makeString();
      copyText(s);
      return;
    }

    // restore
    if (/(restore\-string|restoreFromStr|文字列から復元|復元する)/.test(label)) {
      e.preventDefault();
      const s = readFromArea();
      restoreFromString(s);
      return;
    }

    // install
    if (/(installBtn|インストール)/.test(label)) {
      e.preventDefault();
      if (window.__deferredPrompt) {
        window.__deferredPrompt.prompt();
        window.__deferredPrompt.userChoice.finally(()=>{
          try {
            const el = $('#installBtn') || $$('button').find(b=>/インストール/.test(b.textContent||''));
            if (el) el.style.display='none';
          }catch(_){}
        });
      }
      return;
    }
  });

  // --- install prompt handling ---
  window.addEventListener('beforeinstallprompt', (e)=>{
    e.preventDefault();
    window.__deferredPrompt = e;
    try {
      const btn = $('#installBtn') || $$('button').find(b=>/インストール/.test(b.textContent||''));
      if (btn) btn.style.display = '';
    }catch(_){}
  });

  window.addEventListener('appinstalled', ()=>{
    try {
      const btn = $('#installBtn') || $$('button').find(b=>/インストール/.test(b.textContent||''));
      if (btn) btn.style.display = 'none';
    }catch(_){}
  });

  // --- logo fallback (non-destructive) ---
  const tryLogo = () => {
    try {
      const candidates = [
        'img#logo', '.logo img', 'img[data-logo]'
      ];
      let img = null;
      for (const sel of candidates){ img = $(sel); if (img) break; }
      if (!img) return;
      const ok = () => {
        // center by adding style only (non-destructive)
        try { img.style.display='block'; img.style.margin='8px auto'; }catch(_){}
      };
      const fail = () => {
        const paths = ['/logo.png','/img/logo.png','/assets/logo.png'];
        if (!img.getAttribute('src') || img.naturalWidth===0) {
          for (const p of paths){ img.setAttribute('src', p); break; }
        }
        ok();
      };
      if (!img.getAttribute('src')) { fail(); return; }
      if (typeof img.complete !== 'boolean' || img.complete===false || img.naturalWidth===0) {
        img.addEventListener('error', fail, {once:true});
        img.addEventListener('load', ok, {once:true});
      } else { ok(); }
    } catch(_){}
  };
  tryLogo();

})();