
/* app-index.js — minimal, defensive add-on (最上位ルール順守: 追加/最小限置換のみ)
 * - {name} ボタン: メッセージ欄のキャレット位置に **そのまま** "{name}" を挿入（置換しない）
 * - バックアップ3ボタン: 押下したカード内の textarea のみ対象（誤爆防止）
 * - PWA インストール: beforeinstallprompt 正常処理
 * - 例外吸収で他機能停止を防止
 */
(() => {
  'use strict';

  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  // ---- 近傍（カード）探索 ----
  const findCard = (el) => {
    let n = el;
    while (n && n !== document) {
      if (n.classList && (n.classList.contains('card') || n.classList.contains('section'))) return n;
      n = n.parentElement;
    }
    return null;
  };

  // ---- メッセージ欄の特定（バックアップ欄は除外） ----
  const getMessageArea = () => {
    // 優先: 明示的な message 系
    const cand = $('#messageInput') || $('textarea#message') || $('textarea[name="message"]');
    if (cand) return cand;
    // フォールバック: “backup” を含まない textarea を優先
    const areas = $$('textarea');
    for (const ta of areas) {
      const id  = (ta.id || '').toLowerCase();
      const nm  = (ta.name || '').toLowerCase();
      const ph  = (ta.getAttribute('placeholder') || '').toLowerCase();
      if (id.includes('backup') || nm.includes('backup') || ph.includes('バックアップ') || ph.includes('backup')) continue;
      if (id.includes('message') || nm.includes('message') || ph.includes('メッセージ')) return ta;
    }
    // さらに最後の手: “backup” を含まない最初の textarea
    for (const ta of areas) {
      const id  = (ta.id || '').toLowerCase();
      const nm  = (ta.name || '').toLowerCase();
      if (!id.includes('backup') && !nm.includes('backup')) return ta;
    }
    return null;
  };

  // ---- バックアップ（Base64URL, HIME1.） ----
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

  const LS_KEYS = ['hg_customers_v1','hg_selected_v1','hg_notes_v1','hime_customers','hime_selected','hime_memos'];
  const collect = () => {
    const all = {};
    try {
      for (let i=0;i<localStorage.length;i++){
        const k = localStorage.key(i);
        all[k] = localStorage.getItem(k);
      }
    }catch{}
    const obj = { ts: Date.now(), data: all };
    return BK_PREFIX + b64url.enc(JSON.stringify(obj));
  };
  const restore = (raw) => {
    try {
      if (!raw || !raw.startsWith(BK_PREFIX)) return false;
      const json = b64url.dec(raw.slice(BK_PREFIX.length));
      const obj = JSON.parse(json);
      if (!obj || !obj.data) return false;
      Object.keys(obj.data).forEach(k=>{ try{ localStorage.setItem(k, obj.data[k]); }catch{} });
      return true;
    } catch { return false; }
  };

  const nearestTextarea = (btn) => {
    const card = findCard(btn);
    if (card) {
      const ta = card.querySelector('textarea');
      if (ta) return ta;
    }
    return $('#backupText') || $('#backupArea') || $('textarea[name="backup"]') || $('textarea');
  };

  // ---- {name} をキャレット位置へ“そのまま”挿入 ----
  const insertLiteralNameTag = () => {
    try {
      const ta = getMessageArea();
      if (!ta) return;
      const tag = '{name}';
      const start = ta.selectionStart ?? (ta.value||'').length;
      const end   = ta.selectionEnd   ?? (ta.value||'').length;
      const v = ta.value || '';
      ta.value = v.slice(0,start) + tag + v.slice(end);
      // キャレットを挿入直後へ
      const pos = start + tag.length;
      try { ta.setSelectionRange(pos, pos); } catch {}
      try { ta.dispatchEvent(new Event('input',{bubbles:true})); } catch {}
    } catch {}
  };

  // ---- PWA install ----
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
    try{
      if(!deferredPrompt) return;
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt=null;
    }catch{}
  };

  // ---- クリック委譲（最小限） ----
  document.addEventListener('click', (ev)=>{
    const t = ev.target.closest('button, a');
    if (!t) return;
    const label = (t.textContent||'').trim();

    try {
      if (t.matches('#insertNameBtn, [data-action="insert-name"]') || label.includes('{name}')) {
        ev.preventDefault();
        insertLiteralNameTag();
        return;
      }
      if (t.matches('#makeBackupBtn, [data-action="make-backup"]') || label.includes('文字列を作る') || label.includes('バックアップを作る')) {
        ev.preventDefault();
        const s = collect();
        const ta = nearestTextarea(t);
        if (ta) { ta.value = s; try{ ta.dispatchEvent(new Event('input',{bubbles:true})); }catch{} }
        return;
      }
      if (t.matches('#copyBackupBtn, [data-action="copy-backup"]') || label === 'コピー') {
        ev.preventDefault();
        const ta = nearestTextarea(t);
        if (!ta || !ta.value) return;
        if (navigator.clipboard?.writeText) navigator.clipboard.writeText(ta.value).catch(()=>{});
        else { try{ ta.select(); document.execCommand('copy'); }catch{} }
        return;
      }
      if (t.matches('#restoreFromTextBtn, [data-action="restore-text"]') || label.includes('文字列から復元') || label.includes('復元する')) {
        ev.preventDefault();
        const ta = nearestTextarea(t);
        if (!ta || !ta.value) return;
        restore(ta.value.trim());
        return;
      }
      if (t.matches('#installBtn, [data-action="install"]') || label.includes('インストール')) {
        ev.preventDefault();
        triggerInstall();
        return;
      }
    } catch {}
  }, {passive:false});

  // 初期は install 非表示（発火で出す）
  try {
    const btn = $('#installBtn') || $('button.install') || $('[data-action="install"]');
    if (btn) btn.style.display='none';
  }catch{}

})();
