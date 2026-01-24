const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

function nowTs() {
  return admin.firestore.Timestamp.now();
}

function addDaysFrom(baseTs, days) {
  const ms = baseTs.toDate().getTime() + days * 24 * 60 * 60 * 1000;
  return admin.firestore.Timestamp.fromDate(new Date(ms));
}

function extendProUntil(current, days) {
  const base = current && current.toDate ? current : nowTs();
  const n = nowTs();
  const start = (base && base.toDate && base.toDate() > n.toDate()) ? base : n;
  return addDaysFrom(start, days);
}

function normalizeRefCode(code) {
  return (code || "").trim().substring(0, 8);
}

exports.ensureRefCode = functions.region("asia-northeast1").https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Login required.");
  }
  const uid = context.auth.uid;
  const refCode = uid.substring(0, 8);

  const userInfoRef = db.collection("users").doc(uid).collection("profile").doc("info");
  const refCodeRef = db.collection("refCodes").doc(refCode);

  await db.runTransaction(async (tx) => {
    tx.set(userInfoRef, { refCode }, { merge: true });
    tx.set(refCodeRef, { uid, updatedAt: nowTs(), createdAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  });

  return { ok: true, refCode };
});

exports.applyReferral = functions.region("asia-northeast1").https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Login required.");
  }
  const callerUid = context.auth.uid;
  const refCode = normalizeRefCode(data && data.refCode);

  if (!refCode) {
    throw new functions.https.HttpsError("invalid-argument", "refCode required.");
  }

  const refCodeRef = db.collection("refCodes").doc(refCode);
  const callerInfoRef = db.collection("users").doc(callerUid).collection("profile").doc("info");

  return db.runTransaction(async (tx) => {
    const refSnap = await tx.get(refCodeRef);
    if (!refSnap.exists) {
      throw new functions.https.HttpsError("not-found", "invalid refCode");
    }
    const inviterUid = refSnap.get("uid");
    if (!inviterUid) {
      throw new functions.https.HttpsError("not-found", "invalid refCode");
    }
    if (inviterUid === callerUid) {
      throw new functions.https.HttpsError("failed-precondition", "self referral");
    }

    const inviterInfoRef = db.collection("users").doc(inviterUid).collection("profile").doc("info");

    const [callerSnap, inviterSnap] = await Promise.all([tx.get(callerInfoRef), tx.get(inviterInfoRef)]);

    const callerData = callerSnap.exists ? callerSnap.data() : {};
    const inviterData = inviterSnap.exists ? inviterSnap.data() : {};

    // すでに適用済みなら何もしない（冪等）
    if (callerData && (callerData.referralApplied === true)) {
      return { ok: true, alreadyApplied: true };
    }

    // 紹介された側：+1日
    const callerNewProUntil = extendProUntil(callerData && callerData.proUntil, 1);
    tx.set(callerInfoRef, {
      appliedRefCode: refCode,
      referralApplied: true,
      referralAppliedAt: nowTs(),
      plan: "pro",
      proUntil: callerNewProUntil,
      // 初期値補完
      refSuccessCount: typeof callerData.refSuccessCount === "number" ? callerData.refSuccessCount : 0,
      refRewardedCount: typeof callerData.refRewardedCount === "number" ? callerData.refRewardedCount : 0
    }, { merge: true });

    // 紹介した側：成功数+1
    const prevSuccess = (typeof inviterData.refSuccessCount === "number") ? inviterData.refSuccessCount : 0;
    const prevRewarded = (typeof inviterData.refRewardedCount === "number") ? inviterData.refRewardedCount : 0;

    const newSuccess = prevSuccess + 1;
    const shouldTimes = Math.floor(newSuccess / 3);
    const addTimes = Math.max(0, shouldTimes - prevRewarded);
    const addDays = addTimes * 3;

    const updates = {
      refSuccessCount: newSuccess,
      plan: "pro"
    };

    if (addTimes > 0) {
      updates.refRewardedCount = prevRewarded + addTimes;
      updates.proUntil = extendProUntil(inviterData && inviterData.proUntil, addDays);
    } else {
      // 初期値補完のみ
      updates.refRewardedCount = prevRewarded;
      if (inviterData && inviterData.proUntil) {
        updates.proUntil = inviterData.proUntil;
      }
    }

    tx.set(inviterInfoRef, updates, { merge: true });

    return {
      ok: true,
      inviterUid,
      callerUid,
      inviterNewSuccess: newSuccess,
      inviterAddDays: addDays,
      callerAddDays: 1
    };
  });
});
