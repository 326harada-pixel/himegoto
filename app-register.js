
// himegoto register - SMS 認証＆紹介ID発行フロー（Firebase v9 compat）

let auth, db, confirmationResult;

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

function setupFirebase() {
  try {
    auth = firebase.auth();
    db = firebase.firestore();
  } catch (e) {
    console.error('Firebase init error', e);
    setStatus('内部エラーが発生しました。時間をおいて再度お試しください。', true);
  }
}

function setupRecaptcha() {
  const sendBtn = qs('#sendCodeSms');
  if (sendBtn) sendBtn.disabled = true;

  try {
    window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier(
      'recaptcha-container',
      {
        size: 'normal',
        callback: function () {
          // チェック通過時
          if (sendBtn) sendBtn.disabled = false;
          setStatus('認証OKです。「コード送信」を押してください。', false);
        },
        'expired-callback': function () {
          if (sendBtn) sendBtn.disabled = true;
          setStatus('reCAPTCHA の有効期限が切れました。もう一度チェックしてください。', true);
        }
      },
      auth
    );

    window.recaptchaVerifier.render().catch(function (e) {
      console.error('reCAPTCHA render error', e);
      setStatus('reCAPTCHA の表示に失敗しました。ページを再読み込みしてください。', true);
    });
  } catch (e) {
    console.error('reCAPTCHA setup error', e);
    setStatus('reCAPTCHA の初期化に失敗しました。ページを再読み込みしてください。', true);
  }
}

// 0始まりの日本の携帯番号を +81 形式に変換
function toIntlPhone(raw) {
  let p = (raw || '').replace(/[^0-9]/g, '');
  if (!p) return null;
  if (p[0] === '0') {
    if (p.length === 10 || p.length === 11) {
      return '+81' + p.slice(1);
    } else {
      return null;
    }
  }
  if (p.startsWith('81') && p.length >= 11) {
    return '+' + p;
  }
  if (p.startsWith('+')) return p;
  return null;
}

