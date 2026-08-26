#!/usr/bin/env node
/**
 * Export all products from Supabase to individual JSON files.
 *
 * Usage:
 *   node scripts/export-products.js
 *
 * Reads credentials from scripts/.env.
 * Output: ./products/<product-id>.json
 */

const fs = require("fs");
const path = require("path");
const https = require("https");

// ── Load .env ───────────────────────────────────────────────────────────────

const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}

// ── Config ──────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const OUTPUT_DIR = path.join(__dirname, "..", "products");

function checkEnv() {
  const missing = [];
  if (!SUPABASE_URL) missing.push("SUPABASE_URL");
  if (!SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (missing.length) {
    console.error(`Missing: ${missing.join(", ")}`);
    console.error("Set them in scripts/.env");
    process.exit(1);
  }
}

// ── Supabase REST helper ────────────────────────────────────────────────────

function supabaseGet(requestPath) {
  return new Promise((resolve, reject) => {
    const url = new URL(requestPath, SUPABASE_URL);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: "GET",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
    };
    const req = https.request(options, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const body = Buffer.concat(chunks).toString("utf8");
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  checkEnv();

  console.log(`Output: ${OUTPUT_DIR}\n`);

  const COLUMNS = [
    "id", "slug", "h1", "short_description", "description", "brand", "sku",
    "category_id", "category_slug", "price", "mrp", "discount", "currency",
    "stock", "status", "is_featured", "images", "features", "specifications",
    "tags", "meta_title", "meta_description", "canonical_url",
    "created_at", "updated_at", "faq",
  ].join(",");

  // Fetch all products (paginate)
  let allProducts = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const reqPath = `/rest/v1/products?select=${COLUMNS}&order=created_at.asc&limit=${limit}&offset=${offset}`;
    const { status, data } = await supabaseGet(reqPath);

    if (status !== 200) {
      console.error(`Failed (HTTP ${status}):`, data);
      process.exit(1);
    }

    if (!Array.isArray(data) || data.length === 0) break;

    allProducts = allProducts.concat(data);
    process.stdout.write(`\r  Fetched ${allProducts.length} products...`);

    if (data.length < limit) break;
    offset += limit;
  }

  console.log(`\n\nTotal products: ${allProducts.length}`);

  // Create output directory
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Write each product to <id>.json
  let written = 0;
  for (const product of allProducts) {
    const id = product.id;
    if (!id) continue;
    const filePath = path.join(OUTPUT_DIR, `${id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(product, null, 2) + "\n");
    written++;
  }

  console.log(`Wrote ${written} files to ${OUTPUT_DIR}`);
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
