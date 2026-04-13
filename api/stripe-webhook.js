// api/stripe-webhook.js
// Stripeからの支払い完了通知を受け取り、proUntilを加算する

const Stripe = require("stripe");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });
}

const db = admin.firestore();

function addDaysFromMax(ts, days) {
  const now = new Date();
  const base = ts && ts.toDate ? ts.toDate() : new Date(0);
  const start = base > now ? base : now;
  const d = new Date(start.getTime());
  d.setDate(d.getDate() + days);
  return admin.firestore.Timestamp.fromDate(d);
}

export const config = {
  api: {
    bodyParser: false,
  },
};

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  console.log("STRIPE_WEBHOOK_SECRET exists:", !!webhookSecret);
  console.log("sig exists:", !!sig);

  let event;

  try {
    const rawBody = await getRawBody(req);
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error("Webhook signature error:", err.message);
    return res.status(400).json({ error: "Invalid signature" });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const uid = session.metadata && session.metadata.uid;

    if (!uid) {
      console.error("uid not found in metadata");
      return res.status(400).json({ error: "uid missing" });
    }

    try {
      const infoRef = db.collection("users").doc(uid).collection("profile").doc("info");
      const snap = await infoRef.get();
      const data = snap.exists ? snap.data() : {};
      const currentProUntil = data.proUntil || null;
      const newProUntil = addDaysFromMax(currentProUntil, 30);

      await infoRef.set(
        {
          plan: "pro",
          proUntil: newProUntil,
          updatedAt: admin.firestore.Timestamp.now(),
        },
        { merge: true }
      );

      console.log(`proUntil updated for uid: ${uid}`);
    } catch (err) {
      console.error("Firestore update error:", err);
      return res.status(500).json({ error: "Firestore update failed" });
    }
  }

  return res.status(200).json({ received: true });
}
