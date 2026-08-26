#!/usr/bin/env node
/**
 * Standalone Cloudflare R2 downloader.
 *
 * Downloads all files from the "products" bucket to a local directory.
 *
 * Usage:
 *   node scripts/download-r2.js
 *
 * Reads credentials from scripts/.env (copy from scripts/.env.example).
 * Output: ./r2-downloads/ (preserves bucket folder structure)
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
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

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || "";
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || "";
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || "";
const BUCKET = process.env.R2_BUCKET || "products";
const OUTPUT_DIR = process.env.R2_OUTPUT || path.join(__dirname, "..", "r2-downloads");

function checkEnv() {
  const missing = [];
  if (!ACCOUNT_ID) missing.push("CLOUDFLARE_ACCOUNT_ID");
  if (!ACCESS_KEY_ID) missing.push("R2_ACCESS_KEY_ID");
  if (!SECRET_ACCESS_KEY) missing.push("R2_SECRET_ACCESS_KEY");
  if (missing.length) {
    console.error(`Missing: ${missing.join(", ")}`);
    console.error("Set them in scripts/.env (see scripts/.env.example)");
    process.exit(1);
  }
}

// ── AWS Sig v4 ──────────────────────────────────────────────────────────────

const SERVICE = "s3";
const REGION = "auto";

function hmac(key, data, encoding) {
  return crypto.createHmac("sha256", key).update(data, "utf8").digest(encoding);
}

function sha256Hex(data) {
  return crypto.createHash("sha256").update(data, "utf8").digest("hex");
}

function canonicalQueryString(searchParams) {
  const pairs = [];
  for (const [k, v] of searchParams) {
    pairs.push([encodeURIComponent(k), encodeURIComponent(v)]);
  }
  pairs.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
  return pairs.map((p) => p.join("=")).join("&");
}

function signRequest(method, urlStr, payloadHash) {
  const url = new URL(urlStr);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "").slice(0, 15) + "Z";
  const dateStamp = amzDate.slice(0, 8);

  const headers = {
    host: url.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };

  const signedHeaderKeys = Object.keys(headers).sort();
  const canonicalHeaders = signedHeaderKeys.map((k) => `${k}:${headers[k]}`).join("\n") + "\n";
  const signedHeaders = signedHeaderKeys.join(";");

  const canonicalRequest = [
    method,
    url.pathname || "/",
    canonicalQueryString(url.searchParams),
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const kDate = hmac("AWS4" + SECRET_ACCESS_KEY, dateStamp);
  const kRegion = hmac(kDate, REGION);
  const kService = hmac(kRegion, SERVICE);
  const kSigning = hmac(kService, "aws4_request");
  const signature = hmac(kSigning, stringToSign, "hex");

  const auth = `AWS4-HMAC-SHA256 Credential=${ACCESS_KEY_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return { Authorization: auth, "x-amz-date": amzDate, "x-amz-content-sha256": payloadHash };
}

// ── HTTP helper ─────────────────────────────────────────────────────────────

function request(method, urlStr) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const payloadHash = sha256Hex("");
    const sigHeaders = signRequest(method, urlStr, payloadHash);

    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method,
      headers: sigHeaders,
    };

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const body = Buffer.concat(chunks).toString("utf8");
        resolve({ status: res.statusCode, body });
      });
    });
    req.on("error", reject);
    req.end();
  });
}

function requestBinary(method, urlStr) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const payloadHash = sha256Hex("");
    const sigHeaders = signRequest(method, urlStr, payloadHash);

    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method,
      headers: sigHeaders,
    };

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        resolve({ status: res.statusCode, data: Buffer.concat(chunks) });
      });
    });
    req.on("error", reject);
    req.end();
  });
}

// ── R2 operations ───────────────────────────────────────────────────────────

const BASE = `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`;

async function listAllObjects() {
  let allKeys = [];
  let continuationToken = null;
  let page = 0;

  do {
    page++;
    let url = `${BASE}/${BUCKET}?list-type=2&max-keys=1000`;
    if (continuationToken) url += `&continuation-token=${encodeURIComponent(continuationToken)}`;

    process.stdout.write(`  Listing page ${page}...`);
    const { status, body } = await request("GET", url);

    if (status !== 200) {
      console.log(` FAILED (${status})`);
      console.error(body);
      process.exit(1);
    }

    const keys = [];
    for (const m of body.matchAll(/<Key>([^<]*)<\/Key>/g)) keys.push(m[1]);
    allKeys = allKeys.concat(keys);
    console.log(` ${keys.length} objects`);

    const truncated = /<IsTruncated>true<\/IsTruncated>/.test(body);
    const tokenMatch = body.match(/<NextContinuationToken>([^<]*)<\/NextContinuationToken>/);
    continuationToken = truncated && tokenMatch ? tokenMatch[1] : null;
  } while (continuationToken);

  return allKeys;
}

async function downloadObject(key) {
  const url = `${BASE}/${BUCKET}/${key}`;
  const { status, data } = await requestBinary("GET", url);
  if (status !== 200) throw new Error(`HTTP ${status}`);
  return data;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  checkEnv();

  console.log(`Bucket:  ${BUCKET}`);
  console.log(`Output:  ${OUTPUT_DIR}`);
  console.log("");

  const keys = await listAllObjects();
  console.log(`Found ${keys.length} objects\n`);

  if (keys.length === 0) {
    console.log("Bucket is empty.");
    return;
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  let ok = 0;
  let fail = 0;

  for (const key of keys) {
    const localPath = path.join(OUTPUT_DIR, key);
    fs.mkdirSync(path.dirname(localPath), { recursive: true });

    try {
      process.stdout.write(`  ${key} ... `);
      const data = await downloadObject(key);
      fs.writeFileSync(localPath, data);
      console.log(`${(data.length / 1024).toFixed(1)} KB`);
      ok++;
    } catch (err) {
      console.log(`FAILED (${err.message})`);
      fail++;
    }
  }

  console.log(`\nDone. Downloaded: ${ok}, Failed: ${fail}`);
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
