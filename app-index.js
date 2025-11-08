
/* app-index.js — ultra-defensive minimal patch (UI/文章は不変更)
 * 目的:
 *  - 追加 / {name}挿入 / 共有 / バックアップ / 復元 / インストール を確実化
 *  - ラベル差異・DOM差異に強いマッチ
 *  - バックアップは "バックアップ系のテキストエリア" のみに限定（メッセージ欄へは絶対に書かない）
 */

(() => {
  'use strict';

  const $  = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  // ---- guard (多重発火・連打対策) ----
  const last = new Map();
  const once = (key, ms=300) => {
    const now = Date.now();
    const t = last.get(key)||0;
    if (now - t < ms) return false;
    last.set(key, now);
    return true;
  };

  // ---- 汎用クリック対象抽出（button以外の疑似ボタンにも対応） ----
  const closestBtn = (el) => el.closest('button, a, [role="button"], .btn, .button, .tap, [data-action]');

  // ---- 「カード/セクション」境界（誤作用抑止） ----
  const findCard = (el) => {
    let n = el;
    while (n && n !== document) {
      if (n.classList && (n.classList.contains('card') || n.classList.contains('section') || n.classList.contains('box') || n.classList.contains('panel'))) return n;
      n = n.parentElement;
    }
    return null;
  };

  // ---- メッセージ欄の特定（バックアップ欄は除外） ----
  const getMessageArea = () => {
    const explicit = $('#messageInput') || $('textarea#message') || $('textarea[name="message"]') || $('textarea.message') || $('textarea[data-role="message"]');
    if (explicit) return explicit;
    // 推定: "メッセージ" らしさ & "バックアップ" ではない
    const areas = $$('textarea');
    for (const ta of areas) {
      const id  = (ta.id || '').toLowerCase();
      const nm  = (ta.name || '').toLowerCase();
      const ph  = (ta.getAttribute('placeholder') || '').toLowerCase();
      const txt = (ta.previousElementSibling && ta.previousElementSibling.textContent || '').toLowerCase();
      const notBackup = !(id.includes('backup') || nm.includes('backup') || ph.includes('backup') || ph.includes('バックアップ'));
      const looksMsg  = id.includes('message') || nm.includes('message') || ph.includes('message') || ph.includes('メッセージ') || txt.includes('メッセージ');
      if (notBackup && looksMsg) return ta;
    }
    // 最後の手: "backup" を含まない最初の textarea
    for (const ta of areas) {
      const id  = (ta.id || '').toLowerCase();
      const nm  = (ta.name || '').toLowerCase();
      const ph  = (ta.getAttribute('placeholder') || '').toLowerCase();
      if (!(id.includes('backup') || nm.includes('backup') || ph.includes('backup') || ph.includes('バックアップ'))) return ta;
    }
    return null;
  };

  // ---- バックアップ用テキストエリアの選定（スコアリング） ----
  const rankBackupTextarea = (originBtn) => {
    const areas = $$('textarea');
    if (!areas.length) return null;
    const msg = getMessageArea();

    const scoreOf = (ta) => {
      let s = 0;
      const id  = (ta.id || '').toLowerCase();
      const nm  = (ta.name || '').toLowerCase();
      const ph  = (ta.getAttribute('placeholder') || '').toLowerCase();
      const lab = (ta.previousElementSibling && ta.previousElementSibling.textContent || '').toLowerCase();
      const parentText = (ta.parentElement && ta.parentElement.textContent || '').toLowerCase();

      // 明示的に backup 系なら強スコア
      if (id.includes('backup') || nm.includes('backup') || ph.includes('backup') || ph.includes('バックアップ')) s += 5;
      if (lab.includes('バックアップ') || parentText.includes('バックアップ')) s += 3;

      // origin の属するカードにあるなら加点
      const card = findCard(originBtn);
      if (card && card.contains(ta)) s += 2;

      // メッセージ欄は強い減点（誤爆防止）
      if (msg && ta === msg) s -= 10;

      // 見た目が大きめなら僅かに加点（長文系）
      const rows = parseInt(ta.getAttribute('rows')||'0',10);
      if (rows >= 6) s += 1;
      return s;
    };

    let best = null, bestScore = -1e9;
    for (const ta of areas) {
      const sc = scoreOf(ta);
      if (sc > bestScore) { bestScore = sc; best = ta; }
    }
    return bestScore > -5 ? best : null; // メッセージ欄しか無い等の誤選択を避ける
  };

  // ---- Base64URL + HIME1. ----
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
    try {
      for (let i=0;i<localStorage.length;i++){ const k = localStorage.key(i); data[k]=localStorage.getItem(k); }
    } catch {}
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

  // ---- {name} literal をキャレット位置に挿入（置換しない） ----
  const insertLiteralNameTag = () => {
    if (!once('insert_name', 250)) return;
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

  // ---- 顧客追加（入力欄の探索を広げる） ----
  const addCustomer = (btn) => {
    if (!once('add_customer', 300)) return;
    try {
      const card = findCard(btn) || document;
      const cands = [
        '#customerName','#customer','#name','[name="customerName"]','[name="customer"]','[name="name"]',
        '.customer-name','.customer','.hime-customer',
        'input[type="text"]'
      ];
      let input = null;
      for (const sel of cands) { const el = card.querySelector(sel); if (el && el.value && el.value.trim()) { input = el; break; } }
      const name = input ? input.value.trim() : '';
      if (!name) return;

      const keys = ['hg_customers_v1','hime_customers','customers'];
      let list=null, useKey=keys[0];
      for (const k of keys) {
        try { const v = localStorage.getItem(k); if (v) { list=JSON.parse(v); useKey=k; break; } } catch {}
      }
      if (!Array.isArray(list)) list = [];
      if (!list.includes(name)) list.push(name);
      try { localStorage.setItem(useKey, JSON.stringify(list)); } catch {}
      const selKeys = ['hg_selected_v1','hime_selected','selected'];
      for (const k of selKeys) { try { localStorage.setItem(k, JSON.stringify(name)); } catch {} }
      try { window.hime_render && window.hime_render(); } catch {}
      if (input) input.value='';
    } catch {}
  };

  // ---- 共有（シェアシート / クリップボード） ----
  const doShare = () => {
    if (!once('share', 600)) return;
    try {
      const ta = getMessageArea();
      const text = (ta && ta.value) ? ta.value : '';
      if (!text) return;
      if (navigator.share) {
        navigator.share({ text }).catch(()=>{});
      } else if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).catch(()=>{});
      } else {
        try { ta.select(); document.execCommand('copy'); } catch {}
      }
    } catch {}
  };

  // ---- インストール ----
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

  // ---- クリック委譲（広めのセレクタ対応 + ラベル多言語対応） ----
  document.addEventListener('click', (ev)=>{
    const t = closestBtn(ev.target);
    if (!t) return;
    const label = (t.textContent||'').trim();

    try {
      // 顧客追加（「追加」「追加する」「＋追加」 等も拾う）
      if (t.matches('#addBtn,[data-action="add"]') || /追加/.test(label)) {
        ev.preventDefault(); addCustomer(t); return;
      }

      // {name} 挿入（「{name}を挿入」「差込」「差し込み」等）
      if (t.matches('#insertNameBtn,[data-action="insert-name"]') || /\{name\}|差し?込/.test(label)) {
        ev.preventDefault(); insertLiteralNameTag(); return;
      }

      // バックアップ作成
      if (t.matches('#makeBackupBtn,[data-action="make-backup"]') || /(文字列を作る|バックアップを作る|作成)/.test(label)) {
        ev.preventDefault();
        const ta = rankBackupTextarea(t);
        if (ta) { const s = collectAll(); ta.value = s; try{ ta.dispatchEvent(new Event('input',{bubbles:true})); }catch{} }
        return;
      }

      // コピー
      if (t.matches('#copyBackupBtn,[data-action="copy-backup"]') || /コピー/.test(label)) {
        ev.preventDefault();
        const ta = rankBackupTextarea(t);
        if (!ta || !ta.value) return;
        if (navigator.clipboard?.writeText) navigator.clipboard.writeText(ta.value).catch(()=>{});
        else { try{ ta.select(); document.execCommand('copy'); }catch{} }
        return;
      }

      // 復元
      if (t.matches('#restoreFromTextBtn,[data-action="restore-text"]') || /(文字列から復元|復元する|復元)/.test(label)) {
        ev.preventDefault();
        const ta = rankBackupTextarea(t);
        if (!ta || !ta.value) return;
        restoreAll(ta.value.trim());
        return;
      }

      // 共有
      if (t.matches('#shareBtn,[data-action="share"]') || /共有|シェア/.test(label)) {
        ev.preventDefault(); doShare(); return;
      }

      // インストール
      if (t.matches('#installBtn,[data-action="install"]') || /インストール/.test(label)) {
        ev.preventDefault(); triggerInstall(); return;
      }
    } catch {}
  }, {passive:false});

  // 初期はインストール非表示（イベントで表示）
  try { const b = $('#installBtn') || $('button.install') || $('[data-action="install"]'); if (b) b.style.display='none'; } catch {}

})();
