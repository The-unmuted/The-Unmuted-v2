# Changelog — The Unmuted (非默)

## 2026-07-09 — Phase 4c: 72h delete cooling-off with hidden recovery (D-022)

### Added (anti-coercion design — deletion must LOOK final; see D-022)
- **Delete on cloud records**: small trash icon on each 云端保险柜 card → inline two-tap confirm（确定删除/取消, no browser dialog）→ record vanishes; the only feedback is a 「已删除。」 toast. No recovery/回收站/时限 wording anywhere on the delete path.
- **Soft delete**: `deleteEvidence` sets `evidence_records.deleted_at` (column existed since migration 0001), removes the local index entry + cached blob; pending (never-uploaded) records are removed outright.
- **Hidden recovery entry**: inconspicuous grey line 「找回误删的记录」 at the very bottom of the records list → `最近删除` view gated by a **fresh vault-password check** (`unlockWithPassword`) even in an unlocked session.
- **`最近删除` view**: deleted records with 「约 N 天/小时后彻底清除」 countdown + one-tap 恢复 (`restoreEvidence` nulls `deleted_at`); empty state explains ≥3-day purges are unrecoverable.
- **Client-triggered purge**: `purgeExpiredEvidence` (72h, `DELETE_RETENTION_MS`) runs on records-view open and before listing deleted records — removes the storage object then the row.

### Verified (browser E2E on production preview, 2026-07-09)
- Delete → only 「已删除。」, no recovery hints; DB `deleted_at` set, sibling record untouched → grey line → password gate enforced → deleted record listed with countdown → 恢复 → record back in list, `deleted_at` cleared. tsc + eslint clean, 23/23 tests, build OK.

## 2026-07-09 — Phase 4b: P2P chat (Gun.js) code fully removed

