// register_applyreferral_client.js
// ブラウザ（register.html）から Cloud Run の applyreferral を呼ぶための小さなクライアント
// 前提：Firebase Auth を使っているなら currentUser の IDトークンを自動で付けます。

import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

/**
 * Cloud Run の applyreferral に POST します
 * @param {Object} params
 * @param {string} params.cloudRunUrl - applyreferral のURL（例: https://applyreferral-xxxxx-an.a.run.app）
 * @param {string} params.refCode - 紹介コード（例: "wusTsczB"）
 * @param {string} params.newUid - 紹介登録された側（新規ユーザー）の uid
 * @param {AbortSignal=} params.signal - optional
 * @returns {Promise<{ok: boolean, status: number, data: any}>}
 */
export async function callApplyReferral({ cloudRunUrl, refCode, newUid, signal }) {
  if (!cloudRunUrl || typeof cloudRunUrl !== "string") {
    throw new Error("cloudRunUrl is required");
  }
  if (!refCode || typeof refCode !== "string") {
    throw new Error("refCode is required");
  }
  if (!newUid || typeof newUid !== "string") {
    throw new Error("newUid is required");
  }

  const auth = getAuth();
  let idToken = null;

  try {
    const user = auth.currentUser;
    if (user) {
      idToken = await user.getIdToken(true);
    }
  } catch (e) {
    console.warn("[callApplyReferral] getIdToken failed:", e);
  }

  const headers = {
    "Content-Type": "application/json",
  };
  if (idToken) {
    headers["Authorization"] = `Bearer ${idToken}`;
  }

  const body = {
    refCode,
    newUid,
    clientTimeMs: Date.now(),
  };

  const res = await fetch(cloudRunUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    mode: "cors",
    cache: "no-store",
    signal,
  });

  let data = null;
  const ct = res.headers.get("content-type") || "";
  try {
    if (ct.includes("application/json")) {
      data = await res.json();
    } else {
      data = await res.text();
    }
  } catch (e) {
    data = null;
  }

  return { ok: res.ok, status: res.status, data };
}

/**
 * 失敗時に画面へ出す用のメッセージ整形
 */
export function formatApplyReferralError(resultOrError) {
  if (!resultOrError) return "applyreferral: unknown error";
  if (resultOrError instanceof Error) return `applyreferral: ${resultOrError.message}`;
  const { ok, status, data } = resultOrError;
  if (ok) return "applyreferral: ok";
  const payload = typeof data === "string" ? data : JSON.stringify(data);
  return `applyreferral: failed (status=${status}) ${payload}`;
}
