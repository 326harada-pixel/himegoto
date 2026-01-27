const { onCall } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

setGlobalOptions({ region: "asia-northeast1" });

function nowTs() {
  return admin.firestore.Timestamp.now();
}

function addDaysFrom(baseTs, days) {
  const ms = baseTs.toDate().getTime() + days * 24 * 60 * 60 * 1000;
  return admin.firestore.Timestamp.fromDate(new Date(ms));
}

function extendProUntil(current, days) {
  const n = nowTs();
  const base =
    current && current.toDate && current.toDate() > n.toDate()
      ? current
      : n;
  return addDaysFrom(base, days);
}

function normalizeRefCode(code) {
  return (code || "").trim().substring(0, 8);
}

exports.ensureRefCode = onCall(async (request) => {
  const { auth } = request;
  if (!auth) throw new Error("Login required");

  const uid = auth.uid;
  const refCode = uid.substring(0, 8);

  const userInfoRef = db
    .collection("users")
    .doc(uid)
    .collection("profile")
    .doc("info");

  const refCodeRef = db.collection("refCodes").doc(refCode);

  await db.runTransaction(async (tx) => {
    tx.set(userInfoRef, { refCode }, { merge: true });
    tx.set(
      refCodeRef,
      {
        uid,
        updatedAt: nowTs(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });

  return { ok: true, refCode };
});

exports.applyReferral = onCall(async (request) => {
  const { auth, data } = request;
  if (!auth) throw new Error("Login required");

  const callerUid = auth.uid;
  const refCode = normalizeRefCode(data?.refCode);

  if (!refCode) throw new Error("refCode required");

  const refCodeRef = db.collection("refCodes").doc(refCode);
  const callerInfoRef = db
    .collection("users")
    .doc(callerUid)
    .collection("profile")
    .doc("info");

  return db.runTransaction(async (tx) => {
    const refSnap = await tx.get(refCodeRef);
    if (!refSnap.exists) throw new Error("invalid refCode");

    const inviterUid = refSnap.get("uid");
    if (inviterUid === callerUid) throw new Error("self referral");

    const inviterInfoRef = db
      .collection("users")
      .doc(inviterUid)
      .collection("profile")
      .doc("info");

    const [callerSnap, inviterSnap] = await Promise.all([
      tx.get(callerInfoRef),
      tx.get(inviterInfoRef),
    ]);

    const callerData = callerSnap.exists ? callerSnap.data() : {};
    const inviterData = inviterSnap.exists ? inviterSnap.data() : {};

    if (callerData.referralApplied) return { ok: true, alreadyApplied: true };

    // caller +1 day
    tx.set(
      callerInfoRef,
      {
        referralApplied: true,
        appliedRefCode: refCode,
        plan: "pro",
        proUntil: extendProUntil(callerData.proUntil, 1),
      },
      { merge: true }
    );

    // inviter count
    const success = (inviterData.refSuccessCount || 0) + 1;
    const rewarded = inviterData.refRewardedCount || 0;
    const rewardTimes = Math.floor(success / 3);
    const addTimes = rewardTimes - rewarded;

    const updates = { refSuccessCount: success, plan: "pro" };

    if (addTimes > 0) {
      updates.refRewardedCount = rewarded + addTimes;
      updates.proUntil = extendProUntil(
        inviterData.proUntil,
        addTimes * 3
      );
    }

    tx.set(inviterInfoRef, updates, { merge: true });

    return { ok: true };
  });
});
