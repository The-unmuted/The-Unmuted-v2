# AI Context — The Unmuted (非默)

_This file captures the current project state for AI assistants. Update before ending each work session._

_Last updated: 2026-07-19_

---

## What This Project Is

A bilingual (EN/ZH) mobile-first safety app for survivors of gender-based harm — domestic violence, sexual assault, stalking/harassment and other侵害 (D-021: never frame copy as DV-only) — built for mainland China compliance. Primary concern is survivor safety and privacy — personal data (emergency contacts) stays on-device; evidence is encrypted client-side so the server only ever sees ciphertext.

Core mission (all evidence work is judged against this): 帮助用户加密存储私密信息，并在未来有需要的时候能够作为有效证据进行举证。

Live: https://the-unmuted.vercel.app/

---

## Current State

**Active branch:** `main` (Phase 1-4 all committed & deployed; 2026-07-10 UX batch deployed and verified live on both platforms: real-2s SOS hold, in-app 修改密码, DonationWidget + display-name removed; 2026-07-11: ‼️ SOS entry on the unlock screen, D-024; 2026-07-17: per-action password re-verification in the Cloud Vault, D-025 — 解锁查看/导出举证包/删除 each ask for the password again, **awaiting Katie's phone verification**; 2026-07-19: aid directory skeleton, D-026 — city-filterable psych/legal directory in `aidDirectory.json`, weekly source-monitoring CI, **awaiting Katie's phone verification**. Next: fill 8 missing sourceUrls, China seed data, global country hotlines before UN hackathon — see tasks.md)
**Status:** **Phase 4 is complete** (4a/4b: honest copy + chat removal; 4c: D-022 delete cooling-off; 4d 2026-07-10: persistent inline unlock errors at all five password gates, vault-unavailable vs wrong-secret distinction in `UnlockResult`, whitespace-trim retry on unlock + trim at password creation — fixes the 2026-07-09 pasted-space lockout; FeedbackWidget reviewed and deliberately unchanged). Phases 1–3 browser-verified on a clean production build: OTP login (6-digit) → cloud key-vault password unlock → capture → encrypt → private-bucket save (现场取证 badge) → password re-verify → decrypt/export with exact SHA-256 match; 导出举证包 (D-020) verified end to end. Test suite: 23/23 vitest, tsc + eslint clean.

**Deployments (both live, verified 2026-07-10 serving the UX-batch build):**
- Vercel (overseas): https://the-unmuted.vercel.app/
- Tencent CloudBase (mainland China): https://theunmuted-v2-d2gyh0rux2a05de92-1434116173.tcloudbaseapp.com

**Repo topology:** two GitHub repos, unified 2026-07-02 onto one `main` lineage.
- `origin` = The-unmuted/The-Unmuted-demo (no CI secrets)
- `v2` = The-unmuted/The-Unmuted-v2 (has TENCENT_SECRET_ID/KEY + VITE_* secrets → CloudBase deploys run here)
- Push `main` to **both** remotes to keep them in sync; only the v2 push triggers a working CloudBase deploy.
- 2026-07-10 CI hardening: deploy script uses COS multipart upload (`cos.uploadFile`, 1MB slices — single-shot `putObject` stalled on the 2.6MB bundle); workflow has a repo guard (`if: github.repository == 'The-unmuted/The-Unmuted-v2'`) so the demo mirror no longer emails guaranteed failures.

