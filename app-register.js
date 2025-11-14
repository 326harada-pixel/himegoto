// app-register.js
// 開発サポート：Gemini
// 目的：SMS認証フローの実装と、Firestoreへの初期データ書き込み。

const $ = (s) => document.querySelector(s);
// register.htmlで初期化されたFirebaseインスタンスを使う
// 既にグローバル変数として存在する
const auth = firebase.auth();
const db = firebase.firestore();

// --- DOM elements ---
const sendCodeButton = $('#sendCodeSms'); // ID変更
const verifyCodeButton = $('#verifySms');   // ID変更
const phoneNumberInput = $('#phoneInput'); // ID変更
const verificationCodeInput = $('#codeSms'); // ID変更
const errorMessage = $('#error-message');
const statusMessage = $('#auth-status-message');
const registerButton = $('#registerBtn');
const agreeCheckbox = $('#agree');
const passwordInput1 = $('#pw1');
const passwordInput2 = $('#pw2');

// reCAPTCHAはpaneSmsの下にある前提
const recaptchaContainer = $('#recaptcha-container');
const paneSms = $('#paneSms');

let confirmationResult = null; // 認証コードの検証に必要なオブジェクトを保持
let isSmsVerified = false; // SMS認証が成功したかどうかのフラグ

// ------------------------------------------
// 補助関数
// ------------------------------------------

function showMessage(el, text, isError = false) {
    el.textContent = text;
    el.style.color = isError ? 'red' : 'green';
}

function updateUIForAuth(user) {
    if (user) {
        // ログイン済み (UIDを持っている)
        showMessage(statusMessage, `ログイン完了: UID ${user.uid}`, false);
        sendCodeButton.disabled = true;
        verifyCodeButton.disabled = true;
        registerButton.disabled = true; // 認証完了時は、もう登録済みなのでボタンは押させない
        
        // TODO: 認証後のプロフィール・紹介コードの保存ロジックを追加する
        // TODO: ホームへリダイレクトするロジックを実装する (今回は動作確認優先で一時保留)
        
        // ログイン後処理（Firestoreチェック）
        // checkUserPurchases(user.uid); // 後ほど、課金システム実装時に利用
    } else {
        // 未ログイン
        showMessage(statusMessage, '携帯番号によるSMS認証が必要です。', false);
        sendCodeButton.disabled = false;
        verifyCodeButton.disabled = true; // コード確認は未送信時は無効
        registerButton.disabled = true; // SMS認証とパスワード入力が完了するまで無効
        isSmsVerified = false;

        // reCAPTCHAの初期化 (ウィンドウ全体で1回のみ)
        if (!window.recaptchaVerifier && paneSms.style.display !== 'none') {
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
    updateUIForAuth(user);
});

// ------------------------------------------
// 2. 認証コードの送信処理 (Step 1)
// ------------------------------------------

sendCodeButton && sendCodeButton.addEventListener('click', () => {
    const phoneNumber = phoneNumberInput.value.trim();
    errorMessage.textContent = '';
    
    // 国際形式 (+81...) への変換をユーザーに促す
    if (!phoneNumber || phoneNumber.length < 10) {
        showMessage(errorMessage, '有効な電話番号（国際形式推奨）を入力してください。', true);
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
            
            sendCodeButton.disabled = false;
            verifyCodeButton.disabled = false;
            showMessage(statusMessage, '6桁の認証コードが届くのをお待ちください。', false);
        })
        .catch((error) => {
            console.error("SMS送信エラー:", error);
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
// 3. 認証コードの検証 (Step 2)
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
            // SMS認証成功（ただし、まだFirebaseに登録は完了していない状態）
            console.log("SMS認証成功:", result.user.uid);
            showMessage(statusMessage, 'SMS認証が完了しました。パスワードを設定し、「登録する」を押してください。', false);
            isSmsVerified = true;
            
            // SMS検証成功後、パスワード入力と利用規約同意で登録ボタンを有効にするための監視を開始
            checkRegistrationReadiness();
            
            verifyCodeButton.disabled = true; // 再度押せないようにする
            phoneNumberInput.disabled = true; // 電話番号も変更不可にする
            sendCodeButton.disabled = true;

        })
        .catch((error) => {
            console.error("認証コード検証エラー:", error);
            showMessage(errorMessage, `認証コードが正しくありません。再度お試しください。 (Code: ${error.code})`, true);
            verifyCodeButton.disabled = false;
        });
});

