#!/usr/bin/env node
/**
 * Import products from r2-downloads/ into Supabase.
 *
 * 1. Reads each <id>/<id>.json (latest) + <id>/<id>.original.json (images, brand, category)
 * 2. Creates brands and categories as needed
 * 3. Inserts products + product_images
 *
 * Usage:
 *   node scripts/import-products.js
 *
 * Run scripts/wipe-and-adjust.sql FIRST.
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
const R2_DIR = path.join(__dirname, "..", "r2-downloads");

function checkEnv() {
  const missing = [];
  if (!SUPABASE_URL) missing.push("SUPABASE_URL");
  if (!SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (missing.length) {
    console.error(`Missing: ${missing.join(", ")}`);
    process.exit(1);
  }
}

// ── Supabase REST helpers ───────────────────────────────────────────────────

function supabaseRequest(method, restPath, body, prefer) {
  return new Promise((resolve, reject) => {
    const url = new URL(restPath, SUPABASE_URL);
    const payload = body ? JSON.stringify(body) : "";
    const headers = {
      apikey: SERVICE_ROLE_KEY,
      authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: prefer || (body ? "return=minimal" : ""),
    };
    if (body) headers["Content-Length"] = Buffer.byteLength(payload);

    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method,
      headers,
    };

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        let data;
        try { data = JSON.parse(text); } catch { data = text; }
        resolve({ status: res.statusCode, data });
      });
    });
    req.on("error", reject);
    if (body) req.write(payload);
    req.end();
  });
}

async function supabaseGet(restPath) {
  return supabaseRequest("GET", restPath);
}

async function supabaseInsert(restPath, body, returnRepresentation = false) {
  const prefer = returnRepresentation ? "return=representation" : "return=minimal";
  return supabaseRequest("POST", restPath, body, prefer);
}

// ── Data helpers ────────────────────────────────────────────────────────────

const categoryMap = {};  // slug → uuid
const brandMap = {};     // name → uuid

async function getOrCreateCategory(slug, name) {
  if (categoryMap[slug]) return categoryMap[slug];

  // Try to find existing
  const { status, data } = await supabaseGet(
    `/rest/v1/categories?select=id&slug=eq.${encodeURIComponent(slug)}&limit=1`
  );
  if (status === 200 && Array.isArray(data) && data.length > 0) {
    categoryMap[slug] = data[0].id;
    return data[0].id;
  }

  // Create new
  const { status: createStatus, data: created } = await supabaseInsert("/rest/v1/categories", {
    slug,
    name: name || slug,
    tagline: "",
    description: "",
    intro: "",
    image: "",
    accent: "#c9a96e",
    subcategories: [],
    seo_note: "",
  });

  if (createStatus >= 200 && createStatus < 300) {
    // Get the ID back
    const { data: fetched } = await supabaseGet(
      `/rest/v1/categories?select=id&slug=eq.${encodeURIComponent(slug)}&limit=1`
    );
    if (fetched && fetched[0]) {
      categoryMap[slug] = fetched[0].id;
      return fetched[0].id;
    }
  }

  console.error(`  Failed to create category: ${slug}`);
  return null;
}

async function getOrCreateBrand(name) {
  if (!name || name === "Generic" || name === "generic") return null;
  const trimmed = name.trim();
  if (brandMap[trimmed]) return brandMap[trimmed];

  // Try to find existing
  const { status, data } = await supabaseGet(
    `/rest/v1/brands?select=id&name=eq.${encodeURIComponent(trimmed)}&limit=1`
  );
  if (status === 200 && Array.isArray(data) && data.length > 0) {
    brandMap[trimmed] = data[0].id;
    return data[0].id;
  }

  // Create new
  const slug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const { status: createStatus } = await supabaseInsert("/rest/v1/brands", {
    slug,
    name: trimmed,
    country: "",
    blurb: "",
  });

  if (createStatus >= 200 && createStatus < 300) {
    const { data: fetched } = await supabaseGet(
      `/rest/v1/brands?select=id&name=eq.${encodeURIComponent(trimmed)}&limit=1`
    );
    if (fetched && fetched[0]) {
      brandMap[trimmed] = fetched[0].id;
      return fetched[0].id;
    }
  }

  console.error(`  Failed to create brand: ${trimmed}`);
  return null;
}

// Category slug → human name mapping
const CATEGORY_NAMES = {
  "home-kitchen": "Home & Kitchen",
  "car-accessories": "Car Accessories",
  "charging-cables": "Charging Cables",
  "in-ear-headphones": "In-Ear Headphones",
  "bluetooth-speakers": "Bluetooth Speakers",
  "smartwatch": "Smartwatches",
  "mobile-charger": "Mobile Chargers",
  "mobile-accessories": "Mobile Accessories",
  "flashlights": "Flashlights",
  "water-bottles": "Water Bottles",
  "portable-fans": "Portable Fans",
  "night-lamps": "Night Lamps",
  "electric-fan-heaters": "Electric Fans & Heaters",
  "toys-games": "Toys & Games",
  "hair-dryers": "Hair Dryers",
  "beard-mustache-trimmers": "Beard & Mustache Trimmers",
  "gas-lighter": "Gas Lighters",
  "juicer-mixer-grinders": "Juicer Mixer Grinders",
};

// ── Visual key mapping ──────────────────────────────────────────────────────

function inferVisualKey(categorySlug, name) {
  const c = (categorySlug || "").toLowerCase();
  const n = (name || "").toLowerCase();

  if (c.includes("headphone") || c.includes("earphone") || n.includes("earbuds") || n.includes("earphone")) return "earbuds";
  if (c.includes("speaker") || n.includes("speaker")) return "speaker";
  if (c.includes("watch") || n.includes("watch")) return "watch";
  if (c.includes("charger") || n.includes("charger")) return "charger";
  if (c.includes("cable")) return "cable";
  if (c.includes("keyboard")) return "keyboard";
  if (c.includes("mouse")) return "mouse";
  if (c.includes("camera") || c.includes("lens")) return "camera";
  if (c.includes("drone")) return "drone";
  if (c.includes("lamp") || c.includes("light")) return "lamp";
  if (c.includes("fan")) return "stand";
  if (c.includes("flashlight")) return "lamp";

  return "charger"; // safe default
}

function normalizeSpecs(specs) {
  if (!specs) return [];
  if (Array.isArray(specs)) return specs;
  if (typeof specs === "object") {
    return Object.entries(specs).map(([key, value]) => ({
      key,
      value: typeof value === "object" ? JSON.stringify(value) : String(value),
    }));
  }
  return [];
}

function generateSku(id, slug) {
  // Prefer slug prefix (letters only) if available, else use id
  const base = (slug || id).replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 8);
  return base || id.replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 10);
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  checkEnv();

  // Get all product folders
  const folders = fs.readdirSync(R2_DIR).filter((f) => {
    return fs.existsSync(path.join(R2_DIR, f, `${f}.json`));
  });

  console.log(`Found ${folders.length} products to import\n`);

  // Create "Generic" brand if needed
  await getOrCreateBrand("Generic");

  const usedSkus = new Set();
  let created = 0;
  let failed = 0;

  for (const id of folders) {
    const dir = path.join(R2_DIR, id);

    try {
      // Read latest JSON
      const latest = JSON.parse(fs.readFileSync(path.join(dir, `${id}.json`), "utf8"));

      // Read original JSON for images, brand, category_slug
      let original = null;
      const origPath = path.join(dir, `${id}.original.json`);
      if (fs.existsSync(origPath)) {
        original = JSON.parse(fs.readFileSync(origPath, "utf8"));
      }

      const brandName = original?.brand || null;
      const categorySlug = original?.category_slug || latest.category_id || "uncategorized";
      const categoryName = CATEGORY_NAMES[categorySlug] || categorySlug;

      // Get or create brand + category
      const brandId = await getOrCreateBrand(brandName);
      const categoryId = await getOrCreateCategory(categorySlug, categoryName);

      if (!categoryId) {
        console.log(`  ${id} — SKIP (no category)`);
        failed++;
        continue;
      }

      // Build product row
      let sku = generateSku(id, latest.slug);
      while (usedSkus.has(sku)) {
        sku = sku.slice(0, 9) + (usedSkus.size % 10);
      }
      usedSkus.add(sku);

      const product = {
        sku,
        slug: latest.slug || id.toLowerCase(),
        name: latest.name || latest.h1 || latest.slug || id,
        subtitle: latest.subtitle || latest.short_description || "",
        brand_id: brandId,
        category_id: categoryId,
        subcategory: latest.subcategory || null,
        tagline: latest.tagline || "",
        description: latest.description || "",
        story: latest.story || "",
        price: Math.round(Number(latest.price) || 0),
        compare_at_price: latest.compare_at_price && Math.round(Number(latest.compare_at_price)) > Math.round(Number(latest.price || 0)) ? Math.round(Number(latest.compare_at_price)) : null,
        currency: latest.currency || "INR",
        visual_key: latest.visual_key || inferVisualKey(categorySlug, latest.name),
        accent: latest.accent || "#c9a96e",
        stock: latest.stock || 0,
        is_active: latest.is_active !== false,
        is_preorder: latest.is_preorder || false,
        highlights: latest.highlights || [],
        includes: latest.includes || [],
        specs: normalizeSpecs(latest.specs),
        rating: latest.rating || 0,
        review_count: latest.review_count || 0,
        shipping: latest.shipping || "",
        warranty: latest.warranty || "",
        added_at: latest.added_at || new Date().toISOString().slice(0, 10),
      };

      // Insert product and get generated UUID back
      const { status: prodStatus, data: prodData } = await supabaseInsert("/rest/v1/products", product, true);
      if (prodStatus >= 300) {
        console.log(`  ${id} — PRODUCT FAIL (${prodStatus}): ${JSON.stringify(prodData).slice(0, 200)}`);
        failed++;
        continue;
      }

      const newProductId = Array.isArray(prodData) ? prodData[0]?.id : null;
      if (!newProductId) {
        console.log(`  ${id} — NO ID RETURNED`);
        failed++;
        continue;
      }

      // Insert images from original
      const images = original?.images || [];
      if (images.length > 0) {
        const imageRows = images.map((img, idx) => ({
          product_id: newProductId,
          url: img.url || "",
          position: idx,
          is_primary: img.is_primary || idx === 0,
        }));

        const { status: imgStatus } = await supabaseInsert("/rest/v1/product_images", imageRows);
        if (imgStatus >= 300) {
          console.log(`  ${id} — images warn (${imgStatus})`);
        }
      }

      console.log(`  ${id} ✓ (${latest.name})`);
      created++;
    } catch (err) {
      console.log(`  ${id} — ERROR: ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone. Created: ${created}, Failed: ${failed}`);
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
