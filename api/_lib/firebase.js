const admin = require("firebase-admin");

let app;
let cachedProjectId;

function getFirestore() {
  if (!app) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!raw) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not set.");
    }

    let credentials;
    const trimmed = raw.trim();
    try {
      credentials = JSON.parse(trimmed);
    } catch {
      if (trimmed.startsWith("[")) {
        throw new Error(
          "FIREBASE_SERVICE_ACCOUNT_JSON must be a JSON object starting with {, not an array [."
        );
      }
      throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON must be valid JSON.");
    }

    app = admin.initializeApp({
      credential: admin.credential.cert(credentials),
      projectId: credentials.project_id,
    });
    cachedProjectId = credentials.project_id;
  }
  return admin.firestore();
}

function getProjectId() {
  // Ensure initialization happens so we can read cachedProjectId
  getFirestore();
  return cachedProjectId || null;
}

async function getPackage(type) {
  const db = getFirestore();

  const candidates = [];
  if (typeof type === "string") {
    const trimmed = type.trim();
    // Site buttons use shack_stack; Firestore doc may be " shack_stack" (leading space).
    candidates.push(type, trimmed, ` ${trimmed}`);
  } else if (type != null) {
    candidates.push(type);
  }

  const seen = new Set();
  for (const id of candidates) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const doc = await db.collection("packages").doc(id).get();
    if (doc.exists) return doc.data();
  }

  return null;
}

async function listPackageDocIds(limit = 10) {
  const db = getFirestore();
  const snap = await db.collection("packages").limit(limit).get();
  return snap.docs.map((d) => d.id);
}

module.exports = { getFirestore, getPackage, getProjectId, listPackageDocIds };

