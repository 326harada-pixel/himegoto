const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");

setGlobalOptions({ region: "asia-northeast1" });

admin.initializeApp();
const db = admin.firestore();

function nowTs() {
  return admin.firestore.Timestamp.now();
}

function addDaysTo(ts, days) {
  const base = ts && ts.toDate ? ts.toDate() : new Date(0);
  const d = new Date(base.getTime());
  d.setDate(d.getDate() + days);
  return admin.firestore.Timestamp.fromDate(d);
}

function addDaysFromMax(ts, days) {
  const now = new Date();
  const base = ts && ts.toDate ? ts.toDate() : new Date(0);
  const start = base > now ? base : now;
  const d = new Date(start.getTime());
  d.setDate(d.getDate() + days);
  return admin.firestore.Timestamp.fromDate(d);
}

function makeRefCode(len = 8) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

// users/{uid}/profile/info が正のデータソース（ここに集約）
function userInfoRef(uid) {
  return db.collection("users").doc(uid).collection("profile").doc("info");
}

exports.ensureRefCode = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login required.");
  const uid = request.auth.uid;

  const infoRef = userInfoRef(uid);

  // already has
  const infoSnap = await infoRef.get();
  const existing = infoSnap.exists ? infoSnap.data() : {};
  if (existing && existing.refCode) {
    return { refCode: existing.refCode };
  }

  // transaction: create unique refCode
  const result = await db.runTransaction(async (tx) => {
    // Re-check inside tx
    const insideInfo = await tx.get(infoRef);
    const insideData = insideInfo.exists ? insideInfo.data() : {};
    if (insideData && insideData.refCode) {
      return { refCode: insideData.refCode };
    }

    let refCode = "";
    for (let i = 0; i < 20; i++) {
      const candidate = makeRefCode(8);
      const refDoc = db.collection("refCodes").doc(candidate);
      const refSnap = await tx.get(refDoc);
      if (!refSnap.exists) {
        refCode = candidate;
        tx.set(refDoc, { uid, createdAt: nowTs(), updatedAt: nowTs() }, { merge: true });
        break;
      }
    }
    if (!refCode) throw new HttpsError("internal", "Failed to allocate refCode.");

    // init counters on info doc
    tx.set(
      infoRef,
      {
        refCode,
        refSuccessCount: 0,
        refRewardedCount: 0,
        updatedAt: nowTs(),
        createdAt: existing && existing.createdAt ? existing.createdAt : nowTs(),
      },
      { merge: true }
    );
    // keep root doc lightweight but store refCode for legacy reads
    tx.set(db.collection("users").doc(uid), { refCode }, { merge: true });

    return { refCode };
  });

  return result;
});

exports.applyReferral = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login required.");

  const uid = request.auth.uid;
  const refCodeRaw = request.data && request.data.refCode ? String(request.data.refCode) : "";
  const refCode = refCodeRaw.trim();

  if (!refCode) throw new HttpsError("invalid-argument", "refCode is required.");
  if (refCode.length < 4 || refCode.length > 16) throw new HttpsError("invalid-argument", "Invalid refCode.");

  const inviteeInfoRef = userInfoRef(uid);

  const out = await db.runTransaction(async (tx) => {
    const refDocRef = db.collection("refCodes").doc(refCode);
    const refDoc = await tx.get(refDocRef);
    if (!refDoc.exists) throw new HttpsError("not-found", "refCode not found.");

    const ownerUid = refDoc.data().uid;
    if (!ownerUid) throw new HttpsError("internal", "Invalid refCode mapping.");
    if (ownerUid === uid) throw new HttpsError("failed-precondition", "Self referral is not allowed.");

    const inviterInfoRef = userInfoRef(ownerUid);

    const [inviteeInfoSnap, inviterInfoSnap] = await Promise.all([
      tx.get(inviteeInfoRef),
      tx.get(inviterInfoRef),
    ]);

    const invitee = inviteeInfoSnap.exists ? (inviteeInfoSnap.data() || {}) : {};
    const inviter = inviterInfoSnap.exists ? (inviterInfoSnap.data() || {}) : {};

    // idempotent: already applied
    if (invitee.appliedRefCode) {
      return {
        ok: true,
        alreadyApplied: true,
        ownerUid,
        refCode: invitee.appliedRefCode,
        refSuccessCount: inviter.refSuccessCount || 0,
        refRewardedCount: inviter.refRewardedCount || 0,
      };
    }

    // 1) invitee gets +1 day pro
    const inviteeProUntil = invitee.proUntil || null;
    const newInviteeProUntil = addDaysFromMax(inviteeProUntil, 1);

    tx.set(
      inviteeInfoRef,
      {
        appliedRefCode: refCode,
        plan: "pro",
        proUntil: newInviteeProUntil,
        updatedAt: nowTs(),
      },
      { merge: true }
    );

    // 2) inviter counters + reward each 3 successes
    const prevSuccess = Number(inviter.refSuccessCount || 0);
    const prevRewarded = Number(inviter.refRewardedCount || 0);
    const nextSuccess = prevSuccess + 1;

    let nextRewarded = prevRewarded;
    let extraDaysForInviter = 0;
    if (nextSuccess % 3 === 0) {
      nextRewarded += 1;
      extraDaysForInviter = 3;
    }

    const inviterProUntil = inviter.proUntil || null;
    const newInviterProUntil = extraDaysForInviter ? addDaysFromMax(inviterProUntil, extraDaysForInviter) : inviterProUntil;

    tx.set(
      inviterInfoRef,
      {
        refSuccessCount: nextSuccess,
        refRewardedCount: nextRewarded,
        ...(extraDaysForInviter ? { plan: "pro", proUntil: newInviterProUntil } : {}),
        updatedAt: nowTs(),
      },
      { merge: true }
    );

    // legacy mirror (optional)
    tx.set(db.collection("users").doc(ownerUid), { refSuccessCount: nextSuccess, refRewardedCount: nextRewarded }, { merge: true });
    tx.set(db.collection("users").doc(uid), { appliedRefCode: refCode, plan: "pro", proUntil: newInviteeProUntil }, { merge: true });

    return {
      ok: true,
      alreadyApplied: false,
      ownerUid,
      refSuccessCount: nextSuccess,
      refRewardedCount: nextRewarded,
      inviterBonusDaysAdded: extraDaysForInviter,
      inviteeBonusDaysAdded: 1,
    };
  });

  return out;
});
