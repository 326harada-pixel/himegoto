import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import {
    getFirestore, doc, getDoc, setDoc, updateDoc, collection, addDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";
import {
    getAuth, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyB-Mh8kB9oIhM3uOeJVpXsbpbVAWS2I3W8",
    authDomain: "himegoto-web.firebaseapp.com",
    projectId: "himegoto-web",
    storageBucket: "himegoto-web.appspot.com",
    messagingSenderId: "926868957818",
    appId: "1:926868957818:web:9d68ed1c57df4e3ea59c1f"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth();

// ===== メニュー =====
window.toggleMenu = function () {
    document.getElementById("sideMenu").classList.toggle("open");
};

// ===== ログアウト =====
window.logout = function () {
    signOut(auth);
};

// =========================
//  ★ Premium 残時間計算
// =========================
function updatePremiumTime(premiumUntil) {
    const box = document.getElementById("premiumTimeDisplay");

    if (!premiumUntil) {
        box.textContent = "無制限残り時間 0日 0時間 0分";
        return;
    }

    const now = new Date();
    const end = premiumUntil.toDate();
    const diff = end - now;

    if (diff <= 0) {
        box.textContent = "無制限残り時間 0日 0時間 0分";
        return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / (1000 * 60)) % 60);

    box.textContent = `無制限残り時間 ${days}日 ${hours}時間 ${minutes}分`;
}

// =========================
//  Firestoreユーザーデータ読込
// =========================
async function loadUserData(uid) {
    const userRef = doc(db, "users", uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) return;

    const data = userSnap.data();

    // ★ Premium時間更新
    updatePremiumTime(data.premium_until);
}

// =========================
//  顧客まわり（既存）
// =========================
window.addCustomer = async function () {
    const name = document.getElementById("customerName").value.trim();
    if (!name) return;

    const uid = auth.currentUser.uid;
    const colRef = collection(db, "users", uid, "customers");

    await addDoc(colRef, {
        name: name,
        created_at: new Date()
    });

    document.getElementById("customerName").value = "";
    loadCustomers();
};

async function loadCustomers() {
    const uid = auth.currentUser.uid;
    const colRef = collection(db, "users", uid, "customers");
    const snap = await getDocs(colRef);

    const list = document.getElementById("customerList");
    list.innerHTML = "";

    snap.forEach((docu) => {
        const div = document.createElement("div");
        div.textContent = docu.data().name;
        list.appendChild(div);
    });
}

window.sendMessage = function () {
    alert("送信(仮)");
};

// =========================
//  Auth 監視
// =========================
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "register.html";
        return;
    }

    await loadUserData(user.uid);
    loadCustomers();
});
