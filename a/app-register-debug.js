/* Admin debug helpers for referral flow.
 * Visible only when Firestore users/{uid}/info/info has isAdmin === true.
 * This file is safe to ship; panel remains hidden for normal users.
 */
(async () => {
  const $ = (id) => document.getElementById(id);

  const panel = $("adminDebugPanel");
  const out = $("dbgOut");
  const btnCheck = $("dbgCheckStateBtn");
  const btnApply = $("dbgApplyReferralBtn");

  if (!panel || !out || !btnCheck || !btnApply) return;

  const log = (obj) => {
    try {
      out.textContent = typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
    } catch (e) {
      out.textContent = String(obj);
    }
  };

  const getFirebaseHandles = () => {
    // Support both compat and modular patterns.
    // compat: window.firebase.auth(), window.firebase.firestore()
    // modular: window.auth, window.db
    let auth = null;
    let db = null;

    if (window.auth) auth = window.auth;
    if (window.db) db = window.db;

    if ((!auth || !db) && window.firebase) {
      try { auth = auth || window.firebase.auth(); } catch (_) {}
      try { db = db || window.firebase.firestore(); } catch (_) {}
    }

    return { auth, db };
  };

  const { auth, db } = getFirebaseHandles();
  if (!auth || !db) {
    log("Firebaseハンドルが見つからない。common.js 側の公開変数(auth/db)か firebase compat の読み込みを確認。");
    return;
  }

  const waitForUser = () =>
    new Promise((resolve) => {
      const unsub = auth.onAuthStateChanged((u) => {
        if (u) {
          try { unsub(); } catch (_) {}
          resolve(u);
        }
      });
    });

  const getUserInfoDoc = async (uid) => {
    // Firestoreのデータ構造が途中で変わっても動くように
    // 1) users/{uid} 直下を優先（現在の構造）
    // 2) 旧構造 users/{uid}/info/info もフォールバックで見る
    try {
      const refRoot = db.collection("users").doc(uid);
      const snapRoot = await refRoot.get();
      if (snapRoot.exists) return { ref: refRoot, snap: snapRoot, data: snapRoot.data() };

      const refLegacy = db.collection("users").doc(uid).collection("info").doc("info");
      const snapLegacy = await refLegacy.get();
      if (snapLegacy.exists) return { ref: refLegacy, snap: snapLegacy, data: snapLegacy.data() };

      return { error: "ユーザー情報ドキュメントが見つかりません" };
    } catch (e) {
      return { error: String(e) };
    }
  };

  const isAdminUser = async (uid) => {
    const info = await getUserInfoDoc(uid);
    if (info.error) return { ok: false, reason: info.error };
    const isAdmin = !!(info.data && info.data.isAdmin);
    return { ok: isAdmin, info };
  };

  const getOrAskApplyUrl = () => {
    const key = "himegoto_applyReferral_url";
    const fromWindow =
      window.APPLY_REFERRAL_URL ||
      window.applyReferralUrl ||
      window.APPLYREFERRAL_URL ||
      window.__APPLY_REFERRAL_URL;

    const cached = localStorage.getItem(key);
    const url = fromWindow || cached;

    if (url) return url;

    const entered = prompt(
      "applyReferral のエンドポイントURLを入力（Cloud Run/FunctionsのURL）。\n例: https://asia-northeast1-xxxxx.a.run.app"
    );
    if (entered && entered.startsWith("http")) {
      localStorage.setItem(key, entered.trim());
      return entered.trim();
    }
    return null;
  };

  const postApplyReferral = async ({ url, idToken, refCode }) => {
    // Try common payload shapes; backend can ignore extra fields.
    const payloads = [
      { refCode },
      { refCode, appliedRefCode: refCode },
      { refCode, referredUid: auth.currentUser.uid },
      { refCode, uid: auth.currentUser.uid },
    ];

    let lastErr = null;
    for (const body of payloads) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify(body),
        });

        const ct = res.headers.get("content-type") || "";
        const data = ct.includes("application/json") ? await res.json() : await res.text();

        if (!res.ok) {
          lastErr = { status: res.status, data };
          continue;
        }
        return { ok: true, status: res.status, data, sent: body };
      } catch (e) {
        lastErr = { error: String(e), sent: body };
      }
    }
    return { ok: false, lastErr };
  };

  const user = await waitForUser();
  const adminCheck = await isAdminUser(user.uid);

  if (!adminCheck.ok) {
    // Not admin => keep hidden (quietly).
    return;
  }

  panel.style.display = "block";
  log("管理者デバッグパネルを表示しました。");

  btnCheck.addEventListener("click", async () => {
    btnCheck.disabled = true;
    try {
      const info = await getUserInfoDoc(user.uid);
      if (info.error) return log({ error: info.error });

      const d = info.data || {};
      log({
        path: `users/${user.uid}/info/info`,
        exists: !!info.data,
        appliedRefCode: d.appliedRefCode ?? null,
        refSuccessCount: d.refSuccessCount ?? null,
        refRewardedCount: d.refRewardedCount ?? null,
        plan: d.plan ?? null,
        proUntil: d.proUntil ?? null,
        isAdmin: d.isAdmin ?? null,
        raw: d,
      });
    } finally {
      btnCheck.disabled = false;
    }
  });

  btnApply.addEventListener("click", async () => {
    btnApply.disabled = true;
    try {
      const refCode = prompt("適用する紹介ID（refCode）を入力");
      if (!refCode) return log("中止しました（refCodeなし）");

      const url = getOrAskApplyUrl();
      if (!url) return log("中止しました（URLなし）");

      const idToken = await user.getIdToken(true);

      log({ step: "calling", url, refCode });

      const result = await postApplyReferral({ url, idToken, refCode: refCode.trim() });

      log(result);

      // After apply, re-fetch state to confirm
      const info = await getUserInfoDoc(user.uid);
      if (!info.error) {
        const d = info.data || {};
        log({
          result,
          after: {
            appliedRefCode: d.appliedRefCode ?? null,
            refSuccessCount: d.refSuccessCount ?? null,
            refRewardedCount: d.refRewardedCount ?? null,
            plan: d.plan ?? null,
            proUntil: d.proUntil ?? null,
          },
        });
      }
    } catch (e) {
      log({ error: String(e) });
    } finally {
      btnApply.disabled = false;
    }
  });
})();
