# Tasks & Roadmap — The Unmuted (非默)

_Last updated: 2026-07-10_

---

## Active (In Progress)

### Production version track (left demo stage 2026-07-06; evidence architecture per D-014/D-016/D-017)

**Phase 1 — Foundation: accounts + key hierarchy + secure storage** _(code complete 2026-07-06)_
- [x] Server-backed accounts (Supabase Auth email OTP — D-018; enables cross-device recovery)
- [x] Master key + 12-char paper recovery code + wrapped per-file keys in cloud (D-017; `keyVault.ts` + 7 unit tests)
- [x] Encrypted record index in cloud, bound to account (`evidence_records`, replaces localStorage-only index)
- [x] **Fix evidence bucket security** — new pipeline uses private bucket + per-user paths `{uid}/{txId}` + RLS download (old public-URL `arweaveService.ts` deleted)
- [x] Legacy per-file JSON key bundles: old records listed read-only ("旧版记录，需要密钥文件")
- [x] Offline resilience: pending upload queue + auto-retry on `online` event + per-record 已同步/待上传 badge
- [x] ~~BLOCKER: Supabase project paused~~ — restored 2026-07-08; migration applied; OTP template `{{ .Token }}`; OTP length set to 6
  - [ ] Built-in SMTP is rate-limited (~4 emails/hour) — custom SMTP needed before real users
  - [x] `portraits` bucket (public, leftover from Katie's discontinued "Chroma" project with real ID-style photos) — **files deleted by Katie 2026-07-10**; empty bucket itself still to be deleted (⋮ → Delete bucket)
  - [ ] Consider moving 非默 to a dedicated Supabase project — it currently shares the "Chroma" project with a defunct app (shared trust boundary: keys, RLS, buckets)
  - [x] End-to-end browser test of signup → recovery code → upload → unlock-and-decrypt — **passed 2026-07-08 on production build** (hash round-trip verified)

**Phase 2 — 取证 (in-app capture)** _(code complete 2026-07-07; **E2E accepted 2026-07-08** on production build)_
- [x] Camera/mic capture inside evidence vault; hash computed client-side at capture instant (encrypt+hash runs immediately in `processFile`)
- [x] Metadata: device time (`capturedAt`) + server time (`created_at`), GCJ-02 location (pre-warmed on entering capture view), device info — all sealed client-side (`captureMetadata.ts`, D-019)
- [x] Grade records: 一级现场取证 vs 二级事后导入 — in-app recording = 1; camera inputs graded by file freshness (≤2 min); explicit 导入 entry = always 2; badges on receipt + history (D-019)
- [x] Hash/metadata schema designed for retroactive TSA anchoring (originalHash + dual timestamps are plaintext columns; 补锚定 possible once entity exists)
- [x] Fix: `useEvidenceVault` TDZ crash (`refreshHistory` referenced in the online-retry effect before declaration) — EvidencePage crashed on mount; caught in browser test 2026-07-07

**Phase 3 — 举证 (court export)** _(complete 2026-07-08; browser-verified on production build, D-020)_
- [x] One-tap evidence package: decrypted original + metadata + hash + verification instructions page (`evidenceExport.ts`, 导出举证包 button; hash round-trip verified end to end)
- [x] Standard formats only — verifiable without 非默 existing (plain ZIP + self-contained HTML; certutil/shasum instructions with expected value)
- [x] Per-scenario guidance: 人身安全保护令 / 离婚诉讼 / 报警立案 (+12348/12338 hotlines, in the package HTML)

**Phase 4 — Honest cleanup + safety hardening**
- [x] Retire ChainMaker/Arweave simulated anchoring from UI copy — done 2026-07-08 (Phase 4a: HowItWorks rewritten, 测试链（旧版） badge, donation copy, dead SOSHistory deleted)
- [x] Remove P2P chat feature code — done 2026-07-09 (Phase 4b: SOSPage dead wizard/chat branches + CommunityPage/MapPage/useP2PChat/useGeoAlert/p2pChat/supportNetwork deleted; `gun` uninstalled; SOS button path untouched)
- [x] Evidence deletion cooling-off: 72h soft delete, hidden password-gated recovery (anti-coercion, D-022) — done 2026-07-09 (Phase 4c; browser E2E passed)
- [x] Login flow error messaging (Phase 4d) — done 2026-07-10, browser-verified: 密码错误 toast → persistent inline errors (LoginFlow unlock/recovery/local + both EvidencePage password gates); `unlockWithPassword`/`unlockWithRecoveryCode` now distinguish vault-unavailable vs wrong-secret; whitespace-trim retry on unlock + trim at password creation (fixes the 2026-07-09 pasted-leading-space incident). FeedbackWidget reviewed — nothing wrong, left unchanged.

**Gated on company entity (unchanged order):** TSA API access → anchor new + backfill old hashes; Tencent Cloud migration (D-016); phone OTP (D-012)

---

## Backlog — High Priority

### Security / Production Hardiness
- [ ] **ChainMaker API proxy** — Move ChainMaker REST call to Vercel Serverless Function to fix CORS and protect API key (currently `VITE_` prefix exposes it to browser)
- [x] ~~Replace Gun.js with real E2E encryption~~ — moot 2026-07-09: chat feature removed entirely (Phase 4b); no chat will be rebuilt (product scope)
- [x] ~~Password reset flow~~ — solved 2026-07-06: email OTP resets account access, paper recovery code resets data access (D-017/D-018)

### Core UX
- [ ] **Biometric unlock (Face ID / fingerprint)** — replace daily password entry with platform biometrics (WebAuthn/passkey + PRF wrapping the master key); password remains the fallback + new-device path. Requested by Katie 2026-07-10 after friction feedback.
- [ ] **Emergency SOS entry on the unlock screen** — SOS needs no account/password (contacts are localStorage); proposal: restrained entry on the password screen, no contact details shown pre-auth. Trade-off: weakens the login wall's disguise effect. **Awaiting Katie's decision.**
- [x] ~~Evidence key recovery~~ — solved 2026-07-06 by D-017 key hierarchy (no more per-file key bundles to lose)
- [ ] **Offline-first mode** — evidence upload queue done (2026-07-06); SOS broadcast path still not wired to `useOfflineBuffer`
- [x] ~~Map page resurface~~ — resolved 2026-07-09: `MapPage.tsx` deleted (Phase 4b); the 预警地图 concept is retired

### China Compliance — Formal Launch Track (ordered, see D-012)
- [ ] **Company entity** — register a legal entity (prerequisite for everything below)
- [ ] **ICP filing** — Required for CloudBase-hosted app to be accessible in China long-term
- [ ] **App filing (app备案)** — required for formal mainland launch
- [ ] **Tencent SMS signature filing** — prerequisite for phone OTP
- [ ] **Phone OTP login** — real-name compliance + Chinese user habit; phone stored encrypted/isolated, evidence stays client-side ("实名的是账号，加密的是内容")
- [ ] **WeChat login (optional entry, never the only one)** — binds identity to WeChat account, a concern for some survivors
- [ ] **ChainMaker mainnet** — Upgrade from testnet to ChainMaker production chain when ready
- [ ] **SMS via China carrier API** — Replace `sms:` URI with server-side SMS API (e.g., Tencent SMS) for more reliable delivery on iOS/Android

---

## Backlog — Medium Priority

### Features
- [ ] **NGO admin review flow** — Currently NGO applications go to Supabase but there is no admin UI to approve/reject
- [ ] **Evidence export** — Allow users to export all vault records as a ZIP with decryption instructions
- [ ] **Multi-language expansion** — Add more languages (e.g., Cantonese, Uyghur) if target users expand beyond Mandarin/English
- [ ] **Accessibility audit** — Screen reader support, color contrast for high-contrast mode

### Technical Debt
- [ ] **True ZKP circuit** — Replace SHA-256 commitment scheme with a proper ZKP (snarkjs/Groth16) if Sybil resistance is needed
- [ ] **Test coverage** — `src/test/` has only a placeholder; add unit tests for crypto, locale, and evidence pipeline
- [ ] **Playwright E2E tests** — `playwright.config.ts` + `playwright-fixture.ts` exist but no test files written
- [ ] **Solana program cleanup** — `programs/the_unmuted_program/` is unused dead code; remove or document as archived

---

## Done (Recent)

- [x] SOS hold 5s → real 2s; 修改密码 in settings; donation widget + display-name setting removed (2026-07-10, Katie's UX feedback)
- [x] China-reachable deployment live on CloudBase default domain (2026-07-02)
- [x] Unify diverged repos (The-Unmuted-demo + The-Unmuted-v2) onto single main lineage (2026-07-02)
- [x] Fix CloudBase CI: Node 24 lockfile compatibility (2026-07-02)
- [x] CI: auto-deploy to Tencent CloudBase on push to main
- [x] Remove 事后存证 card from SOSPage
- [x] Supabase evidence storage, key UX overhaul, hotline data update
- [x] WGS-84 → GCJ-02 coordinate conversion for Gaode map URL
- [x] GPS pre-warming on press-start for accurate location at trigger
- [x] Enrich SOS location block with accuracy, Gaode nav link, battery & network
- [x] Evidence vault restructured into hub with 3 sub-sections
- [x] Evidence vault promoted to second bottom-nav tab
- [x] Replace map/community tabs with 心理援助 and 法律援助
- [x] Replace map link with GPS coordinates in SOS SMS
- [x] Gaode maps, pre-set SOS message template, fix contacts stale state
- [x] Remove all crypto/wallet dependencies (v2.0 migration)
- [x] Password login + settings widget + feedback fix
- [x] Dual deployment (Vercel + CloudBase)
