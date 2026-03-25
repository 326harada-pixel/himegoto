/*
  himegoto register page logic (compat SDK)
  - reads user doc: users/{uid}/profile/info
  - shows referral ID + stats

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

  const copyBtn = $('copyRefCode');
  const shareBtn = $('shareRefLink');

  // ===== SMS Auth (reCAPTCHA + SMSコード送信/確認) =====
  const phoneInput = $('phoneInput');
  const sendCodeSmsBtn = $('sendCodeSms');
  const codeSmsInput = $('codeSms');
  const verifySmsBtn = $('verifySms');
  const refCodeInput = $('refCodeInput') || $('refCode');
  const smsMessage = $('smsMessage');
  const recaptchaContainer = $('recaptcha-container');

  let recaptchaVerifier = null;
  let confirmationResult = null;

  function setSmsMessage(msg, isError = false) {
    if (!smsMessage) return;
    smsMessage.textContent = msg || '';
    smsMessage.style.color = isError ? '#d32f2f' : '#e91e63';
  }

  function toE164JP(raw) {
    const s = (raw || '').trim().replace(/\s|-/g, '');
    if (!s) return '';
    if (s.startsWith('+')) return s;
    if (s.startsWith('0')) return '+81' + s.slice(1);
    if (s.startsWith('81')) return '+' + s;
    return s;
  }

  function ensureRecaptcha() {
    if (!recaptchaContainer || !firebase?.auth) return;
    if (recaptchaVerifier) return;

    try {
      recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
        size: 'normal',
        callback: () => {
          if (sendCodeSmsBtn) sendCodeSmsBtn.disabled = false;
          setSmsMessage('reCAPTCHA成功！', false);
        },
        'expired-callback': () => {
          if (sendCodeSmsBtn) sendCodeSmsBtn.disabled = true;
          setSmsMessage('reCAPTCHAの有効期限が切れました。もう一度チェックしてください。', true);
        },
      });

      recaptchaVerifier.render().then(() => {
        if (sendCodeSmsBtn) sendCodeSmsBtn.disabled = true;
      });
    } catch (e) {
      console.error('reCAPTCHA init failed:', e);
      setSmsMessage('reCAPTCHAの初期化に失敗しました。ページ再読み込みしてください。', true);
    }
  }

  async function sendSmsCode() {
    try {
      if (!sendCodeSmsBtn || !phoneInput) return;
      const phone = toE164JP(phoneInput.value);
      if (!phone) {
        setSmsMessage('電話番号を入力してください。', true);
        return;
      }
      ensureRecaptcha();
      if (!recaptchaVerifier) {
        setSmsMessage('reCAPTCHAが準備できていません。少し待って再試行してください。', true);
        return;
      }

      sendCodeSmsBtn.disabled = true;
      setSmsMessage('送信中…', false);

      confirmationResult = await auth.signInWithPhoneNumber(phone, recaptchaVerifier);

      if (codeSmsInput) codeSmsInput.disabled = false;
      if (verifySmsBtn) verifySmsBtn.disabled = false;

      setSmsMessage('SMSを送信しました。届いた6桁コードを入力してください。', false);
    } catch (e) {
      console.error('sendSmsCode error:', e);
      try { recaptchaVerifier?.reset?.(); } catch (_) {}
      if (sendCodeSmsBtn) sendCodeSmsBtn.disabled = true;
      setSmsMessage('SMS送信に失敗しました。reCAPTCHAを再チェックしてからもう一度。', true);
    }
  }

  async function verifySmsCodeAndRegister() {
    try {
      if (!verifySmsBtn || !codeSmsInput) return;
      const code = (codeSmsInput.value || '').trim();
      if (!code) {
        setSmsMessage('6桁コードを入力してください。', true);
        return;
      }
      if (!confirmationResult) {
        setSmsMessage('先に「コード送信」を押してください。', true);
        return;
      }

      verifySmsBtn.disabled = true;
      setSmsMessage('確認中…', false);

      const cred = await confirmationResult.confirm(code);
      const user = cred.user;

      // ①紹介IDの確保（無ければ作成）
      try {
        await fnEnsureRefCode()({});
      } catch (e) {
        console.warn('ensureRefCode failed:', e);
      }

      // ②紹介コード適用（任意）
      const ref = (refCodeInput?.value || '').trim();
      if (ref) {
        try {
          await fnApplyReferral()({ refCode: ref });
        } catch (e) {
          console.warn('applyReferral failed:', e);
          setSmsMessage('登録は完了しましたが、紹介コードの適用に失敗しました。', true);
        }
      }

      setSmsMessage('登録完了！', false);

      return user;
    } catch (e) {
      console.error('verifySmsCode error:', e);
      verifySmsBtn.disabled = false;
      setSmsMessage('コード確認に失敗しました。コードが正しいか確認してください。', true);
    }
  }

  // ===== Core: load user state =====
  async function ensureRefCodeForUser(uid) {
    const userRef = db.collection('users').doc(uid).collection('profile').doc('info');
    const snap = await userRef.get();

    let data = snap.exists ? snap.data() : {};
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
        // 権限等で失敗しても表示は続行
      }
      data = { ...data, uid, refSuccessCount: successInit, refRewardedCount: rewardedInit, refBonusProgress: progressInit };
    }

    let refCode = data && data.refCode ? String(data.refCode) : '';

    if (!refCode) {
      try {
        const res = await fnEnsureRefCode()({});
        const out = (res && res.data) ? res.data : {};
        refCode = String(out.refCode || out.code || out.refId || '');
      } catch (e) {
        console.warn('[register] ensureRefCode failed', e);
      }
      const snap2 = await userRef.get();
      data = snap2.exists ? snap2.data() : data;
      if (!refCode && data && data.refCode) refCode = String(data.refCode);
    }

    return { refCode, userData: data || {} };
  }

  function renderStats(userData) {
    const successTotal = safeNum(userData && userData.refSuccessCount, 0);
    const rewardedCount = safeNum(userData && userData.refRewardedCount, 0);
    const BONUS_EVERY = 3;

    const introduced = clampInt(successTotal, 0, 1e9);
    const progress = clampInt(successTotal % BONUS_EVERY, 0, BONUS_EVERY - 1);
    const next = progress === 0 ? BONUS_EVERY : (BONUS_EVERY - progress);
    const rewarded = clampInt(rewardedCount, 0, 1e9);

    setText('refCount', introduced);
    setText('nextBonus', next);
    setText('bonusCount', rewarded);
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

    renderStats(userData);

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
        await navigator.share({ text });
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

    // SMS認証ボタン
    if (sendCodeSmsBtn) sendCodeSmsBtn.addEventListener('click', sendSmsCode);
    if (verifySmsBtn) verifySmsBtn.addEventListener('click', verifySmsCodeAndRegister);

    // reCAPTCHA準備（未ログイン時に必要）
    ensureRecaptcha();
  }

  // ===== Auth =====
  bindButtons();

  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      setStatus('ログインが必要です。', true);
      const reg = document.getElementById('registration-section');
      if (reg) reg.style.display = '';
      if (mySection) mySection.style.display = 'none';
      return;
    }
    try {
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
