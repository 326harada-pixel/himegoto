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
    // 統計カウンタが未作成/未初期化だとUIが「-」になりやすいので、ここで安全に初期化
    const successInit = Number.isFinite(Number(data.refSuccessCount)) ? Number(data.refSuccessCount) : 0;
    const rewardedInit = Number.isFinite(Number(data.refRewardedCount)) ? Number(data.refRewardedCount) : 0;
    const progressInit = Number.isFinite(Number(data.refBonusProgress)) ? Number(data.refBonusProgress) : (successInit % 3);

    if (!snap.exists
        || !Number.isFinite(Number(data.refSuccessCount))
        || !Number.isFinite(Number(data.refRewardedCount))
        || !Number.isFinite(Number(data.refBonusProgress))) {
      try {
        await userRef.set({
          uid,
          refSuccessCount: successInit,
          refRewardedCount: rewardedInit,
          refBonusProgress: progressInit,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      } catch (e) {
        // ここが失敗しても表示は続行（権限等）
      }
      data = { ...data, uid, refSuccessCount: successInit, refRewardedCount: rewardedInit, refBonusProgress: progressInit };
    }

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

    const successTotal = safeNum(userData.refSuccessCount, 0);
    const rewardedCount = safeNum(userData.refRewardedCount, 0);
    const bonusProgressRaw = safeNum(userData.refBonusProgress, 0);

    // 表示優先順位
    // 1) successTotal があるならそれを「紹介した人数」
    // 2) なければ bonusProgressRaw を「紹介した人数」扱いにする（※少なくとも '-' にはしない）
    const introduced = Number.isFinite(successTotal)
      ? clampInt(successTotal, 0, 1e9)
      : clampInt(bonusProgressRaw, 0, 1e9);

    const BONUS_EVERY = 3;

    // progress は 0-(BONUS_EVERY-1) に落とす
    let progress;
    if (Number.isFinite(bonusProgressRaw)) {
      // bonusProgress が累計っぽい値なら mod を取る
      progress = clampInt(bonusProgressRaw % BONUS_EVERY, 0, BONUS_EVERY - 1);
    } else if (Number.isFinite(successTotal)) {
      progress = clampInt(successTotal % BONUS_EVERY, 0, BONUS_EVERY - 1);
    } else {
      progress = 0;
    }

    // 次のボーナスまで: 0→あと3、3→あと3、5→あと1
    const next = progress === 0 ? BONUS_EVERY : (BONUS_EVERY - progress);

    // rewardedCount が無い場合は成功数から推定（あくまで表示用）
    const rewarded = Number.isFinite(rewardedCount)
      ? clampInt(rewardedCount, 0, 1e9)
      : (Number.isFinite(successTotal) ? Math.floor(successTotal / BONUS_EVERY) : 0);

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
      // 未ログイン: 登録フォームを表示、紹介カード/管理者パネルは隠す
      const reg = document.getElementById('registration-section');
      if (reg) reg.style.display = '';
      if (mySection) mySection.style.display = 'none';
      if (adminSection) adminSection.style.display = 'none';
      return;
    }
    try {
      // ログイン済み: 登録フォームを隠し、紹介カードを表示
      const reg = document.getElementById('registration-section');
      if (reg) reg.style.display = 'none';
      if (mySection) mySection.style.display = '';

      await refresh(user.uid);
    } catch (e) {
      console.error('[register] refresh failed', e);
      setStatus('読み込みに失敗しました。', true);
    }
  });
})();
