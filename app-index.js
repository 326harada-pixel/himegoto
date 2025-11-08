
/*
  app-index.js — defensive, minimal-change JavaScript
  ルール遵守: 既存UI/文面は変更しない。追加/最小限置換のみ。
  - 各ボタンは「同じカード(近傍)」の要素だけを操作する
  - ラベル文字での大雑把な判定は維持しつつ、近傍スコープで誤作動を防止
  - 例外は握りつぶして他機能への波及停止を防ぐ
*/

(() => {
  'use strict';

  // ---- 小道具 --------------------------------------------------------------
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  const findNearest = (start, selector) => {
    // start から上に辿って selector を含む最小の祖先要素を返し、その中で selector を探す
    let node = start;
    while (node && node !== document) {
      const hit = node.querySelector && node.querySelector(selector);
      if (hit) return hit;
      node = node.parentElement;
    }
    return null;
  };

  const showToast = (msg) => {
    try {
      // 既存UIを壊さない軽量通知。UIが無ければ console にフォールバック。
      let t = $('#toast');
      if (!t) {
        t = document.createElement('div');
        t.id = 'toast';
        Object.assign(t.style, {
          position: 'fixed', left: '50%', bottom: '12px', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,.75)', color: '#fff', padding: '8px 12px',
          borderRadius: '8px', fontSize: '13px', zIndex: 9999, maxWidth: '90vw'
        });
        document.body.appendChild(t);
      }
      t.textContent = msg;
      t.style.opacity = '1';
      setTimeout(()=>{ t.style.transition='opacity .4s'; t.style.opacity='0'; }, 1300);
    } catch { console.log(msg); }
  };

  // ---- LocalStorage Key ----------------------------------------------------
  const LS = {
    CUSTOMERS: 'hg_customers_v1',
    SELECTED:  'hg_selected_v1',
    NOTES:     'hg_notes_v1',
  };

  const readJSON = (key, fallback) => {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch { return fallback; }
  };
  const writeJSON = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  };

  // ---- 近傍解決ヘルパ ------------------------------------------------------
  const nearestTextarea = (btn) => {
    // ボタンのあるカード内の textarea を優先
    const card = findAncestorCard(btn);
    if (card) {
      const ta = card.querySelector('textarea');
      if (ta) return ta;
    }
    // フォールバック: data-role 指定や id
    return $('#backupText') || $('#backupArea') || $('textarea[name="backup"]') || $('textarea');
  };

  const findAncestorCard = (el) => {
    let n = el;
    while (n && n !== document) {
      if (n.classList && n.classList.contains('card')) return n;
      n = n.parentElement;
    }
    return null;
  };

  // ---- バックアップ Base64 -------------------------------------------------
  const prefix = 'HIME1.'; // 既存仕様を尊重

  const makeBackupString = () => {
    try {
      const payload = {
        customers: readJSON(LS.CUSTOMERS, []),
        selected:  readJSON(LS.SELECTED, null),
        notes:     readJSON(LS.NOTES, {}),
        ts: Date.now()
      };
      const json = JSON.stringify(payload);
      const b64 = btoa(unescape(encodeURIComponent(json)));
      return prefix + b64;
    } catch (e) {
      showToast('バックアップ作成に失敗しました');
      return null;
    }
  };

  const restoreFromString = (str) => {
    try {
      if (!str || !str.startsWith(prefix)) throw new Error('prefix');
      const b64 = str.slice(prefix.length).trim();
      const json = decodeURIComponent(escape(atob(b64)));
      const obj = JSON.parse(json);
      if (obj && typeof obj === 'object') {
        if (obj.customers) writeJSON(LS.CUSTOMERS, obj.customers);
        if (Object.prototype.hasOwnProperty.call(obj,'selected')) writeJSON(LS.SELECTED, obj.selected);
        if (obj.notes) writeJSON(LS.NOTES, obj.notes);
      }
      showToast('復元しました');
    } catch (e) {
      showToast('復元に失敗しました');
    }
  };

  // ---- {name} 差し込み ------------------------------------------------------
  const insertNameIntoMessage = () => {
    try {
      const msg = $('#messageInput') || $('textarea#message') || $('textarea[name="message"]') || $('textarea');
      const selected = readJSON(LS.SELECTED, null);
      if (!msg) return;
      if (!selected) { showToast('顧客を選択してください'); return; }
      const name = (typeof selected === 'string') ? selected : (selected.name || selected.label || '');
      const target = msg;
      const value = target.value || '';
      const out = value.replace(/\{name\}/g, name);
      if (out !== value) {
        target.value = out;
      }
      showToast('{name} を差し込みました');
    } catch {}
  };

  // ---- 顧客追加（近傍スコープ）---------------------------------------------
  const addCustomerFromButton = (btn) => {
    try {
      const card = findAncestorCard(btn) || document;
      const input = card.querySelector('input[type="text"], input[placeholder]');
      const val = (input && input.value || '').trim();
      if (!val) { showToast('顧客名を入力'); return; }
      const list = readJSON(LS.CUSTOMERS, []);
      if (!list.includes(val)) list.push(val);
      writeJSON(LS.CUSTOMERS, list);
      writeJSON(LS.SELECTED, val);
      showToast('追加しました');
      try { window.hime_render && window.hime_render(); } catch {}
      if (input) input.value='';
    } catch {}
  };

  // ---- PWA install ----------------------------------------------------------
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    try {
      e.preventDefault();
      deferredPrompt = e;
      const btn = $('[data-action="install"], #installBtn, button.install');
      if (btn) btn.style.display = '';
    } catch {}
  });

  window.addEventListener('appinstalled', () => {
    try {
      const btn = $('[data-action="install"], #installBtn, button.install');
      if (btn) btn.style.display = 'none';
      deferredPrompt = null;
    } catch {}
  });

  const triggerInstall = async () => {
    try {
      if (!deferredPrompt) { showToast('インストール要件を満たしていません'); return; }
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
    } catch {}
  };

  // ---- クリック委譲（近傍限定で誤作動防止）----------------------------------
  document.addEventListener('click', (ev) => {
    const t = ev.target.closest('button, a');
    if (!t) return;

    const label = (t.textContent || '').trim();

    try {
      if (t.matches('#addBtn, [data-action="add"]') || label === '追加') {
        ev.preventDefault();
        addCustomerFromButton(t);
        return;
      }
      if (t.matches('#insertNameBtn, [data-action="insert-name"]') || label.includes('{name}')) {
        ev.preventDefault();
        insertNameIntoMessage();
        return;
      }
      if (t.matches('#makeBackupBtn, [data-action="make-backup"]') || label.includes('文字列を作る') || label.includes('バックアップを作る')) {
        ev.preventDefault();
        const ta = nearestTextarea(t);
        const s = makeBackupString();
        if (ta && s) ta.value = s;
        if (s && !ta) showToast('バックアップ文字列を作成しました');
        return;
      }
      if (t.matches('#copyBackupBtn, [data-action="copy-backup"]') || label === 'コピー') {
        ev.preventDefault();
        const ta = nearestTextarea(t);
        if (!ta || !ta.value) { showToast('コピーする文字列がありません'); return; }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(ta.value).then(()=>showToast('コピーしました')).catch(()=>{
            ta.select(); document.execCommand('copy'); showToast('コピーしました');
          });
        } else {
          ta.select(); document.execCommand('copy'); showToast('コピーしました');
        }
        return;
      }
      if (t.matches('#restoreFromTextBtn, [data-action="restore-text"]') || label.includes('文字列から復元') || label.includes('復元する')) {
        ev.preventDefault();
        const ta = nearestTextarea(t);
        if (!ta || !ta.value) { showToast('復元する文字列を貼り付けてください'); return; }
        restoreFromString(ta.value.trim());
        return;
      }
      if (t.matches('#installBtn, [data-action="install"]') || label.includes('インストール')) {
        ev.preventDefault();
        triggerInstall();
        return;
      }
    } catch (e) {
      console.error(e);
    }
  }, { passive: false });

  // 初期表示: インストールボタンはデフォルト非表示（beforeinstallpromptで復活）
  try {
    const btn = $('[data-action="install"], #installBtn, button.install');
    if (btn) btn.style.display = 'none';
  } catch {}

  try {
    $$('img').forEach(img => {
      img.addEventListener('error', () => {/* noop */}, { once:true });
    });
  } catch {}

})();