### Removed (user-confirmed scope; all files verified to have zero live importers before deletion)
- **`src/components/SOSPage.tsx` dead wizard/chat branches** — the unreachable 5-step anonymous help-request flow (help:type → location → support → matching → session with P2P chat). It was the retired "向附近陌生人求救" feature; no `go({view:"help:type"})` entry point existed anywhere. File went 841 → 260 lines. **HomeView / EmergencyContactsCard / SosMessageCard / SOSButton untouched** — the validated SOS + 定位 path is byte-identical.
- **`src/components/CommunityPage.tsx`**, **`src/hooks/useP2PChat.ts`** — orphaned P2P chat UI/hook.
- **`src/components/MapPage.tsx`**, **`src/hooks/useGeoAlert.ts`** — 预警地图 remnants (v1 feature, removed from nav long ago). `src/lib/geoAlert.ts` kept because SOSButton still imports its two harmless localStorage writes.
- **`src/lib/p2pChat.ts`**, **`src/lib/supportNetwork.ts`** — Gun.js chat + public-relay help-request broadcast (was never E2E encrypted; known issue #2).
- **`gun` npm dependency** uninstalled.

### Verified
- tsc clean, ESLint 0 errors, 23/23 tests, production build OK; zero remaining references to gun/p2pChat/supportNetwork/useGeoAlert/CommunityPage/MapPage/useP2PChat in src/. Browser regression of the SOS page on the preview build.

## 2026-07-08 — Scope-correct legal guidance + Phase 4a: honest copy cleanup

### Changed (user directive: 非默 serves survivors of 性侵害/骚扰跟踪/其他侵害, not only 家暴 — D-021)
- **举证说明.html scenarios restructured**: 报警与立案 is now scenario 1 and universal (adds sexual-assault-specific guidance: report promptly, forensic exam, don't wash self/clothing first); 人身安全保护令 now states it applies to family *and* intimate relationships (同居/恋爱), 不需要先起诉离婚也不限于婚姻关系; scenario 3 broadened to 诉讼维权（刑事、民事赔偿或离婚诉讼）. Lead-in sentence names all situations. Visually re-verified in browser.
- **LegalTipsDisclosure** first tip de-DV-framed: police receipts/dispatch records universal, sexual-assault forensic advice added, 告诫书 kept as the DV-specific extra.

### Phase 4a — simulated anchoring copy retired from UI
- **HowItWorksDisclosure** (capture view) rewritten honestly: 当场加密 / 云端保险柜（云端只见密文）/ 指纹与时间当场固定 + TSA 接入中 — replaces the false "Arweave 永久存储 + 长安链司法联盟链不可篡改" claims that were still showing on the *new* pipeline's capture page.
- Legacy record badge "已上链" → "测试链（旧版）" (it was ChainMaker testnet, not a judicial chain).
- DonationWidget no longer claims donations fund "区块链存证上链费用" — now 平台运营与维护.
- Deleted dead `SOSHistory` component (never rendered; claimed "✓ 已上链" with a snowtrace/Avalanche testnet link — crypto-era remnant) and its `formatTs` helper.

### Verified
- tsc clean, ESLint 0 errors, 23/23 tests; production build rebuilt.

### Added
- **Court package builder (`src/lib/evidenceExport.ts`, D-020)** — one tap on 导出举证包 produces a plain ZIP: the decrypted original under `证据文件/` plus a self-contained bilingual `举证说明.html` containing the full evidence table (file name/type/size, capture grade with plain-language explanation, capture/device/server times, GCJ-02 location, device info, record ID, both SHA-256 fingerprints), universal verification instructions (`certutil -hashfile` / `shasum -a 256` with the expected value), and per-scenario guidance for 人身安全保护令 / 离婚诉讼 / 报警与立案 with the 12348/12338 hotlines. Everything is verifiable with OS-built-in tools even if 非默 no longer exists — no proprietary formats.
- **导出举证包 button** on every cloud record card (`EvidencePage.tsx`), alongside 解锁查看; reuses the same fetch→verify→decrypt path, mutual disabling while either runs. Package named `举证包_YYYY-MM-DD_txID6.zip`.
- **fflate dependency** for standard ZIP creation in the browser (UTF-8 name flag set correctly).
- **9 new unit tests** (`evidenceExport.test.ts`, 23 total): content presence, grade-1 vs grade-2 rendering, scenario sections, honesty rules (contains 接入中, never 绝对安全/区块链), HTML escaping of user-controlled fields, full ZIP round-trip byte comparison, naming fallbacks.

### Verified
- tsc clean, ESLint 0 errors, 23/23 tests. Browser E2E on the production preview build: exported `举证包_2026-07-08_4i2KRd.zip`, extracted, and the extracted file's SHA-256 matches both the fingerprint stated inside the HTML and the record's sealed 原始文件指纹. Rendered HTML visually reviewed (table, verification section, scenario cards, hotlines, footer).
- Known caveat: macOS's ancient CLI `unzip` (Info-ZIP 6.0) can't handle UTF-8 names — Finder/`ditto` and Windows 10+ extract fine; the ZIP itself is standards-correct.

## 2026-07-08 — Phase 1+2 E2E acceptance passed (production build)

### Verified
- Full cloud-path E2E on a clean production build (`vite preview`, fresh origin, no local state): email OTP login (6-digit, after fixing the Supabase Email OTP Length setting 8→6) → password unlock via cloud `key_vaults` → in-app capture → encrypt → private-bucket save (已进保险柜✓, 现场取证 badge) → records view password re-verify → 解锁查看 fetch/verify/decrypt/export.
- Cryptographic round-trip confirmed: SHA-256 of the exported decrypted file exactly matches the record's sealed 原始文件指纹.
- Cross-device story confirmed: a fresh origin with no localStorage lists earlier records from the encrypted cloud index.

### Fixed (Supabase dashboard, not code)
- Project restored from free-tier pause; migration `0001_key_vault_and_evidence.sql` applied; Magic Link template set to `{{ .Token }}`; Email OTP length set to 6.

### Known follow-ups
- `portraits` bucket is public (origin unknown) — needs review/removal.
- Custom SMTP required before real users (built-in ~4 emails/hour).

## 2026-07-07 — Production track Phase 2: 取证 (in-app capture with graded records)

### Added
- **Capture-instant metadata (`src/lib/captureMetadata.ts`)** — device time, GCJ-02 location (pre-warmed when the capture view opens, same pattern as the SOS button), and device info are gathered at the capture moment and sealed into the record's encrypted metadata. Precise coordinates are allowed here because the cloud only ever sees ciphertext (unlike broadcast channels, which stay at ~0.1° rounding).
- **Honest capture grading (D-019)** — every record now carries 现场取证 (grade 1) or 事后导入 (grade 2): in-app audio recording is always grade 1; camera-input files are graded by their own timestamp (≤2 min old = live); a new explicit "导入已有的照片、录音或文件" entry is always grade 2 and gets no location. Badges shown on the receipt card and in the cloud vault history; capture time/location shown in expanded record details.
- **Unit tests** — 6 new tests for grading boundaries and location fallback (14 total).

### Changed
- **Hub card copy de-overclaimed** — "自动加密并写入区块链存证" → "拍照、录像或录音，当场加密，并记下时间和地点。" (Phase-4 honesty rule applied early to the card this work touched.)
- `wgs84ToGcj02` exported from `useEmergencyContacts.ts` (no logic change) for reuse by capture metadata; `GCJ_EE` literal trimmed to its exact representable double (identical value, fixes the one ESLint error).

### Fixed
- **EvidencePage crashed on mount** — `useEvidenceVault` referenced `refreshHistory` in the online-retry effect's dependency array before its declaration (TDZ ReferenceError). Introduced in Phase 1, caught by in-browser testing of Phase 2.

### Verified
- tsc clean, ESLint 0 errors, 14/14 tests. Login → evidence hub → capture view verified in Chrome via the local fallback (Supabase still paused); the cloud save path E2E remains gated on the Phase-1 blocker below.

## 2026-07-06 — Production track Phase 1: accounts + key hierarchy + cloud evidence vault (code complete, deployment blocked on Supabase restore)

### Added
- **Server-backed accounts (D-018)** — Supabase Auth email OTP (6-digit code) is now the account layer. `LoginFlow.tsx` replaces the old `SignupPage`; `authService.ts` wraps signInWithOtp/verifyOtp. Persistent sessions mean OTP is only needed on a new device.
- **D-017 key hierarchy live** — `keyVault.ts` + `keyVaultService.ts`: master key wrapped twice (password box + 12-char paper recovery code box, PBKDF2-SHA256 310k iterations), stored in `key_vaults` table. Per-file keys wrapped by the master key. Password is never sent to any server. Recovery code shown exactly once. 7 unit tests.
- **Production evidence pipeline** — `evidenceVaultService.ts` + rewritten `useEvidenceVault.ts`: encrypt on device → ciphertext to **private** `evidence-vault` bucket at `{userId}/{txId}` (RLS) → encrypted record index in `evidence_records` (wrapped file key + sealed metadata + dual hashes + capture grade + client/server timestamps). No more key-file downloads for the user.
- **In-app decrypt/export** — "解锁查看" on each cloud record: fetch (cache→cloud), verify ciphertext SHA-256, unwrap file key, decrypt, download original. Includes safety toast reminding the user to delete the file if the device is not safe.
- **Offline resilience** — IndexedDB ciphertext cache + localStorage pending queue (ciphertext only); auto-retry on the `online` event; per-record 已进保险柜 / 等待上传 badges; manual sync on vault unlock.
- **Soft delete** — `deleted_at` on `evidence_records` (72h cooling-off UI still to come, Phase 4).
- **SQL migration** — `supabase/migrations/0001_key_vault_and_evidence.sql`: `key_vaults`, `evidence_records`, private bucket + per-user RLS policies. **Written but not yet applied** (project paused).

### Changed
- **Every page load starts locked** — master key is memory-only; `Index.tsx` gates the app on unlock even when a Supabase session persists (D-017 intended behavior).
- **Records view privacy gate** — viewing history re-verifies the password via `unlockWithPassword` even when the master key is already in memory (phone-grabbed-while-unlocked protection).
- **Honest upload steps** — processing UI now shows 2 real steps (锁上文件 AES-256 加密 → 存入你的云端保险柜); fake ChainMaker "anchoring" step removed from the new pipeline.
- **Single shared Supabase client** — `userCredentials.ts`, `ngoService.ts`, `FeedbackWidget.tsx` now import from `supabaseClient.ts` (fixes "Multiple GoTrueClient instances" warning).
- **Legacy records read-only** — old localStorage/key-file records shown under 旧版记录（需要你当时保存的密钥文件）; nothing new is written to that path.

### Removed
- **`arweaveService.ts` deleted** — the old public-bucket upload path (public URL = anyone with the link could download ciphertext) is gone from code; the migration makes the bucket private server-side.
- **Per-file key bundle downloads** — replaced by the D-017 key hierarchy; `KeySaveSection` deleted from `EvidencePage.tsx`.

### Known blocker
- Supabase project `iisjendxxmxpgwohckiq` is **paused** (free-tier auto-pause, NXDOMAIN). Must be restored in the dashboard, then: apply the migration, set the OTP email template to `{{ .Token }}` (default sends a magic link), configure custom SMTP (built-in is ~4 emails/hour), then run the full E2E browser test.

## 2026-07-02 — China deployment live + repo unification
- **CloudBase China deployment is live**: https://theunmuted-v2-d2gyh0rux2a05de92-1434116173.tcloudbaseapp.com (mainland-reachable, free tier, no ICP needed for default domain)
- Unified the two diverged repos: `The-Unmuted-demo` (origin) and `The-Unmuted-v2` now share a single `main` lineage
  - Merged `feature/feedback-login` → `main` (brought v2.0 work + CloudBase CI to demo repo)
  - Merged `v2/main` → `main` (brought UI fixes, legal aid updates, hardened deploy workflow)
- Fixed CI: Node 24 for `npm ci` lockfile compatibility (npm 10 vs 11 optional-dep validation mismatch)
- Note: Tencent secrets (`TENCENT_SECRET_ID`/`KEY`) exist **only** in the v2 repo's GitHub Secrets — deploys must go through `The-Unmuted-v2`, or secrets must be added to demo repo

## Unreleased (on main, 2026-07-02)
- **SOS group SMS** — one long-press now opens SMS addressed to all emergency contacts at once (iOS `,` / Android `;` recipient separator); per-contact links kept as fallback for SMS apps that drop group recipients
- **Emergency contacts capped at 2** — user decision: more recipients = noise; add button hides at limit, group SMS never exceeds 2 even with legacy data
- **Legal evidence tips** — "哪些能作为证据？" collapsible in evidence capture view: police records/告诫书, injury photo guidance, chat record originals, audio/video tips, witness & 妇联 records (static bilingual copy, per DAIS/VictimsVoice competitive research)
- **Default language is now Chinese** — new users see 中文 first; saved language preference still respected; 中/EN toggle unchanged
- **Fix: black screen on LAN http:// access** — Privy embedded-wallet iframe crashed the app outside secure contexts; now falls back to local auth (D-013)

## Product scope decisions (2026-07-02, from market research review)
- Product is defined by the three-pillar promise: SOS to trusted contacts / encrypted evidence / psych+legal resource connection
- **P2P chat will NOT be a product feature** (not in the promise; Gun.js "E2E" claim was inaccurate)
- Evidence key backup/recovery deferred — evidence architecture (blockchain vs TSA vs self-hosted) still under discussion
- Features rejected for launch to keep maintenance low: continuous location tracking, GPS live-streaming, lock-screen trigger (impossible in web app), voice readout

---

## v2.0 (2024–2025)

### Added
- **ChainMaker (长安链) evidence anchoring** — REST API + deterministic simulation fallback
- **SMS SOS** — 5s hold triggers native `sms:` URI with bilingual message + GPS coordinates
- **Emergency contacts management** — add/remove contacts stored in localStorage
- **Editable SOS message template** — `{位置}` placeholder replaced with GPS coords at trigger
- **Anonymous help request flow** — 5-step wizard (type → location → support → matching → session)
- **P2P support chat** — Gun.js encrypted-style chat rooms, 2-hour TTL
- **NGO directory** — browse, filter by type/location; Supabase `ngo_applications`
- **NGO apply tab** — NGOs can submit directory listing applications
- **Post-SOS NGO suggestion sheet** — top 3 relevant organisations after "I'm Safe"
- **Evidence vault hub** — 3 sub-sections (upload, report notes, history)
- **Evidence as second bottom-nav tab** (promoted from buried flow)
- **Mental Health tab (心理援助)** — replaces old Map tab in nav
- **Legal Aid tab (法律援助)** — replaces old Community tab in nav
- **Supabase evidence storage** — vault records, feedback submissions
- **Password login** — bcrypt hash stored in localStorage, no server required
- **Settings widget** — logout + account info
- **Feedback widget** — submission via Supabase
- **Donation widget** — external donation links
- **Deterrent audio panel** — configurable voice deterrent for SOS
- **Gaode maps integration** — GCJ-02 coordinate conversion for accurate map pin
- **GPS pre-warming** — location acquired on button press start for accuracy at trigger
- **SOS location block** — enriched with accuracy, Gaode nav link, battery, network info
- **Silent mode** — SOS without audible alert
- **Dual deployment** — Vercel (primary) + Tencent CloudBase COS (China mirror)
- **GitHub Actions CI** — auto-deploy to CloudBase on push to `main`

### Changed
- Bottom nav tabs: Help / Evidence / Mental Health / Legal Aid (from Help / Map / Support / DAO)
- Auth: email OTP + wallet → email + local bcrypt password (no wallet required)
- Identity: Privy-only → local ZKP commitment scheme (Privy OTP optional)
- Evidence anchoring: Solana Memo → ChainMaker 长安链 testnet

### Removed
- **All cryptocurrency dependencies** — Phantom wallet, Solana, all blockchain wallet flows
- **DAO governance layer** — replaced by verified NGO directory
- **MagicBlock TEE** — removed with DAO
- **Solana program** (`programs/the_unmuted_program/`) — kept in repo but unused
- **Map tab from bottom nav** — Map/Community tabs removed from primary navigation
- **事后存证 card** from SOSPage home view
- **社区陪伴支持 card** from SOSPage home view

---

## v1.0 (2024)

### Added
- Initial bilingual React SPA
- Privy email OTP login
- Phantom wallet integration
- Solana Memo evidence anchoring (Devnet)
- DAO governance proposals + MagicBlock TEE
- Basic SOS button (3s hold → blockchain tx)
- Map with warning zones
- Support / Community tab
- NGO directory (static)
- P2P encrypted chat (Gun.js)
- Arweave evidence upload
- AES-256-GCM local file encryption
