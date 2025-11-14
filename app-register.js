(function(){
  const $ = (s)=>document.querySelector(s);
  const on = (el,ev,fn)=>el&&el.addEventListener(ev,fn);

  // --- グローバル変数（Firebase初期化はHTML側で完了済み） ---
  const auth = firebase.auth();
  const db = firebase.firestore();
  // 紹介リンクのベースURL（重要：デプロイ先のドメインに合わせてください）
  const APP_URL = "https://himegoto.jp/register.html"; // 仮のドメイン

  // --- DOM要素 ---
  const regSection = $('#registration-section'); // 未認証時
  const refSection = $('#my-referral-section'); // 認証済み時
  
  // 登録フォーム
  const tabSms = $('#tabSms'), tabMail = $('#tabMail');
  const paneSms = $('#paneSms'), paneMail = $('#paneMail');
  const smsMsg = $('#smsMessage');
  const phoneInput = $('#phoneInput');
  const sendCodeSms = $('#sendCodeSms');
  const codeSms = $('#codeSms');
  const refCodeInput = $('#refCode'); // 紹介コード入力欄
  const verifySms = $('#verifySms');
  const sendCodeMail = $('#sendCodeMail');
  const verifyMail = $('#verifyMail');
  
  // 紹介ID表示
  const myRefId = $('#myRefId');
  const copyRefId = $('#copyRefId');
  const shareRefLink = $('#shareRefLink');
  const refMessage = $('#refMessage');
  
  // --- 状態変数 ---
  let confirmationResult = null; // SMS認証の確認結果

  // ==========================================================
  // 1. 起動時の処理 (認証状態の監視)
  // ==========================================================
  auth.onAuthStateChanged(user => {
    if (user) {
      // --- 認証済みの場合 ---
      regSection.style.display = 'none'; // 登録フォームを隠す
      refSection.style.display = 'block'; // 紹介ID欄を表示
      setupMyReferralSection(user.uid);
    } else {
      // --- 未認証の場合 ---
      regSection.style.display = 'block'; // 登録フォームを表示
      refSection.style.display = 'none'; // 紹介ID欄を隠す
      checkUrlForReferral(); // URLに紹介コードがないかチェック
    }
  });

  // ==========================================================
  // 2. 未認証時の処理
  // ==========================================================

  // 2a. URLをチェックし、紹介コードがあれば自動入力
  function checkUrlForReferral() {
    try {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get('ref'); // ?ref=XXXXXX
      if (ref && refCodeInput) {
        refCodeInput.value = ref;
        showMessage('紹介コードが入力されました。', false);
      }
    } catch (e) {
      console.warn("URLSearchParams not supported or URL invalid", e);
    }
  }

  // 2b. タブ切替
  function sel(tab){
    const sms = (tab==='sms');
    paneSms.style.display = sms ? '' : 'none';
    paneMail.style.display = sms ? 'none' : '';
    tabSms.classList.toggle('primary', sms);
    tabMail.classList.toggle('primary', !sms);
    tabSms.setAttribute('aria-selected', sms?'true':'false');
    tabMail.setAttribute('aria-selected', !sms?'true':'false');
    showMessage('', false);
  }
  on(tabSms,'click',()=>sel('sms'));
  on(tabMail,'click',()=>sel('mail'));

  // 2c. 補助関数 (メッセージ表示)
  function showMessage(text, isError) {
    if (!smsMsg) return;
    smsMsg.textContent = text;
    smsMsg.style.color = isError ? '#D32F2F' : '#4CAF50';
  }
  
  // 2d. 電話番号を国際形式(+81)に変換
  function toInternationalFormat(phone) {
    if (!phone) return '';
    if (phone.startsWith('+')) return phone;
    if (phone.startsWith('0')) return '+81' + phone.substring(1);
    return '+81' + phone;
  }

  // --- 3. reCAPTCHAのセットアップ（クリック時に実行） ---
  function getRecaptchaVerifier() {
    // 既に初期化されていれば、それを返す
    if (window.recaptchaVerifier) {
      return window.recaptchaVerifier;
    }
    
    // なければ、新しく作成
    // HTMLの 'recaptcha-container' を使う
    window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
      'size': 'invisible',
      'callback': (response) => { 
        console.log("reCAPTCHA verified."); 
      }
    }, auth);
    
    return window.recaptchaVerifier;
  }

  // --- 4. 認証と登録のロジック ---

  // 4a. 認証コード送信
  on(sendCodeSms,'click',() => {
    // ★修正点: reCAPTCHAの準備をここで実行
    const appVerifier = getRecaptchaVerifier();
    
    const phoneNumber = toInternationalFormat(phoneInput.value.trim());

    if (!phoneNumber) {
      showMessage('電話番号を入力してください。', true);
      return;
    }

    sendCodeSms.disabled = true;
    showMessage('認証コードを送信中...', false);

    auth.signInWithPhoneNumber(phoneNumber, appVerifier)
      .then((result) => {
        confirmationResult = result;
        showMessage('認証コードを送信しました。', false);
        sendCodeSms.disabled = false;
      })
      .catch((error) => {
        console.error("SMS送信エラー:", error);
        if (error.code === 'auth/invalid-phone-number') {
            showMessage('電話番号の形式が正しくありません。', true);
        } else {
            showMessage('SMS送信に失敗しました。時間をおいて再度お試しください。', true);
        }
        sendCodeSms.disabled = false;
        
        // reCAPTCHAが失敗した場合、次のクリックで再初期化されるようにする
        window.recaptchaVerifier = null;
      });
  });

  // 4b. 認証コード確認 と 登録処理
  on(verifySms,'click',() => {
    const code = codeSms.value.trim();
    if (!code) {
      showMessage('認証コードを入力してください。', true);
      return;
    }
    if (!confirmationResult) {
      showMessage('先に「コード送信」を押してください。', true);
      return;
    }

    verifySms.disabled = true;
    showMessage('コードを照合し、登録中です...', false);

    // 1. 認証コードの確認
    confirmationResult.confirm(code)
      .then(async (result) => {
        const user = result.user;
        const uid = user.uid;
        console.log("SMS認証成功:", uid);

        // 2. Firestoreに初期データを書き込む
        const docRef = db.collection('users').doc(uid).collection('purchases').doc('current');
        await docRef.set({
          expiresAt: null,
          registeredAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // 3. 紹介コードを保存
        const appliedRefCode = refCodeInput.value.trim() || '';
        const profileRef = db.collection('users').doc(uid).collection('profile').doc('info');
        await profileRef.set({
          appliedRefCode: appliedRefCode
        });

        // alert('アカウント登録が完了しました！'); 
        // このアラートは不要。onAuthStateChangedが自動でUIを切り替える
      })
      .catch((error) => {
        console.error("SMSコード確認または登録エラー:", error);
        showMessage('認証コードが正しくないか、登録に失敗しました。', true);
        verifySms.disabled = false;
      });
  });

  // 4c. メール認証（ダミー）
  on(sendCodeMail,'click',()=>alert('メールコードを送信しました（ダミー）'));
  on(verifyMail,'click',()=>alert('メールコードを確認しました（ダミー）'));

  // ==========================================================
  // 5. 認証済み時の処理 (紹介ID表示)
  // ==========================================================
  
  function setupMyReferralSection(uid) {
    // uidの最初の8文字を「紹介ID」とする
    const refId = uid.substring(0, 8);
    
    if (myRefId) {
      myRefId.value = refId;
    }
    
    // 5a. コピーボタン
    on(copyRefId, 'click', () => {
      myRefId.select();
      // navigator.clipboard.writeTextはiframe内で権限がない場合があるため、
      // 開発ルール（`document.execCommand`）に基づき、execCommandを使用します。
      document.execCommand('copy'); 
      
      if(refMessage) refMessage.textContent = 'IDをコピーしました！';
      setTimeout(() => { if(refMessage) refMessage.textContent = ''; }, 2000);
    });

    // 5b. 紹介リンクを送るボタン
    on(shareRefLink, 'click', async () => {
      const shareUrl = `${APP_URL}?ref=${refId}`;
      const shareText = `himegotoに登録しませんか？\nこのリンクから登録すると特典があります🎁\n${shareUrl}`;

      try {
        if (navigator.share) {
          // Web Share API (スマホ)
          await navigator.share({
            title: 'himegotoの紹介',
            text: shareText,
            url: shareUrl
          });
        } else {
          // PC (クリップボードにコピー)
          await navigator.clipboard.writeText(shareUrl);
          if(refMessage) refMessage.textContent = '紹介リンクをコピーしました！';
          setTimeout(() => { if(refMessage) refMessage.textContent = ''; }, 3000);
        }
      } catch (err) {
        console.error('シェアまたはコピーに失敗:', err);
        // PCの `writeText` が失敗した場合のフォールバック
        try {
            myRefId.value = shareUrl; // 紹介IDの代わりにURLを一時的に入力
            myRefId.select();
            document.execCommand('copy');
            myRefId.value = refId; // 元のIDに戻す
            if(refMessage) refMessage.textContent = '紹介リンクをコピーしました！';
            setTimeout(() => { if(refMessage) refMessage.textContent = ''; }, 3000);
        } catch(e) {
            if(refMessage) refMessage.textContent = 'リンクのコピーに失敗しました。';
        }
      }
    });
  }

})();
