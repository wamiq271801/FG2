#!/usr/bin/env node
/**
 * Product viewer server — shows one product at a time with copy actions.
 *
 * Usage:
 *   node server.js
 *
 * Open http://localhost:3000
 */

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const R2_DIR = path.join(__dirname, "..", "r2-downloads");
const STATE_FILE = path.join(__dirname, "..", ".viewer-state.json");

// ── State ───────────────────────────────────────────────────────────────────

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    return { done: [], skipped: [] };
  }
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + "\n");
}

function getAllProductIds() {
  return fs.readdirSync(R2_DIR).filter((f) => {
    const fp = path.join(R2_DIR, f, `${f}.json`);
    return fs.existsSync(fp);
  });
}

function getNextProduct(state) {
  const all = getAllProductIds();
  const processed = new Set([...state.done, ...state.skipped]);
  for (const id of all) {
    if (!processed.has(id)) return id;
  }
  return null;
}

function loadProduct(id) {
  const jsonPath = path.join(R2_DIR, id, `${id}.json`);
  return JSON.parse(fs.readFileSync(jsonPath, "utf8"));
}

function getPrimaryImage(product) {
  const images = product.images || [];
  const primary = images.find((img) => img.is_primary) || images[0];
  if (!primary) return null;
  const filename = path.basename(primary.url);
  const localPath = path.join(R2_DIR, product.id, "images", filename);
  if (fs.existsSync(localPath)) {
    return { localPath, alt: primary.alt || "" };
  }
  return null;
}

function getImagePath(id, filename) {
  const fp = path.join(R2_DIR, id, "images", filename);
  if (!fs.existsSync(fp)) return null;
  return fp;
}

// ── Server ──────────────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  // API: get next product
  if (pathname === "/api/next" && req.method === "GET") {
    const state = loadState();
    const id = getNextProduct(state);
    if (!id) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ product: null, done: true, stats: { done: state.done.length, skipped: state.skipped.length, total: getAllProductIds().length } }));
      return;
    }
    const product = loadProduct(id);
    const img = getPrimaryImage(product);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ product, image: img, stats: { done: state.done.length, skipped: state.skipped.length, total: getAllProductIds().length } }));
    return;
  }

  // API: mark done
  if (pathname === "/api/done" && req.method === "POST") {
    const body = [];
    req.on("data", (c) => body.push(c));
    req.on("end", () => {
      const { id } = JSON.parse(Buffer.concat(body).toString());
      const state = loadState();
      if (!state.done.includes(id)) state.done.push(id);
      state.skipped = state.skipped.filter((s) => s !== id);
      saveState(state);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    });
    return;
  }

  // API: mark skipped
  if (pathname === "/api/skip" && req.method === "POST") {
    const body = [];
    req.on("data", (c) => body.push(c));
    req.on("end", () => {
      const { id } = JSON.parse(Buffer.concat(body).toString());
      const state = loadState();
      if (!state.skipped.includes(id)) state.skipped.push(id);
      state.done = state.done.filter((d) => d !== id);
      saveState(state);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    });
    return;
  }

  // API: serve local image
  if (pathname.startsWith("/api/image/")) {
    const parts = pathname.split("/").filter(Boolean);
    const id = parts[2];
    const filename = parts[3];
    const fp = getImagePath(id, filename);
    if (!fp) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const ext = path.extname(filename).toLowerCase();
    const types = { ".avif": "image/avif", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif" };
    res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream" });
    fs.createReadStream(fp).pipe(res);
    return;
  }

  // API: save updated product
  if (pathname === "/api/save" && req.method === "POST") {
    const body = [];
    req.on("data", (c) => body.push(c));
    req.on("end", () => {
      const { id, data } = JSON.parse(Buffer.concat(body).toString());
      if (!id || !data) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "id and data required" }));
        return;
      }
      const jsonPath = path.join(R2_DIR, id, `${id}.json`);
      if (!fs.existsSync(jsonPath)) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "product not found" }));
        return;
      }
      // Back up original
      const backupPath = path.join(R2_DIR, id, `${id}.original.json`);
      if (!fs.existsSync(backupPath)) {
        fs.copyFileSync(jsonPath, backupPath);
      }
      // Save new version
      fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2) + "\n");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    });
    return;
  }

  // API: reset state
  if (pathname === "/api/reset" && req.method === "POST") {
    saveState({ done: [], skipped: [] });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // Serve HTML page
  if (pathname === "/" || pathname === "/index.html") {
    const htmlPath = path.join(__dirname, "viewer.html");
    res.writeHead(200, { "Content-Type": "text/html" });
    fs.createReadStream(htmlPath).pipe(res);
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`Product viewer running at http://localhost:${PORT}`);
});
