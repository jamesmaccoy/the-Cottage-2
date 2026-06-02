const { getFirestore } = require("../_lib/firebase");

function getType(req) {
  const body = req.body || {};
  const raw = body.type || req.query?.type || null;
  return typeof raw === "string" ? raw.trim() : raw;
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ status: false, data: "Method not allowed" });
  }

  const type = getType(req);
  if (!type) {
    return res.status(400).json({ status: false, data: "Type required" });
  }

  try {
    const db = getFirestore();
    const candidates = [type, type.trim(), ` ${type.trim()}`].filter(Boolean);
    const seen = new Set();
    let docData = null;

    for (const id of candidates) {
      if (seen.has(id)) continue;
      seen.add(id);
      // eslint-disable-next-line no-await-in-loop
      const snap = await db.collection("packages").doc(id).get();
      if (snap.exists) {
        docData = snap.data();
        break;
      }
    }

    if (!docData) {
      return res
        .status(404)
        .json({ status: false, data: `No package found for type: ${type}` });
    }

    return res.status(200).json({
      status: true,
      data: {
        type,
        price: docData.price ?? null,
        // Include optional display fields if present
        title: docData.title ?? docData.name ?? docData.description ?? null,
      },
    });
  } catch (err) {
    console.error("get_package:", err);
    return res
      .status(500)
      .json({ status: false, data: err.message || "Failed to load package" });
  }
};

