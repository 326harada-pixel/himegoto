// himegoto register - SMS 認証 & 紹介ID発行フロー（Firebase v9 compat）

let auth, db, confirmationResult;
let myRefIdCache = null;

// ---------- 共通ユーティリティ ----------
function qs(sel) {
  return document.querySelector(sel);
}

function setStatus(text, isError) {
  const el = qs('#smsMessage');
  if (!el) return;
  el.textContent = text || '';
  el.className = 'status-msg ' + (isError ? 'status-error' : 'status-success');
}

function setRefStatus(text, isError) {
  const el = qs('#refMessage');
  if (!el) return;
  el.textContent = text || '';
  el.className = 'status-msg ' + (isError ? 'status-error' : 'status-success');
}

function logError(e) {
  console.error(e);
  const el = qs('#error-log');
  if (!el) return;
  el.style.display = 'block';
  el.textContent = (el.textContent || '') + '\n' + (e && e.stack ? e.stack : String(e));
}

// 日本の携帯番号を +81 形式に変換（09012345678 → +819012345678）
function normalizePhone(input) {
  if (!input) return null;
  let p = input.replace(/[^0-9]/g, '');
  if (p.length < 10 || p.length > 11) return null;   // だいたいの長さチェック
  if (p[0] === '0') {
    p = p.substring(1);
  }
  return '+81' + p;
}

// ランダムな6～8桁の紹介ID生成（英大文字＋数字）
function generateRefId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 8; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

// クエリパラメータから ref を取得して紹介コード欄に自動セット
function prefillRefCodeFromQuery() {
  try {
    const params = new URLSearchParams(window.location.search || '');
    const ref = params.get('ref');
    if (ref) {
      const input = qs('#refCode');
      if (input) input.value = ref;
    }
  } catch (e) {
    // 古いブラウザ等では無視
  }
}

// ---------- reCAPTCHA 初期化 ----------
function setupRecaptcha() {
  const sendBtn = qs('#sendCodeSms');
  if (!window.firebase || !firebase.auth) {
    setStatus('内部エラーが発生しました。時間をおいて再度お試しください。', true);
    return;
  }

  try {
    window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier(
      'recaptcha-container',
      {
        size: 'normal',
        callback: function () {
          if (sendBtn) sendBtn.disabled = false;
          setStatus('認証OKです。電話番号を入力してコード送信してください。', false);
        },
        'expired-callback': function () {
          if (sendBtn) sendBtn.disabled = true;
          setStatus('reCAPTCHAの有効期限が切れました。もう一度チェックしてください。', true);
        }
      },
      auth
    );

    window.recaptchaVerifier.render().catch(function (e) {
      logError(e);
      setStatus('reCAPTCHAの表示に失敗しました。時間をおいて再度お試しください。', true);
    });
  } catch (e) {
    logError(e);
    setStatus('reCAPTCHAの初期化に失敗しました。時間をおいて再度お試しください。', true);
  }
}

// ---------- イベント紐付け ----------
function bindEvents() {
  const sendBtn = qs('#sendCodeSms');
  const verifyBtn = qs('#verifySms');
  const copyBtn = qs('#copyRefId');
  const shareBtn = qs('#shareRefLink');

  if (sendBtn) {
    sendBtn.addEventListener('click', onClickSendCode);
  }
  if (verifyBtn) {
    verifyBtn.addEventListener('click', onClickVerifyCode);
  }
  if (copyBtn) {
    copyBtn.addEventListener('click', onClickCopyRefId);
  }
  if (shareBtn) {
    shareBtn.addEventListener('click', onClickShareRefLink);
  }
}

// ---------- コード送信 ----------
function onClickSendCode() {
  const phoneInput = qs('#phoneInput');
  const codeInput = qs('#codeSms');
  const sendBtn = qs('#sendCodeSms');
  const verifyBtn = qs('#verifySms');

  if (!phoneInput) return;

  const intl = normalizePhone(phoneInput.value);
  if (!intl) {
    setStatus('電話番号の形式が正しくありません。例：09012345678', true);
    return;
  }

  if (!window.recaptchaVerifier) {
    setupRecaptcha();
    if (!window.recaptchaVerifier) {
      setStatus('reCAPTCHAが準備できませんでした。時間をおいて再度お試しください。', true);
      return;
    }
  }

  setStatus('SMSコードを送信中です…', false);
  if (sendBtn) sendBtn.disabled = true;

  auth
    .signInWithPhoneNumber(intl, window.recaptchaVerifier)
    .then(function (result) {
      confirmationResult = result;
      setStatus('SMSを送信しました。届いた6桁コードを入力してください。', false);
      if (codeInput) codeInput.disabled = false;
      if (verifyBtn) verifyBtn.disabled = false;
    })
    .catch(function (e) {
      logError(e);
      let msg = 'SMSの送信に失敗しました。時間をおいて再度お試しください。';
      if (e && e.code) {
        switch (e.code) {
          case 'auth/invalid-phone-number':
            msg = '電話番号の形式が正しくありません。もう一度確認してください。';
            break;
          case 'auth/too-many-requests':
            msg = '短時間に多数のリクエストが行われました。しばらくしてからお試しください。';
            break;
          case 'auth/quota-exceeded':
            msg = 'SMS送信の上限に達しました。時間をおいて再度お試しください。';
            break;
          case 'auth/missing-phone-number':
            msg = '電話番号が入力されていません。';
            break;
        }
      }
      setStatus(msg, true);
      if (sendBtn) sendBtn.disabled = false;
    });
}