function bindEvents() {
  const phoneInput = qs('#phoneInput');
  const codeInput = qs('#codeSms');
  const refInput = qs('#refCode');
  const sendBtn = qs('#sendCodeSms');
  const verifyBtn = qs('#verifySms');
  const copyBtn = qs('#copyRefId');
  const shareBtn = qs('#shareRefLink');

  if (codeInput) codeInput.disabled = true;
  if (verifyBtn) verifyBtn.disabled = true;

  if (sendBtn) {
    sendBtn.addEventListener('click', async function () {
      setStatus('', false);

      const intl = toIntlPhone(phoneInput && phoneInput.value);
      if (!intl) {
        setStatus('携帯番号の形式が正しくありません。ハイフンなしで入力してください。', true);
        return;
      }

      if (!window.recaptchaVerifier) {
        setStatus('reCAPTCHA が初期化されていません。ページを再読み込みしてください。', true);
        return;
      }

      sendBtn.disabled = true;

      try {
        confirmationResult = await auth.signInWithPhoneNumber(intl, window.recaptchaVerifier);
        setStatus('SMS を送信しました。届いた6桁のコードを入力してください。', false);
        if (codeInput) codeInput.disabled = false;
        if (verifyBtn) verifyBtn.disabled = false;
      } catch (e) {
        console.error('signInWithPhoneNumber error', e);
        let msg = 'SMS の送信に失敗しました。時間をおいて再度お試しください。';

        if (e.code === 'auth/invalid-phone-number') {
          msg = '携帯番号の形式が正しくありません。';
        } else if (e.code === 'auth/missing-phone-number') {
          msg = '携帯番号を入力してください。';
        } else if (e.code === 'auth/too-many-requests') {
          msg = '短時間にリクエストが集中しています。しばらく時間をおいてください。';
        } else if (e.code === 'auth/quota-exceeded') {
          msg = 'SMS の送信上限に達しました。時間をおいて再度お試しください。';
        }

        setStatus(msg, true);
        sendBtn.disabled = false;

        try {
          window.recaptchaVerifier.clear();
        } catch (_) {}
        setupRecaptcha();
      }
    });
  }

  if (verifyBtn) {
    verifyBtn.addEventListener('click', async function () {
      setStatus('', false);

      if (!confirmationResult) {
        setStatus('先に「コード送信」を行ってください。', true);
        return;
      }

      const code = (codeInput && codeInput.value.trim()) || '';
      if (!code) {
        setStatus('SMS で届いたコードを入力してください。', true);
        return;
      }

      verifyBtn.disabled = true;

      try {
        const result = await confirmationResult.confirm(code);
        const user = result.user;
        await afterRegister(user);
      } catch (e) {
        console.error('confirm error', e);
        let msg = '認証に失敗しました。コードが正しいか確認してください。';
        if (e.code === 'auth/invalid-verification-code') {
          msg = '認証コードが正しくありません。';
        } else if (e.code === 'auth/code-expired') {
          msg = '認証コードの有効期限が切れました。もう一度コード送信からやり直してください。';
        }
        setStatus(msg, true);
        verifyBtn.disabled = false;
      }
    });
  }

  if (copyBtn) {
    copyBtn.addEventListener('click', async function () {
      const idInput = qs('#myRefId');
      if (!idInput || !idInput.value) return;

      try {
        await navigator.clipboard.writeText(idInput.value);
        setRefStatus('紹介IDをコピーしました。', false);
      } catch (e) {
        console.error('clipboard error', e);
        setRefStatus('コピーできませんでした。手動で選択してください。', true);
      }
    });
  }

  if (shareBtn) {
    shareBtn.addEventListener('click', async function () {
      const idInput = qs('#myRefId');
      if (!idInput || !idInput.value) return;

      const id = idInput.value;
      const url = 'https://himegoto.jp/register.html?ref=' + encodeURIComponent(id);
      const text = 'himegoto の紹介ID: ' + id + '\\n登録はこちらから→ ' + url;

      try {
        if (navigator.share) {
          await navigator.share({ text, url });
        } else if (navigator.clipboard) {
          await navigator.clipboard.writeText(url);
          setRefStatus('紹介リンクをクリップボードにコピーしました。', false);
        } else {
          setRefStatus('共有機能が利用できませんでした。URL を手動で共有してください。', true);
        }
      } catch (e) {
        console.error('share error', e);
        setRefStatus('共有に失敗しました。', true);
      }
    });
  }
}

// Firestore へ登録情報を書き込んで、紹介画面へ切り替え
async function afterRegister(user) {
  try {
    const uid = user.uid;
    const phone = user.phoneNumber || '';
    const refInput = qs('#refCode');
    const refCode = (refInput && refInput.value.trim()) || null;

    const userDoc = db.collection('users').doc(uid);

    await userDoc.collection('profile').doc('info').set(
      {
        phone: phone,
        referral: refCode || null,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    await userDoc.collection('purchases').doc('current').set(
      {
        plan: 'free',
        expiresAt: null
      },
      { merge: true }
    );

    const myRefId = uid.substring(0, 8);
    const idInput = qs('#myRefId');
    if (idInput) idInput.value = myRefId;

    const regSec = qs('#registration-section');
    const refSec = qs('#my-referral-section');
    if (regSec && refSec) {
      regSec.style.display = 'none';
      refSec.style.display = 'block';
    }

    setStatus('', false);
    setRefStatus('登録が完了しました。紹介IDをお友達に共有できます。', false);
  } catch (e) {
    console.error('afterRegister error', e);
    setStatus('登録情報の保存に失敗しました。時間をおいて再度お試しください。', true);
  }
}

// URL の ?ref=xxx を紹介コード欄に自動セット
function applyReferralFromQuery() {
  try {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) {
      const refInput = qs('#refCode');
      if (refInput && !refInput.value) {
        refInput.value = ref;
      }
    }
  } catch (e) {
    console.error('query parse error', e);
  }
}

window.addEventListener('load', function () {
  setupFirebase();
  setupRecaptcha();
  bindEvents();
  applyReferralFromQuery();
});
