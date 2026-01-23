(function(){
  const $ = (s) => document.querySelector(s);
  const on = (el,ev,fn) => el && el.addEventListener(ev, fn);

  // エラーログ表示
  function logError(msg) {
    const el = $('#error-log');
    if(el) {
      el.style.display = 'block';
      el.textContent = `【エラー診断】\n${msg}`;
    }
    console.error(msg);
  }

  const auth = firebase.auth();
  const db = firebase.firestore();
  const APP_URL = "https://himegoto.jp/register.html"; 

  // DOM要素
  const regSection = $('#registration-section'); 
  const refSection = $('#my-referral-section'); 
  const smsMsg = $('#smsMessage');
  const phoneInput = $('#phoneInput');
  const sendCodeSms = $('#sendCodeSms'); 
  const codeSms = $('#codeSms');
  const refCodeInput = $('#refCode'); 
  const verifySms = $('#verifySms');
  const myRefId = $('#myRefId');
  const copyRefId = $('#copyRefId');
  const shareRefLink = $('#shareRefLink');
  const refMessage = $('#refMessage');

  // 紹介表示
  const refCountEl = $('#refCount');
  const refNextEl = $('#refNext');
  const refBonusTimesEl = $('#refBonusTimes');

  let confirmationResult = null;
  let recaptchaWidgetId = null; 

  
  function safeResetRecaptcha() {
    // 環境差でreCAPTCHAが固まった時の復旧（失敗しても落とさない）
    try {
      if (window.grecaptcha && typeof window.recaptchaWidgetId !== 'undefined') {
        window.grecaptcha.reset(window.recaptchaWidgetId);
        return;
      }
    } catch (e) {}
    try {
      if (window.recaptchaVerifier) window.recaptchaVerifier.clear();
    } catch (e) {}
    try {
      setupRecaptcha();
    } catch (e) {}
  }

// メッセージ表示
  function showMessage(text, isError) {
    if (!smsMsg) return;
    smsMsg.textContent = text;
    smsMsg.className = isError ? 'status-msg status-error' : 'status-msg status-success';
  }

  // 電話番号整形 (+81)
  function toInternationalFormat(phone) {
    if (!phone) return '';
    let p = phone.replace(/[━.*+\s-]/g, '');
    if (p.startsWith('0')) return '+81' + p.substring(1);
    return '+81' + p;
  }

  // reCAPTCHA 初期化
  function setupRecaptcha() {
    const container = document.getElementById('recaptcha-container');
    if (!container) {
      logError("recaptcha-container が見つかりません。HTML側のIDを確認してください。");
      return;
    }

    if (window.recaptchaVerifier) {
      try { window.recaptchaVerifier.clear(); } catch(e){}
      container.innerHTML = ""; 
    }

    try {
      window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
        'size': 'normal',
        'callback': () => {
          showMessage("認証OK。コード送信ボタンを押してください。", false);
          sendCodeSms.disabled = false;
          sendCodeSms.textContent = "コード送信";
        },
        'expired-callback': () => {
          showMessage("有効期限切れです。チェックし直してください。", true);
          sendCodeSms.disabled = true;
        }
      });

      window.recaptchaVerifier.render().then((widgetId) => {
        recaptchaWidgetId = widgetId;
        window.recaptchaWidgetId = widgetId;
      }).catch(error => {
        let hint = "";
        if (error.code === 'auth/invalid-api-key') {
            hint = "★重要: Google Cloud の API キー設定が未反映の可能性。";
        }
        logError(`reCAPTCHA エラー: ${error.code}\n${hint}`);
      });

    } catch (e) {
      logError(`reCAPTCHA 初期化エラー: ${e.message}`);
    }
  }

  // 起動処理
  document.addEventListener("DOMContentLoaded", () => {

    auth.onAuthStateChanged(user => {
      if (user) {
        if (regSection) regSection.style.display = 'none';
        if (refSection) refSection.style.display = 'block';
        setupMyReferralSection(user.uid);

      } else {
        if (regSection) regSection.style.display = 'block';
        if (refSection) refSection.style.display = 'none';

        // 紹介コード付きURL対応
        const params = new URLSearchParams(window.location.search);
        const ref = params.get('ref'); 
        if (ref && refCodeInput) refCodeInput.value = ref;

        setTimeout(setupRecaptcha, 500);
      }
    });

  });

  // コード送信
  on(sendCodeSms, 'click', () => {
    const rawPhone = phoneInput.value.trim();
    if (!rawPhone) {
      showMessage('電話番号を入力してください。', true);
      return;
    }
    const phoneNumber = toInternationalFormat(rawPhone);

    if (!window.recaptchaVerifier) {
      showMessage('reCAPTCHA を読み込んでいます…', true);
      setupRecaptcha();
      return;
    }

    sendCodeSms.disabled = true;
    showMessage('送信中...', false);

    auth.signInWithPhoneNumber(phoneNumber, window.recaptchaVerifier)
      .then((result) => {
        confirmationResult = result;
        showMessage('送信完了！届いた6桁のコードを入力してください。', false);

        sendCodeSms.disabled = false;
        sendCodeSms.textContent = "再送信";

        codeSms.disabled = false;
        verifySms.disabled = false;
      })
      .catch((error) => {
        sendCodeSms.disabled = false;
        let msg = error.message;
        if (error.code === 'auth/invalid-api-key') msg = "APIキーが無効です。";

        showMessage("送信失敗: " + msg, true);
        safeResetRecaptcha();
      });
  });

  // 登録
  on(verifySms, 'click', () => {
    const code = codeSms.value.trim();
    if (!code || !confirmationResult) return;

    verifySms.disabled = true;
    showMessage('確認中...', false);

    confirmationResult.confirm(code)
      .then(async (result) => {
        const user = result.user;

        // 登録情報（既存仕様）
        await db.collection('users').doc(user.uid).collection('purchases').doc('current').set({
          expiresAt: null,
          registeredAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        const appliedRef = (refCodeInput ? refCodeInput.value.trim() : '') || '';
        await handleRegistrationAndReferral(user.uid, appliedRef);

        alert('登録が完了しました！');
        location.reload();
      })
      .catch((error) => {
        verifySms.disabled = false;
        if (error.code === 'auth/invalid-verification-code') {
            showMessage('コードが違います。', true);
        } else {
            showMessage("認証エラー: " + error.message, true);
        }
      });
  });

  // 紹介関連
  function setupMyReferralSection(uid) {
    const refId = uid.substring(0, 8);
    if (myRefId) myRefId.value = refId;

    // 紹介コードの登録（未登録なら作る）
    try {
      db.collection('refCodes').doc(refId).set({
        uid: uid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    } catch(e) {}

    // 紹介カウント表示
    try {
      db.collection('users').doc(uid).collection('profile').doc('info').get().then((doc) => {
        const d = (doc && doc.exists) ? (doc.data() || {}) : {};
        const cnt = Number(d.refSuccessCount || 0);
        if (refCountEl) refCountEl.textContent = String(cnt);

        const mod = cnt % 3;
        const next = (mod === 0) ? 3 : (3 - mod);
        if (refNextEl) refNextEl.textContent = String(next);

        const bonusTimes = Math.floor(cnt / 3);
        if (refBonusTimesEl) refBonusTimesEl.textContent = String(bonusTimes);
      });
    } catch(e) {}

    on(copyRefId, 'click', () => {
      myRefId.select();
      document.execCommand('copy'); 
      if(refMessage) {
        refMessage.textContent = 'コピーしました';
        refMessage.className = 'status-msg status-success';
      }
    });

    on(shareRefLink, 'click', async () => {
      const shareUrl = `${APP_URL}?ref=${refId}`;
      const shareText = `himegoto に登録しませんか？\n特典付きリンクはこちら🎁\n${shareUrl}`;
      try {
        if (navigator.share) {
          await navigator.share({ title: 'himegoto', text: shareText, url: shareUrl });
        } else {
          await navigator.clipboard.writeText(shareUrl);
          if(refMessage) {
            refMessage.textContent = 'リンクをコピーしました';
            refMessage.className = 'status-msg status-success';
          }
        }
      } catch (e) {}
    });
  }

  // --- 紹介の処理 ---
  function addDaysToUntilMs(curMs, addDays) {
    const now = Date.now();
    const base = Math.max(now, Number(curMs || 0));
    return base + (addDays * 24 * 60 * 60 * 1000);
  }

  function toMs(v) {
    try {
      if (!v) return 0;
      if (typeof v === 'number') return v;
      if (typeof v === 'string') {
        const t = Date.parse(v);
        return Number.isFinite(t) ? t : 0;
      }
      if (typeof v.toDate === 'function') return v.toDate().getTime();
      if (typeof v.seconds === 'number') return v.seconds * 1000;
    } catch(e) {}
    return 0;
  }

  async function handleRegistrationAndReferral(uid, appliedRefCode) {
    const myRefId = uid.substring(0, 8);

    // 自分の紹介コードを登録（検索用）
    try {
      await db.collection('refCodes').doc(myRefId).set({
        uid: uid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    } catch(e) {}

    const myInfoRef = db.collection('users').doc(uid).collection('profile').doc('info');

    // 登録者側の基本情報を補完（既存値は上書きしない）
    await myInfoRef.set({
      appliedRefCode: appliedRefCode || '',
      refSuccessCount: 0,
      refRewardedCount: 0
    }, { merge: true });

    // 紹介コードが空ならここで終わり
    if (!appliedRefCode) return;

    // 自分のコードは不可
    if (appliedRefCode === myRefId) return;

    // 紹介コード -> UID を引く
    const codeDoc = await db.collection('refCodes').doc(appliedRefCode).get();
    if (!codeDoc || !codeDoc.exists) return;
    const refUid = String((codeDoc.data() || {}).uid || '');
    if (!refUid) return;

    const refInfoRef = db.collection('users').doc(refUid).collection('profile').doc('info');

    // ここからは同時更新（事故防止）
    await db.runTransaction(async (tx) => {
      const mySnap = await tx.get(myInfoRef);
      const myData = (mySnap && mySnap.exists) ? (mySnap.data() || {}) : {};

      // すでに紹介処理済みなら何もしない
      if (myData.refAppliedAt) return;

      // 紹介された側：無制限 +1日
      const myUntilMs = toMs(myData.proUntil);
      const myNewUntilMs = addDaysToUntilMs(myUntilMs, 1);
      tx.set(myInfoRef, {
        plan: 'pro',
        proUntil: new Date(myNewUntilMs),
        refAppliedAt: firebase.firestore.FieldValue.serverTimestamp(),
        refAppliedUid: refUid
      }, { merge: true });

      // 紹介した側：紹介人数 +1、3人ごとに +3日
      const refSnap = await tx.get(refInfoRef);
      const refData = (refSnap && refSnap.exists) ? (refSnap.data() || {}) : {};
      const oldSuccess = Number(refData.refSuccessCount || 0);
      const oldRewarded = Number(refData.refRewardedCount || 0);
      const newSuccess = oldSuccess + 1;
      const shouldTimes = Math.floor(newSuccess / 3);
      const addTimes = Math.max(0, shouldTimes - oldRewarded);

      let refNewUntilMs = toMs(refData.proUntil);
      if (addTimes > 0) {
        refNewUntilMs = addDaysToUntilMs(refNewUntilMs, addTimes * 3);
      }

      tx.set(refInfoRef, {
        refSuccessCount: newSuccess,
        refRewardedCount: oldRewarded + addTimes,
        ...(addTimes > 0 ? { plan: 'pro', proUntil: new Date(refNewUntilMs) } : {})
      }, { merge: true });
    });
  }

})();