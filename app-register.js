/*
  himegoto register page logic (compat SDK)
  - reads user doc: users/{uid}
  - shows referral ID + stats
  - shows admin debug panel only when users/{uid}.isAdmin === true

  Important: never overwrite the whole user document.
*/

(() => {
  'use strict';

  // ===== Helpers =====
  const $ = (id) => document.getElementById(id);
  const setText = (id, text) => {
    const el = $(id);
    if (el) el.textContent = String(text);
  };
  const safeNum = (v, fallback) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };
  const clampInt = (n, min, max) => Math.max(min, Math.min(max, Math.trunc(n)));

  // ===== Firebase init =====
  // register.html 側の firebaseConfig をそのまま使う
  // ここでは「すでに初期化されている」前提で動く（初期化されてない場合だけ初期化）
  const firebaseApp = (firebase.apps && firebase.apps.length) ? firebase.app() : null;
  if (!firebaseApp) {
    console.error('[register] Firebase app is not initialized.');
    setText('refStatus', 'Firebase 初期化エラー：設定を確認してください。');
    return;
  }

  const auth = firebase.auth();
  const db = firebase.firestore();
  const functions = firebase.app().functions('asia-northeast1');

  // Cloud Functions (httpsCallable)
  const fnEnsureRefCode = () => functions.httpsCallable('ensureRefCode');
  const fnApplyReferral = () => functions.httpsCallable('applyReferral');

  // ===== UI refs =====
  const mySection = $('my-referral-section');
  const refInput = $('myRefId');
  const refStatus = $('refStatus');
  const refMessage = $('refMessage');

  const adminPanel = $('adminPanel');
  const adminShowStatusBtn = $('adminShowStatus');
  const adminForceApplyBtn = $('adminForceApply');
  const adminResult = $('adminResult');

  const copyBtn = $('copyRefCode');
  const shareBtn = $('shareRefLink');

  // ===== Core: load user state =====
  async function ensureRefCodeForUser(uid) {
    // 既存のユーザードキュメントを読み、refCode がなければ Cloud Function に作ってもらう
    const userRef = db.collection('users').doc(uid);
    const snap = await userRef.get();

    let data = snap.exists ? snap.data() : {};
    let refCode = data && data.refCode ? String(data.refCode) : '';

    if (!refCode) {
      try {
        const res = await fnEnsureRefCode()({});
        // functions 側の返却に合わせる（refCode / code / refId など揺れる可能性に耐える）
        const out = (res && res.data) ? res.data : {};
        refCode = String(out.refCode || out.code || out.refId || '');
      } catch (e) {
        console.warn('[register] ensureRefCode failed', e);
      }
      // 再読込して確実に反映を拾う
      const snap2 = await userRef.get();
      data = snap2.exists ? snap2.data() : data;
      if (!refCode && data && data.refCode) refCode = String(data.refCode);
    }

    return { refCode, userData: data || {} };
  }

  function renderStats(userData) {
    // 互換：
    // - refSuccessCount: 紹介成立の累計
    // - refRewardedCount: ボーナス獲得回数
    // - refBonusProgress: 次のボーナスまでの進捗(0-4) もしくは成立数（環境で揺れる）

    const successTotal = safeNum(userData.refSuccessCount, NaN);
    const rewardedCount = safeNum(userData.refRewardedCount, NaN);
    const bonusProgressRaw = safeNum(userData.refBonusProgress, NaN);

    // 表示優先順位
    // 1) successTotal があるならそれを「紹介した人数」
    // 2) なければ bonusProgressRaw を「紹介した人数」扱いにする（※少なくとも '-' にはしない）
    const introduced = Number.isFinite(successTotal)
      ? clampInt(successTotal, 0, 1e9)
      : clampInt(bonusProgressRaw, 0, 1e9);

    // progress は 0-4 に落とす
    let progress;
    if (Number.isFinite(bonusProgressRaw)) {
      // bonusProgress が累計っぽい値なら mod 5 を取る
      progress = clampInt(bonusProgressRaw % 5, 0, 4);
    } else if (Number.isFinite(successTotal)) {
      progress = clampInt(successTotal % 5, 0, 4);
    } else {
      progress = 0;
    }

    const next = progress === 0 ? 5 : (5 - progress);

    // rewardedCount が無い場合は成功数から推定（あくまで表示用）
    const rewarded = Number.isFinite(rewardedCount)
      ? clampInt(rewardedCount, 0, 1e9)
      : (Number.isFinite(successTotal) ? Math.floor(successTotal / 5) : 0);

    setText('refCount', introduced);
    setText('nextBonus', next);
    setText('bonusCount', rewarded);
  }

  function showAdminPanelIfNeeded(userData) {
    const isAdmin = userData && userData.isAdmin === true;
    if (adminPanel) adminPanel.style.display = isAdmin ? 'block' : 'none';
  }

  function setStatus(msg, isError) {
    if (!refStatus) return;
    refStatus.textContent = msg;
    refStatus.style.color = isError ? '#c62828' : '';
  }

  function setRefMessage(msg, ok) {
    if (!refMessage) return;
    refMessage.textContent = msg;
    refMessage.style.color = ok ? '#1b5e20' : '#c62828';
  }

  async function refresh(uid) {
    setStatus('読み込み中…', false);

    const { refCode, userData } = await ensureRefCodeForUser(uid);

    if (mySection) mySection.style.display = 'block';

    if (refInput) refInput.value = refCode || '';

    // 統計表示
    renderStats(userData);

    // 管理者パネル
    showAdminPanelIfNeeded(userData);

    setStatus('', false);
  }

  // ===== Buttons =====
  async function copyRefCode() {
    const v = refInput ? refInput.value : '';
    if (!v) {
      setRefMessage('紹介IDがまだありません。', false);
      return;
    }
    try {
      await navigator.clipboard.writeText(v);
      setRefMessage('IDをコピーしました。', true);
    } catch (_) {
      // fallback
      try {
        if (refInput) {
          refInput.focus();
          refInput.select();
          document.execCommand('copy');
          setRefMessage('IDをコピーしました。', true);
        }
      } catch (e) {
        setRefMessage('コピーに失敗しました。', false);
      }
    }
  }

  async function shareRefLink() {
    const v = refInput ? refInput.value : '';
    if (!v) {
      setRefMessage('紹介IDがまだありません。', false);
      return;
    }
    const url = new URL(location.href);
    url.searchParams.set('ref', v);
    const text = `紹介リンクです：${url.toString()}`;

    if (navigator.share) {
      try {
        await navigator.share({ text, url: url.toString() });
        setRefMessage('紹介リンクを共有しました。', true);
        return;
      } catch (_) {
        // ignore
      }
    }

    try {
      await navigator.clipboard.writeText(url.toString());
      setRefMessage('紹介リンクをコピーしました。', true);
    } catch (e) {
      setRefMessage('共有/コピーに失敗しました。', false);
    }
  }

  function bindButtons() {
    if (copyBtn) copyBtn.addEventListener('click', copyRefCode);
    if (shareBtn) shareBtn.addEventListener('click', shareRefLink);

    if (adminShowStatusBtn) {
      adminShowStatusBtn.addEventListener('click', async () => {
        try {
          const u = auth.currentUser;
          if (!u) return;
          await refresh(u.uid);
          if (adminResult) adminResult.textContent = '最新の状態を読み込みました。';
          if (adminResult) adminResult.style.color = '#1b5e20';
        } catch (e) {
          if (adminResult) adminResult.textContent = '読み込みに失敗しました。';
          if (adminResult) adminResult.style.color = '#c62828';
        }
      });
    }

    if (adminForceApplyBtn) {
      adminForceApplyBtn.addEventListener('click', async () => {
        const u = auth.currentUser;
        if (!u) return;

        const refCode = refInput ? refInput.value : '';
        if (!refCode) {
          if (adminResult) adminResult.textContent = '紹介IDがありません。';
          if (adminResult) adminResult.style.color = '#c62828';
          return;
        }

        // 注意：Cloud Functions の実装に依存するため、ここは「失敗しても壊れない」ようにする。
        try {
          if (adminResult) adminResult.textContent = '実行中…';
          if (adminResult) adminResult.style.color = '';

          const res = await fnApplyReferral()({ refCode, debug: true, force: true });
          const out = res && res.data ? res.data : {};

          await refresh(u.uid);

          const msg = out.message || out.status || '実行しました（結果はデータ更新を確認）。';
          if (adminResult) adminResult.textContent = msg;
          if (adminResult) adminResult.style.color = '#1b5e20';
        } catch (e) {
          console.warn('[register] adminForceApply failed', e);
          if (adminResult) adminResult.textContent = '強制実行はこの環境の関数仕様と一致せず失敗しました（通常の紹介登録は影響なし）。';
          if (adminResult) adminResult.style.color = '#c62828';
        }
      });
    }
  }

  // ===== Auth =====
  bindButtons();

  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      setStatus('ログインが必要です。', true);
      if (mySection) mySection.style.display = 'none';
      return;
    }
    try {
      await refresh(user.uid);
    } catch (e) {
      console.error('[register] refresh failed', e);
      setStatus('読み込みに失敗しました。', true);
    }
  });
})();