**What works now (verified 2026-07-07: tsc clean, eslint 0 errors, 14/14 vitest passing; login → evidence hub → capture view browser-verified via local fallback):**
- Login flow renders and handles errors correctly (full OTP path untestable until Supabase restored)
- SOS flow (2s hold since 2026-07-10, previously 5s → group SMS with GCJ-02 Gaode link) — user-validated, do not touch; the post-hold "确认发送" prompt is OS-level (sms: URI) and cannot be removed by the app
- Evidence pipeline: encrypt → private bucket + encrypted cloud index → in-app decrypt/export, with offline pending queue
- Capture view: 拍照/录像/录音 + 导入已有文件 entry, capture-instant metadata (time / GCJ-02 location / device) sealed into meta, 现场取证/事后导入 badges (D-019)
- Legacy evidence records readable (read-only, need user's old key file)
- NGO directory (Supabase or hardcoded fallback)
- Fixed 2026-07-07: `useEvidenceVault` TDZ crash that broke EvidencePage on mount (Phase-1 regression, caught in browser)
- 举证 court export (2026-07-08, D-020): `src/lib/evidenceExport.ts` + 导出举证包 button on each cloud record — plain ZIP with decrypted original + bilingual verification/guidance HTML; verifiable with certutil/shasum, no app dependency

---

## Supabase state (unblocked 2026-07-08)

Restored from pause; migration `0001_key_vault_and_evidence.sql` applied; Magic Link template uses `{{ .Token }}`; Email OTP length set to 6. Full E2E passed 2026-07-08.

Remaining before real users:
1. **Custom SMTP** — built-in SMTP is rate-limited (~4 emails/hour).
2. **`portraits` bucket is public** — origin identified 2026-07-10: leftover from Katie's discontinued "Chroma" project (real ID-style photos, publicly readable; zero references in this codebase). Katie is deleting it in the dashboard.
3. **Shared Supabase project** — 非默 shares the "Chroma" project with a defunct app (shared keys/RLS/bucket namespace). Consider a dedicated project (backlog).

---

## Auth & Evidence Architecture (D-017 / D-018 — read docs/decisions.md before changing)

Two layers:
- **Account layer** = Supabase email OTP. Server-enforced, resettable. Persistent session per device.
- **Data layer** = login password + 12-char paper recovery code. Each wraps the same master key (PBKDF2-SHA256 310k → KEK → AES-GCM). Password is **never sent to any server** — it only derives the KEK client-side. Losing both password and recovery code = permanent data loss (by design; server cannot decrypt).
- Master key lives **only in memory** → every page load starts locked; records view re-verifies the password even when unlocked.
- Per-file AES-256-GCM keys are wrapped by the master key (`sealJson`) and stored in `evidence_records.wrapped_file_key`. All metadata is sealed too — cloud sees only ciphertext + hashes + timestamps.

Key files: `src/lib/keyVault.ts` (pure crypto), `src/lib/keyVaultService.ts` (Supabase-backed vault ops + session master key), `src/lib/authService.ts` (OTP), `src/lib/evidenceVaultService.ts` (storage + index + pending queue), `src/hooks/useEvidenceVault.ts` (UI pipeline), `src/components/LoginFlow.tsx`, `src/components/EvidencePage.tsx`.

---

## Known Issues

### Security / Production Gaps
1. **ChainMaker API key exposed in browser** — `VITE_CHAINMAKER_API_KEY` still browser-bundled. Legacy path only now; retire or proxy before production (Phase 4).
2. ~~Gun.js chat is not E2E~~ — resolved 2026-07-09 (Phase 4b): all P2P chat / support-network / 预警地图 code deleted, `gun` dependency removed. SOSPage now contains only the validated SOS button + contacts + message template.

### Technical
4. ~~`MapPage.tsx` orphaned~~ — deleted 2026-07-09 (Phase 4b) along with useGeoAlert; `geoAlert.ts` lib kept (SOSButton imports it).
5. **`programs/the_unmuted_program/`** — Solana dead code from v1.0.
6. **Test coverage thin** — 23 unit tests (keyVault, captureMetadata grading, evidenceExport); no tests for evidenceVaultService, locale, or E2E (Playwright configured, no test files).
7. **SOS broadcast not wired to `useOfflineBuffer`** — evidence upload queue is done; SOS path still isn't.

### UX
8. **SMS SOS on desktop** — degraded experience (opens default mail/message client).
9. ~~Login flow error messaging + feedback widget polish~~ — done 2026-07-10 (Phase 4d): persistent inline errors, vault-unavailable vs wrong-secret, whitespace trim; FeedbackWidget reviewed, unchanged.

---

## Active Goals (as of 2026-07-06)

1. ~~Phase 1: accounts + key hierarchy + secure storage~~ ✅ E2E accepted 2026-07-08
2. ~~Phase 2 — 取证~~ ✅ E2E accepted 2026-07-08 (capture metadata + D-019 grading)
3. ~~Phase 3 — 举证~~ ✅ complete 2026-07-08 (D-020: one-tap court package, browser-verified hash round-trip)
4. ~~Phase 4 — honest cleanup~~ ✅ complete 2026-07-10 (4a copy, 4b chat removal, 4c D-022 cooling-off, 4d login error messaging)
5. Gated on company entity: TSA anchoring (+ backfill), Tencent Cloud migration (D-016), phone OTP (D-012) ← **next frontier** (plus pre-launch: custom SMTP, dedicated Supabase project)

---

## Environment Variables Required

| Variable | Required | Purpose |
|----------|----------|---------|
| `VITE_SUPABASE_URL` | **Yes (production track)** | Auth OTP, key vault, evidence storage + index, NGO directory, feedback. |
| `VITE_SUPABASE_ANON_KEY` | **Yes (production track)** | Required with Supabase URL. |
| `VITE_PRIVY_APP_ID` | No | Legacy optional Privy OTP. Superseded by Supabase auth. |
| `VITE_CHAINMAKER_API_KEY` | No | Legacy path only. Without it, deterministic simulation runs. |
| `VITE_CHAINMAKER_ENDPOINT` | No | Custom ChainMaker BaaS endpoint. |
| `TENCENT_SECRET_ID` / `KEY` | CI only | CloudBase deployment (v2 repo GitHub Secrets only). |

---

## Key Architectural Constraints

- **No server-side personal data** — emergency contacts, passwords stay on-device. The evidence cloud vault stores **ciphertext only**; this complies with the rule's intent (server subpoena/breach reveals nothing).
- **Password never leaves the device** — it derives the KEK; only wrapped keys go to the cloud.
- **China-first deployment** — CloudBase mirror required; Gaode maps; `curl --noproxy '*'` needed on the dev machine for China endpoints.
- **No wallet features, no chat feature, max 2 emergency contacts.**
- **Plain-language copy** — 保险柜/钥匙, never 哈希/密钥/助记词 in user-facing text; all copy via `copyFor()`.
- **Never overclaim security** (Aspire News lesson) — new-pipeline copy says hashes are locally fixed, timestamp service 接入中.
- **Recovery code shown exactly once** — never stored anywhere except the user's paper.

---

## Files to Read Before Major Changes

| File | Why |
|------|-----|
| `src/pages/Index.tsx` | Unlock gating + tab routing; changes affect the whole app |
| `src/lib/keyVault.ts` / `keyVaultService.ts` | D-017 key hierarchy — do not change without reading D-017 附录 Q1–Q9 |
| `src/lib/evidenceVaultService.ts` | Storage, index, pending queue, integrity check |
| `src/hooks/useEvidenceVault.ts` | Evidence UI pipeline |
| `src/components/LoginFlow.tsx` | OTP + password/recovery-code unlock UX |
| `src/components/SOSPage.tsx` | SOS flow — user-validated, don't touch location logic |
| `src/lib/locale.tsx` | All new copy needs `copyFor()` |
| `docs/decisions.md` | D-012–D-018: why things are built this way |

---

## Unresolved Problems

- **Timestamp anchoring** — no trusted timestamp until company entity exists (TSA API needs one). Schema keeps original hash + dual timestamps so old records can be retroactively anchored (补锚定).
- **Production SMS delivery** — `sms:` URI unreliable on some Android; server-side SMS API gated on entity + SMS signature filing.
- **NGO admin approval workflow** — `ngo_applications` has no admin UI.
- **Supabase → Tencent migration path (D-016)** — planned at launch; service layer kept thin to ease the swap.
