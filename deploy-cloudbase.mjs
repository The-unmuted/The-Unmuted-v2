/**
 * Deploy dist/ to Tencent CloudBase static hosting bucket (ap-shanghai)
 * Bucket: 45b6-static-theunmuted-v2-d2gyh0rux2a05de92-1434116173
 */
import COS from "cos-nodejs-sdk-v5";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SecretId = process.env.TENCENT_SECRET_ID;
const SecretKey = process.env.TENCENT_SECRET_KEY;
if (!SecretId || !SecretKey) {
  console.error("Missing TENCENT_SECRET_ID or TENCENT_SECRET_KEY env vars.");
  process.exit(1);
}
const cos = new COS({ SecretId, SecretKey });

const BUCKET = "45b6-static-theunmuted-v2-d2gyh0rux2a05de92-1434116173";
const REGION = "ap-shanghai";
const DIST_DIR = path.join(__dirname, "dist");

function getAllFiles(dir, base = "") {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const key = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...getAllFiles(fullPath, key));
    } else {
      files.push({ fullPath, key });
    }
  }
  return files;
}

function getContentType(key) {
  const ext = path.extname(key).toLowerCase();
  const map = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".txt": "text/plain",
    ".webmanifest": "application/manifest+json",
  };
  return map[ext] || "application/octet-stream";
}

async function uploadFile(fullPath, key) {
  const isHtml = key.endsWith(".html");
  return new Promise((resolve, reject) => {
    cos.putObject(
      {
        Bucket: BUCKET,
        Region: REGION,
        Key: key,
        Body: fs.createReadStream(fullPath),
        ContentType: getContentType(key),
        CacheControl: isHtml ? "no-cache, no-store, must-revalidate" : "public, max-age=31536000, immutable",
      },
      (err, data) => {
        if (err) reject(err);
        else resolve(data);
      }
    );
  });
}

async function main() {
  const files = getAllFiles(DIST_DIR);
  console.log(`Found ${files.length} files to upload`);

  // Upload index.html LAST so we don't serve partial deploys
  const htmlFiles = files.filter((f) => f.key.endsWith(".html"));
  const otherFiles = files.filter((f) => !f.key.endsWith(".html"));

  const BATCH = 8;
  let done = 0;
  let failed = [];

  async function uploadWithRetry(file, retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        await uploadFile(file.fullPath, file.key);
        done++;
        if (done % 20 === 0) console.log(`  ${done}/${files.length} uploaded...`);
        return;
      } catch (e) {
        if (i === retries - 1) {
          console.error(`  FAILED: ${file.key} — ${e.message}`);
          failed.push(file.key);
        } else {
          await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
        }
      }
    }
  }

  // Upload non-HTML files in batches
  for (let i = 0; i < otherFiles.length; i += BATCH) {
    const batch = otherFiles.slice(i, i + BATCH);
    await Promise.all(batch.map((f) => uploadWithRetry(f)));
  }

  // Upload HTML files last (one at a time)
  for (const f of htmlFiles) {
    await uploadWithRetry(f);
  }

  console.log(`\nUpload complete: ${done} files`);
  if (failed.length > 0) {
    console.error(`Failed: ${failed.join(", ")}`);
    process.exit(1);
  }

  // Verify index.html
  console.log("\nVerifying index.html content in bucket...");
  await new Promise((resolve, reject) => {
    cos.getObject(
      { Bucket: BUCKET, Region: REGION, Key: "index.html" },
      (err, data) => {
        if (err) return reject(err);
        const html = data.Body.toString();
        const hasAmap = html.includes("amap") || html.includes("assets/");
        console.log(`index.html in bucket — Has amap ref or assets: ${hasAmap}`);
        console.log(`index.html size: ${html.length} bytes`);
        resolve();
      }
    );
  });
}

main().catch((e) => {
  console.error("Deploy failed:", e);
  process.exit(1);
});