// ---------- コード検証 & Firestore 登録 ----------
function onClickVerifyCode() {
  const codeInput = qs('#codeSms');
  const verifyBtn = qs('#verifySms');

  if (!confirmationResult) {
    setStatus('先に「コード送信」を行ってください。', true);
    return;
  }
  if (!codeInput || !codeInput.value) {
    setStatus('SMSで届いた6桁コードを入力してください。', true);
    return;
  }

  const code = codeInput.value.trim();

  setStatus('認証中です…', false);
  if (verifyBtn) verifyBtn.disabled = true;

  confirmationResult
    .confirm(code)
    .then(function (cred) {
      const user = cred.user;
      setStatus('認証に成功しました。アカウント情報を保存しています…', false);
      return saveUserToFirestore(user);
    })
    .then(function (myRefId) {
      myRefIdCache = myRefId;
      showReferralSection(myRefId);
      setStatus('登録が完了しました。紹介IDが発行されました。', false);
    })
    .catch(function (e) {
      logError(e);
      let msg = '認証に失敗しました。コードを確認して再度お試しください。';
      if (e && e.code === 'auth/invalid-verification-code') {
        msg = 'コードが間違っています。もう一度入力してください。';
      }
      setStatus(msg, true);
      if (verifyBtn) verifyBtn.disabled = false;
    });
}

// Firestore にユーザー情報を保存
function saveUserToFirestore(user) {
  if (!db || !user) return Promise.reject(new Error('Firestore not ready'));

  const refInput = qs('#refCode');
  const refCodeValue = refInput && refInput.value ? refInput.value.trim() : '';

  const uid = user.uid;
  const usersCol = db.collection('users');
  const userDoc = usersCol.doc(uid);

  const myRefId = generateRefId();

  return userDoc
    .set(
      {
        phoneNumber: user.phoneNumber || null,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        myRefId: myRefId,
        referralFrom: refCodeValue || null
      },
      { merge: true }
    )
    .then(function () {
      return myRefId;
    });
}

// ---------- 紹介ID表示 ----------
function showReferralSection(myRefId) {
  const regSec = qs('#registration-section');
  const refSec = qs('#my-referral-section');
  const myRefInput = qs('#myRefId');

  if (regSec) regSec.style.display = 'none';
  if (refSec) refSec.style.display = 'block';
  if (myRefInput) myRefInput.value = myRefId || '';
}

// ---------- 紹介IDコピー & シェア ----------
function onClickCopyRefId() {
  const myRefInput = qs('#myRefId');
  if (!myRefInput || !myRefInput.value) {
    setRefStatus('紹介IDが見つかりません。', true);
    return;
  }
  const text = myRefInput.value;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard
      .writeText(text)
      .then(function () {
        setRefStatus('紹介IDをコピーしました。', false);
      })
      .catch(function (e) {
        logError(e);
        setRefStatus('コピーに失敗しました。手動で選択してコピーしてください。', true);
      });
  } else {
    // 古いブラウザ向けフォールバック
    myRefInput.select();
    try {
      const ok = document.execCommand('copy');
      setRefStatus(ok ? '紹介IDをコピーしました。' : 'コピーに失敗しました。手動でコピーしてください。', !ok);
    } catch (e) {
      logError(e);
      setRefStatus('コピーに失敗しました。手動でコピーしてください。', true);
    }
  }
}

function onClickShareRefLink() {
  const myRefInput = qs('#myRefId');
  if (!myRefInput || !myRefInput.value) {
    setRefStatus('紹介IDが見つかりません。', true);
    return;
  }
  const myRefId = myRefInput.value;
  const url = 'https://himegoto.jp/register.html?ref=' + encodeURIComponent(myRefId);

  if (navigator.share) {
    navigator
      .share({
        title: 'himegoto 登録',
        text: 'himegoto の登録はこちらから',
        url: url
      })
      .then(function () {
        setRefStatus('紹介リンクを共有しました。', false);
      })
      .catch(function (e) {
        if (e && e.name === 'AbortError') return;
        logError(e);
        setRefStatus('共有に失敗しました。LINEなどでURLを貼り付けてください。', true);
      });
  } else {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(url)
        .then(function () {
          setRefStatus('紹介用URLをコピーしました。トークに貼り付けて送ってください。', false);
        })
        .catch(function (e) {
          logError(e);
          setRefStatus('共有機能が使えませんでした。URLを手動で入力してください。', true);
        });
    } else {
      setRefStatus('共有機能が使えませんでした。URLを手動で入力してください。', true);
    }
  }
}

// ---------- 初期化 ----------
window.addEventListener('load', function () {
  try {
    auth = firebase.auth();
    db = firebase.firestore();
  } catch (e) {
    logError(e);
    setStatus('内部エラーが発生しました。時間をおいて再度お試しください。', true);
    return;
  }

  prefillRefCodeFromQuery();
  setupRecaptcha();
  bindEvents();
  console.log('app-register.js initialized');
});
