#!/usr/bin/env node
/**
 * Move product JSON files into their corresponding R2 download folders.
 *
 * Looks at each <id>.json in ./products and moves it to ./r2-downloads/<id>/<id>.json
 *
 * Usage:
 *   node scripts/move-products.js
 */

const fs = require("fs");
const path = require("path");

const PRODUCTS_DIR = path.join(__dirname, "..", "products");
const R2_DIR = path.join(__dirname, "..", "r2-downloads");

function main() {
  if (!fs.existsSync(PRODUCTS_DIR)) {
    console.error(`Products directory not found: ${PRODUCTS_DIR}`);
    process.exit(1);
  }

  if (!fs.existsSync(R2_DIR)) {
    console.error(`R2 downloads directory not found: ${R2_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(PRODUCTS_DIR).filter((f) => f.endsWith(".json"));
  console.log(`Found ${files.length} product JSON files\n`);

  let moved = 0;
  let skipped = 0;

  for (const file of files) {
    const id = file.replace(".json", "");
    const destDir = path.join(R2_DIR, id);
    const srcPath = path.join(PRODUCTS_DIR, file);
    const destPath = path.join(destDir, file);

    if (!fs.existsSync(destDir)) {
      console.log(`  ${id} — no folder in r2-downloads, skipping`);
      skipped++;
      continue;
    }

    fs.copyFileSync(srcPath, destPath);
    fs.unlinkSync(srcPath);
    console.log(`  ${id} → r2-downloads/${id}/${file}`);
    moved++;
  }

  console.log(`\nDone. Moved: ${moved}, Skipped: ${skipped}`);
}

main();
