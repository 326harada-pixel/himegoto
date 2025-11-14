// app-register.js

const $ = (s) => document.querySelector(s);
// register.htmlで初期化されたFirebaseインスタンスを使う
const auth = firebase.auth();
const db = firebase.firestore();

// --- DOM elements ---
const sendCodeButton = $('#sendCodeButton');
const verifyCodeButton = $('#verifyCodeButton');
const phoneNumberInput = $('#phoneNumber');
const verificationCodeInput = $('#verificationCode');
const recaptchaContainer = $('#recaptcha-container');
const errorMessage = $('#error-message');
const statusMessage = $('#auth-status-message');

const stepPhone = $('#step-phone-number');
const stepCode = $('#step-verification-code');
const referralSection = $('#referral-section');
const planStatus = $('#plan-status');
const daysLeft = $('#days-left');
const userInfo = $('#user-info'); // 新たに追加したUID表示エリア

let confirmationResult = null; // 認証コードの検証に必要なオブジェクトを保持

// ------------------------------------------
// 補助関数
// ------------------------------------------

function showMessage(el, text, isError = false) {
    el.textContent = text;
    el.style.color = isError ? 'red' : 'green';
}

function updateUIForUser(user) {
    if (user) {
        // ログイン済みUI
        stepPhone.classList.add('hidden');
        stepCode.classList.add('hidden');
        showMessage(statusMessage, `ログイン完了: アプリをご利用いただけます。`, false);
        userInfo.innerHTML = `あなたの**紹介ID (UID)**: <strong style="color: black;">${user.uid}</strong><br>※このIDを紹介に使えます。`;
        
        // ログイン成功後、UIステータスを更新する（Firestoreフェッチ待ち）
        planStatus.textContent = '確認中...';
        daysLeft.textContent = '確認中...';

        // ログイン後処理（Firestoreチェック）
        checkUserPurchases(user.uid);
    } else {
        // 未ログインUI
        stepPhone.classList.remove('hidden');
        stepCode.classList.add('hidden');
        showMessage(statusMessage, '携帯番号によるSMS認証が必要です。', false);
        planStatus.textContent = '無料';
        daysLeft.textContent = '0日';
        userInfo.textContent = '';

        // reCAPTCHAの初期化 (ウィンドウ全体で1回のみ)
        if (!window.recaptchaVerifier) {
            // FirebaseのSMS認証に必須のボット対策の仕組み
            window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier(recaptchaContainer, {
                'size': 'normal',
                'callback': (response) => { console.log("reCAPTCHA solved."); },
                'expired-callback': () => { console.log("reCAPTCHA expired. Please re-verify."); window.recaptchaVerifier.render(); }
            }, auth);
            // reCAPTCHAウィジェットの描画
            window.recaptchaVerifier.render(); 
        }
    }
    errorMessage.textContent = ''; 
}

// ------------------------------------------
// 1. Firebase Auth State Change (認証状態の監視)
// ------------------------------------------

auth.onAuthStateChanged(user => {
    updateUIForUser(user);
});

// ------------------------------------------
// 2. 認証コードの送信処理 (Step 1)
// ------------------------------------------

sendCodeButton && sendCodeButton.addEventListener('click', () => {
    const phoneNumber = phoneNumberInput.value.trim();
    errorMessage.textContent = '';
    
    if (!phoneNumber || phoneNumber.length < 10) {
        showMessage(errorMessage, '有効な電話番号を入力してください。', true);
        return;
    }
    
    if (!window.recaptchaVerifier) {
        showMessage(errorMessage, 'reCAPTCHAが読み込まれていません。ページを再読み込みしてください。', true);
        return;
    }

    sendCodeButton.disabled = true;

    // SMS認証コードの送信
    auth.signInWithPhoneNumber(phoneNumber, window.recaptchaVerifier)
        .then((confirmation) => {
            confirmationResult = confirmation;
            alert('認証コードを送信しました。'); // TODO: 後でカスタムモーダルに変更
            
            // UIを認証コード入力ステップに切り替え
            stepPhone.classList.add('hidden');
            stepCode.classList.remove('hidden');
            
            sendCodeButton.disabled = false;
        })
        .catch((error) => {
            console.error("SMS送信エラー:", error);
            // 日本語エラーメッセージの例
            let msg = '認証コードの送信に失敗しました。';
            if (error.code === 'auth/invalid-phone-number') {
                msg = '電話番号の形式が正しくありません。（+国番号から始めていますか？）';
            } else if (error.code === 'auth/quota-exceeded') {
                msg = '送信回数の上限を超えました。しばらく待ってからお試しください。';
            }
            showMessage(errorMessage, `${msg} (Code: ${error.code})`, true);
            sendCodeButton.disabled = false;
            window.recaptchaVerifier.render(); // reCAPTCHAをリセット
        });
});

// ------------------------------------------
// 3. 認証コードの検証とログイン処理 (Step 2)
// ------------------------------------------

verifyCodeButton && verifyCodeButton.addEventListener('click', () => {
    const code = verificationCodeInput.value.trim();
    errorMessage.textContent = '';
    
    if (!code || code.length !== 6) {
        showMessage(errorMessage, '6桁の認証コードを入力してください。', true);
        return;
    }
    
    if (!confirmationResult) {
        showMessage(errorMessage, '認証コードが送信されていません。最初からやり直してください。', true);
        return;
    }

    verifyCodeButton.disabled = true;

    // 認証コードの検証
    confirmationResult.confirm(code)
        .then((result) => {
            // ログイン成功 -> onAuthStateChanged が発火し UI が更新される
            console.log("ログイン成功:", result.user.uid);
            verifyCodeButton.disabled = false;

            // ホーム画面へリダイレクト（認証完了後）
            location.href = 'index.html'; 
        })
        .catch((error) => {
            console.error("認証コード検証エラー:", error);
            showMessage(errorMessage, `認証コードが正しくありません。再度お試しください。 (Code: ${error.code})`, true);
            verifyCodeButton.disabled = false;
        });
});

// ------------------------------------------
// 4. ログイン後のFirestore初期処理（プラン情報確認/作成）
// ------------------------------------------

/**
 * ログイン後、ユーザーの課金期限を確認し、未作成ならスキーマを作成する
 * @param {string} uid 
 */
async function checkUserPurchases(uid) {
    // データ設計: users/{uid}/purchases/current
    const docRef = db.collection('users').doc(uid).collection('purchases').doc('current');
    
    try {
        const doc = await docRef.get();
        if (doc.exists) {
            // 課金情報が存在する場合
            const data = doc.data();
            console.log("Existing purchase data:", data);
            
            // TODO: expiresAt (ISO8601形式)を元に残り日数を計算し、UIを更新するロジックを実装
            planStatus.textContent = '（期限付き）'; // 仮表示
            daysLeft.textContent = '（計算待ち）'; // 仮表示

        } else {
            // 課金情報が存在しない場合（新規ユーザー）
            console.log("No purchase data found. Initializing...");

            // 開発ルールに従い、expiresAt: null（無料）で初期データを作成
            const initData = {
                expiresAt: null, 
                registeredAt: firebase.firestore.FieldValue.serverTimestamp(),
            };
            await docRef.set(initData);
            
            planStatus.textContent = '無料';
            daysLeft.textContent = '0日';
        }
    } catch (e) {
        console.error("Firestore操作エラー:", e);
        planStatus.textContent = 'エラー';
        daysLeft.textContent = 'エラー';
        userInfo.textContent = 'Firebase接続エラーが発生しました。';
    }
}
