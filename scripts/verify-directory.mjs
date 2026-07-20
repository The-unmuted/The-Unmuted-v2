/**
 * Weekly directory health check (run by CI cron, or locally: node scripts/verify-directory.mjs)
 *
 * A phone number cannot be robo-dialed to verify — instead each entry carries a
 * sourceUrl (the official page that publishes the number). This script re-checks:
 *   FAIL  — source/website URL returns 4xx/5xx (dead page)
 *   FAIL  — source page is reachable but the phone number no longer appears on it
 *   WARN  — URL unreachable from CI (timeout/DNS/reset — likely cross-border blocking, needs a human check)
 *   WARN  — no sourceUrl on record (cannot auto-verify; team must add one)
 *   WARN  — human verification (verifiedAt) older than 6 months
 * Exits 1 only on FAILs, so the team gets a CI alert exactly when data is wrong.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const { resources } = JSON.parse(
  readFileSync(join(root, "src/data/aidDirectory.json"), "utf8")
);

const STALE_MONTHS = 6;
const FETCH_TIMEOUT_MS = 20_000;
const failures = [];
const warnings = [];

function monthsSince(yyyyMm, now = new Date()) {
  const [y, m] = yyyyMm.split("-").map(Number);
  return (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - m);
}

async function fetchPage(url) {
  const res = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; TheUnmutedDirectoryCheck/1.0; +https://the-unmuted.vercel.app)",
    },
  });
  return { status: res.status, text: res.ok ? await res.text() : "" };
}

// Shortcodes (12338 etc.) are too generic for a digits-substring match to mean
// anything; only landline-length numbers are checked against the source page.
function phoneCheckable(phone) {
  return phone && phone.replace(/\D/g, "").length >= 8;
}

for (const r of resources) {
  const label = `${r.id} (${r.name})`;

  if (monthsSince(r.verifiedAt) >= STALE_MONTHS) {
    warnings.push(`${label}: last human verification ${r.verifiedAt} — re-verify by phone`);
  }

  if (!r.sourceUrl) {
    warnings.push(`${label}: no sourceUrl — cannot auto-verify the number, add the official page that publishes it`);
  }

  const urls = [...new Set([r.sourceUrl, r.websiteUrl].filter(Boolean))];
  for (const url of urls) {
    let page;
    try {
      page = await fetchPage(url);
    } catch {
      warnings.push(`${label}: ${url} unreachable from CI — check manually (possibly geo-blocked)`);
      continue;
    }
    if (page.status >= 400) {
      failures.push(`${label}: ${url} returned HTTP ${page.status}`);
      continue;
    }
    if (url === r.sourceUrl && phoneCheckable(r.phone)) {
      const digits = r.phone.replace(/\D/g, "");
      const pageDigits = page.text.replace(/\D/g, "");
      if (!pageDigits.includes(digits)) {
        failures.push(
          `${label}: phone ${r.phone} no longer found on source page ${url} — number may have changed`
        );
      }
    }
  }
}

const summary = [
  `Checked ${resources.length} directory entries.`,
  "",
  failures.length ? `## FAILURES (${failures.length})` : "## No failures ✓",
  ...failures.map((f) => `- ${f}`),
  "",
  warnings.length ? `## Warnings (${warnings.length})` : "## No warnings",
  ...warnings.map((w) => `- ${w}`),
].join("\n");

console.log(summary);

if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFileSync } = await import("node:fs");
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + "\n");
}

process.exit(failures.length > 0 ? 1 : 0);
