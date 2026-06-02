const { getPackage, getProjectId, listPackageDocIds } = require("../_lib/firebase");
const { parsePriceToCents, createCheckout } = require("../_lib/yoco");

const PACKAGE_LABELS = {
  shack_stack: "Three nights - The Shack",
  book_an_entire_week: "A week at The Shack",
  long_weekend_at_the_Cottage: "Three nights - The Cottage",
  entire_week_at_the_cottage: "Seven nights - The Cottage",
  book_an_4hr_shoot: "4 hour shoot",
  camping_long_weekend: "Camping long weekend",
  outSeason: "Month by month",
  reception: "Host a reception",
  "24h_window": "24 hour window",
  ReserveOpportunity: "Reserve an opportunity",
};

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

  // Allow GET for quick testing in a browser:
  // /api/v1/generate_checkout_link?type=shack_stack
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ status: false, data: "Method not allowed" });
  }

  // Diagnostic mode (no type required): ?diag=1&token=...
  if (req.query?.diag === "1") {
    try {
      const token = req.query?.token;
      if (!process.env.DIAG_TOKEN || token !== process.env.DIAG_TOKEN) {
        return res.status(403).json({ status: false, data: "Forbidden" });
      }
      const ids = await listPackageDocIds(25);
      // Also explicitly check the IDs your site expects.
      // eslint-disable-next-line global-require
      const { getPackage } = require("../_lib/firebase");
      const existsShackStack = (await getPackage("shack_stack")) != null;
      const existsSpaceShackStack = (await getPackage(" shack_stack")) != null;
      return res.status(200).json({
        status: true,
        projectId: getProjectId(),
        packageDocIds: ids,
        exists: {
          shack_stack: existsShackStack,
          " shack_stack": existsSpaceShackStack,
        },
      });
    } catch (err) {
      console.error("generate_checkout_link diag:", err);
      return res.status(500).json({ status: false, data: err.message });
    }
  }

  const type = getType(req);
  if (!type || typeof type !== "string") {
    return res.status(400).json({
      status: false,
      data: "Error Occured : Type required",
    });
  }

  try {
    const pkg = await getPackage(type);
    if (!pkg) {
      return res.status(404).json({
        status: false,
        data: `No package found for type: ${type}`,
        projectId: getProjectId(),
      });
    }

    const amountInCents = parsePriceToCents(pkg);
    const description =
      pkg.description || pkg.name || pkg.title || PACKAGE_LABELS[type] || type;

    const redirectUrl = await createCheckout({
      amountInCents,
      description,
      metadata: { packageType: type },
    });

    return res.status(200).json({ status: true, data: { redirectUrl } });
  } catch (err) {
    console.error("generate_checkout_link:", err);
    return res
      .status(500)
      .json({ status: false, data: err.message || "Checkout could not be created" });
  }
};

