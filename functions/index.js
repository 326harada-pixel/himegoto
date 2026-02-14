
const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

exports.applyReferral = functions.region("asia-northeast1").https.onCall(async (data, context) => {
  const db = admin.firestore();

  const invitedUid = context.auth.uid;
  const refCode = data.refCode;

  if (!invitedUid || !refCode) {
    throw new functions.https.HttpsError("invalid-argument", "uid or refCode missing");
  }

  const refCodeRef = db.collection("refCodes").doc(refCode);

  await db.runTransaction(async (tx) => {

    const refCodeSnap = await tx.get(refCodeRef);
    if (!refCodeSnap.exists) {
      throw new functions.https.HttpsError("not-found", "refCode not found");
    }

    const ownerUid = refCodeSnap.data().uid;

    const ownerRef = db.collection("users").doc(ownerUid);
    const invitedRef = db.collection("users").doc(invitedUid);

    const ownerSnap = await tx.get(ownerRef);
    const invitedSnap = await tx.get(invitedRef);

    const owner = ownerSnap.data() || {};
    const invited = invitedSnap.data() || {};

    if (invited.refApplied) return;

    let success = (owner.refSuccessCount || 0) + 1;
    let rewarded = owner.refRewardedCount || 0;

    tx.update(invitedRef, {
      refApplied: true,
      proUntil: admin.firestore.Timestamp.fromDate(
        new Date((invited.proUntil?.toDate?.() || new Date()).getTime() + 86400000)
      )
    });

    let ownerUpdate = {
      refSuccessCount: success
    };

    if (success % 3 === 0) {
      rewarded += 1;
      ownerUpdate.refRewardedCount = rewarded;
      ownerUpdate.proUntil = admin.firestore.Timestamp.fromDate(
        new Date((owner.proUntil?.toDate?.() || new Date()).getTime() + 3*86400000)
      );
    }

    tx.update(ownerRef, ownerUpdate);

    tx.set(refCodeRef, {
      successCount: success,
      rewardedCount: rewarded,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, {merge:true});
  });

  return { ok: true };
});
