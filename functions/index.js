const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");

admin.initializeApp();

// すべての関数のデフォルトリージョン
setGlobalOptions({ region: "asia-northeast1" });

/**
 * 紹介コード適用（紹介された側に1日、紹介した側は3人ごとに3日）
 * Firestore:
 * - users/{uid}/profile/info  … 各ユーザーの紹介関連カウント・proUntil 等
 * - refCodes/{refCode}        … 紹介コード => owner uid 等
 */
exports.applyReferral = onCall(async (request) => {
  const db = admin.firestore();

  const invitedUid = request.auth?.uid;
  const refCode = (request.data?.refCode || "").trim();

  if (!invitedUid || !refCode) {
    throw new HttpsError("invalid-argument", "uid or refCode missing");
  }

  const refCodeRef = db.collection("refCodes").doc(refCode);

  await db.runTransaction(async (tx) => {
    const refCodeSnap = await tx.get(refCodeRef);
    if (!refCodeSnap.exists) {
      throw new HttpsError("not-found", "refCode not found");
    }

    const ownerUid = refCodeSnap.data()?.uid;
    if (!ownerUid) {
      throw new HttpsError("failed-precondition", "refCode has no owner uid");
    }

    if (ownerUid === invitedUid) {
      throw new HttpsError("failed-precondition", "cannot apply own refCode");
    }

    // 正しい保存場所: users/{uid}/profile/info
    const ownerInfoRef = db.collection("users").doc(ownerUid).collection("profile").doc("info");
    const invitedInfoRef = db.collection("users").doc(invitedUid).collection("profile").doc("info");

    const ownerInfoSnap = await tx.get(ownerInfoRef);
    const invitedInfoSnap = await tx.get(invitedInfoRef);

    const owner = ownerInfoSnap.data() || {};
    const invited = invitedInfoSnap.data() || {};

    // すでに紹介コード適用済みなら何もしない（重複付与防止）
    if (invited.appliedRefCode) return;

    const dayMs = 86400000;

    // --- invited（紹介された側）: 1日延長 ---
    const invitedBase = invited.proUntil?.toDate?.() || new Date();
    const invitedNew = new Date(invitedBase.getTime() + dayMs);

    tx.set(invitedInfoRef, {
      appliedRefCode: refCode,
      proUntil: admin.firestore.Timestamp.fromDate(invitedNew),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    // --- owner（紹介した側）: 成功数+1、3人ごとに3日延長 ---
    const success = (owner.refSuccessCount || 0) + 1;
    let rewarded = owner.refRewardedCount || 0;

    const ownerUpdate = {
      refSuccessCount: success,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (success % 3 === 0) {
      rewarded += 1;
      const ownerBase = owner.proUntil?.toDate?.() || new Date();
      const ownerNew = new Date(ownerBase.getTime() + 3 * dayMs);

      ownerUpdate.refRewardedCount = rewarded;
      ownerUpdate.proUntil = admin.firestore.Timestamp.fromDate(ownerNew);
    }

    tx.set(ownerInfoRef, ownerUpdate, { merge: true });

    // refCodes側にも集計を書いておく（UI表示/管理用）
    tx.set(refCodeRef, {
      successCount: success,
      rewardedCount: rewarded,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  });

  return { ok: true };
});