// ------------------------------------------
// 4. 登録ボタンの有効化チェック (パスワードと同意)
// ------------------------------------------

function checkRegistrationReadiness() {
    const pw1 = passwordInput1.value || '';
    const pw2 = passwordInput2.value || '';
    const isPwValid = pw1.length >= 8 && pw1 === pw2;
    const isAgreed = agreeCheckbox.checked;

    // SMS認証済み AND パスワード有効 AND 同意済み の全てが揃ったら有効
    registerButton.disabled = !(isSmsVerified && isPwValid && isAgreed);
}

// パスワード入力と同意チェックボックスの監視
passwordInput1.addEventListener('input', checkRegistrationReadiness);
passwordInput2.addEventListener('input', checkRegistrationReadiness);
agreeCheckbox.addEventListener('change', checkRegistrationReadiness);

// ------------------------------------------
// 5. 登録処理 (Firebase Authへの正式な登録とFirestore初期データ作成)
// ------------------------------------------

registerButton && registerButton.addEventListener('click', async () => {
    errorMessage.textContent = '';
    
    // 最終バリデーション
    const pw1 = passwordInput1.value || '';
    if(pw1.length < 8) { showMessage(errorMessage, 'パスワードは8文字以上にしてください。', true); return; }
    if(passwordInput1.value !== passwordInput2.value) { showMessage(errorMessage, 'パスワードが一致しません。', true); return; }
    if(!agreeCheckbox.checked) { showMessage(errorMessage, '各規約への同意が必要です。', true); return; }

    registerButton.disabled = true;
    showMessage(statusMessage, '登録処理中です...しばらくお待ちください。', false);

    try {
        // SMS認証で得られた結果を使って、ユーザーを最終的に確定させる
        // ただし、Firebase Phone AuthはSMS検証成功＝ログイン完了なので、
        // ここでの処理は Firestoreへの初期データ作成とリダイレクトになる。

        const user = auth.currentUser;
        if (!user || user.phoneNumber !== phoneNumberInput.value.trim()) {
            throw new Error("認証状態が不正です。最初からやり直してください。");
        }
        
        // Firestoreに初期データ（課金情報）を作成
        await initializeUserFirestore(user.uid);

        // ホーム画面へリダイレクト（認証完了後）
        alert('アカウント登録が完了しました！ホーム画面へ移動します。'); // TODO: カスタムモーダル
        location.href = 'index.html'; 

    } catch (error) {
        console.error("最終登録エラー:", error);
        showMessage(errorMessage, `登録に失敗しました: ${error.message}`, true);
        registerButton.disabled = false;
    }
});


// ------------------------------------------
// 6. Firestore初期データ作成
// ------------------------------------------

/**
 * ユーザーのFirestoreに初期データ（課金情報）を作成する
 * @param {string} uid 
 */
async function initializeUserFirestore(uid) {
    // データ設計: users/{uid}/purchases/current
    const purchaseDocRef = db.collection('users').doc(uid).collection('purchases').doc('current');
    
    // データ設計: users/{uid}/profile/main (プロフィールと紹介コードを保存)
    const profileDocRef = db.collection('users').doc(uid).collection('profile').doc('main');

    // 課金初期データ: expiresAt: null（無料）
    const purchaseData = {
        expiresAt: null, 
        registeredAt: firebase.firestore.FieldValue.serverTimestamp(),
    };
    await purchaseDocRef.set(purchaseData, { merge: true }); // merge: trueで既存フィールドを上書きしない

    // プロフィールデータ（登録時に任意で入力されたもの）
    const profileData = {
        displayName: ($('#displayName') && $('#displayName').value) || null,
        shopName: ($('#shopName') && $('#shopName').value) || null,
        birthday: ($('#birthday') && $('#birthday').value) || null,
        referralCodeUsed: ($('#referralIdInput') && $('#referralIdInput').value) || null, // 紹介コード
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
    };
    await profileDocRef.set(profileData, { merge: true });
    
    console.log("Firestore initialized for UID:", uid);
                                                                                       }
