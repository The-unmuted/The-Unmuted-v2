# Technical Decisions — The Unmuted (非默)

## D-001 — Remove all crypto/blockchain wallet dependencies (v2.0)

**Decision:** Strip Phantom wallet, Solana, and all crypto-wallet flows.

**Reasoning:** Mainland China compliance. Crypto wallets are inaccessible or illegal for end users in China. Target users cannot be expected to have or use them. The original v1.0 design created a hard barrier to the primary audience.

**Result:** Email-only auth; no wallet prompt anywhere in the app.

---

## D-002 — ChainMaker (长安链) for evidence anchoring

**Decision:** Replace Solana Memo with ChainMaker testnet for on-chain evidence hashes.

**Reasoning:** ChainMaker is China's judicial alliance blockchain, court-admissible and government-endorsed. Evidence hashes anchored there have legal standing in Chinese courts. No certificate or browser extension required from the user — auth is server-side with API key.

**Trade-off:** ChainMaker BaaS REST API may have CORS restrictions when called directly from browser. Production path needs a Vercel Serverless Function proxy with server-side API key.

---

## D-003 — Deterministic simulation fallback for ChainMaker

**Decision:** When `VITE_CHAINMAKER_API_KEY` is not set, `anchorOnChain()` returns a deterministic simulated result instead of erroring.

**Reasoning:** Enables full demo flow without ChainMaker testnet credentials. Reviewers can test the complete evidence pipeline. `isSimulated: true` flag is preserved on the vault record so it's always auditable.

---

## D-004 — localStorage-only for sensitive user data

**Decision:** Emergency contacts, ZKP identity, password hash, vault records, and SOS message template are all stored in device localStorage only. No server upload.

**Reasoning:** Privacy first. Server-side storage of emergency contact phone numbers creates a surveillance risk for an adversarial actor (abusive partner, state). Phone numbers never leave the device.

**Trade-off:** Data is lost if the user clears browser storage or switches devices. Acceptable for the target use case — contacts can be re-entered.

---

## D-005 — Local bcrypt password instead of server-based auth

**Decision:** Password is hashed with bcryptjs and stored in localStorage. Privy email OTP is optional.

**Reasoning:** Removes dependency on an external auth service. Allows the app to function entirely offline or when Privy is unreachable. Lowers setup friction for survivors who need immediate access.

**Trade-off:** Password reset is impossible without email OTP. If both are lost, the user must create a new account.

---

## D-006 — Fuzzy location for help requests (~11km grid)

**Decision:** GPS coordinates in community help requests are rounded to ~0.1° (~11km) before broadcast.

**Reasoning:** Precise GPS coordinates sent over Gun.js would de-anonymise the requester's home address. 11km grid is enough to match nearby supporters without pinpointing the individual.

---

## D-007 — Gun.js for P2P chat (demo-grade)

**Decision:** Gun.js used for support chat room broadcast.

**Reasoning:** Gun.js is dependency-free, works without a dedicated server, and provides enough for a demo. Fast to implement with no infrastructure cost.

**Known limitation:** Gun.js is not true E2E encrypted — messages are broadcast across Gun's relay network. In production, a proper encrypted channel (e.g., Signal Protocol, Matrix) should replace this. The UI states "end-to-end encrypted" as a design intent, not a current technical fact.

---

## D-008 — Dual deployment (Vercel + Tencent CloudBase)

**Decision:** Deploy to both Vercel and Tencent CloudBase COS.

**Reasoning:** Vercel may be inaccessible from mainland China due to DNS/CDN blocks. Tencent CloudBase serves users behind the Great Firewall reliably. Vercel remains the primary international URL.

---

## D-009 — Inline bilingual copy instead of i18n library

**Decision:** All UI copy is inlined via `copyFor(language, english, chinese)` — no i18n library.

**Reasoning:** The app supports exactly two languages (EN/ZH). An i18n library adds bundle size and extraction complexity for no benefit at this scale. Co-located copy is easier to review and edit when iterating quickly.

---

## D-010 — AES-256-GCM encryption entirely in-browser

**Decision:** Evidence files are encrypted with Web Crypto API before any network call.

**Reasoning:** No plaintext evidence ever touches a network. Encrypted blob is uploaded to Arweave; hash is anchored on ChainMaker. The user holds the only decryption key (downloaded JSON bundle).

**Trade-off:** Key loss = permanent evidence loss. This is intentional — the app cannot be compelled to produce evidence it cannot decrypt.

---

## D-011 — ZKP identity as pseudo-anonymity (not true ZKP)

**Decision:** `zkpIdentity.ts` uses SHA-256 hashing to create a commitment + nullifier, not a true zero-knowledge proof circuit.

**Reasoning:** A true ZKP circuit (e.g., Groth16) would require a circuit compiler and trusted setup, overkill for the current stage. The current scheme provides pseudonymity (email is never transmitted) while being fast and dependency-free.

**Upgrade path:** Replace with a proper ZKP library (e.g., snarkjs) if Sybil resistance or verifiable credentials become a requirement.

---

## D-012 — Two-stage login strategy: email now, phone OTP at formal mainland launch (2026-07-03)

**Decision:** Soft launch (web, hackathon, early users) ships with email + local bcrypt password (+ Privy email OTP over HTTPS). Phone-number SMS login is deferred to the formal mainland launch track.

**Reasoning:**
- SMS verification codes in mainland China require an enterprise entity + SMS signature filing (腾讯云短信签名备案); WeChat login requires 微信开放平台 enterprise verification. Neither is possible without a registered company, so phone/WeChat login cannot be built today regardless of preference.
- Formal mainland launch (app filing, possible UGC features) will require real-name registration under 《网络安全法》, and Chinese user habit is SMS code or WeChat login — so phone OTP becomes mandatory at that stage.
- WeChat login will be optional, never the only entry: it binds identity to a WeChat account, which is a concern for some survivors.

**Key principle — "实名的是账号，加密的是内容":** even after real-name login is added, the phone number is used for verification only and stored encrypted/isolated server-side. Evidence, emergency contacts, and passwords remain client-side encrypted (localStorage). The server can verify who logged in but can never decrypt what they stored. This keeps D-004 intact under real-name compliance.

**Formal launch track (ordered):** company entity → ICP 备案 → app 备案 → Tencent SMS signature → phone OTP login → (optional) WeChat login.

---

## D-013 — Privy disabled outside secure contexts (2026-07-03)

**Decision:** `PrivyAuthProvider` falls back to local-only auth when `window.isSecureContext` is false.

**Reasoning:** Privy's SDK mounts an embedded-wallet iframe that throws "Embedded wallet is only available over HTTPS" outside secure contexts (e.g. LAN http:// device testing), crashing the entire React tree to a black screen. localhost and HTTPS production are unaffected.

---

## D-014 — Evidence anchoring: reject Aleo (both hash-on-chain and key-on-chain); TSA trusted timestamp is the target path (2026-07-06)

**Context:** A ZKP advisor proposed (a) anchoring evidence hashes on the Aleo privacy chain, and (b) storing the AES decryption key as a private Aleo record so the owner can always retrieve it. Both were evaluated and rejected.

**Decision:** No Aleo (or any overseas public chain) in the evidence pipeline. Target anchoring path remains 联合信任 TSA (tsa.cn, RFC 3161) as primary anchor, with OpenTimestamps (free, token-less Bitcoin anchoring) as an optional supplementary international anchor.

**Reasoning — hash on Aleo:**
1. **Zero judicial recognition:** the verification audience is a mainland Chinese judge. Courts recognize TSA timestamps, 人民法院司法链, notarization, and domestically filed 存证 platforms. A foreign privacy chain (mainnet 2024) has no acceptance precedent in Chinese judgments.
2. **Compliance is a hard blocker, not a TODO:** any fiat→ALEO conversion service (even "official partnership", even gas sponsorship where *the company* holds/spends tokens) falls under the PBOC 9·24 (2021) prohibition on fiat–crypto exchange. It would also jeopardize the entire formal launch track (company entity → ICP → app 备案), and violates D-001.
3. **Privacy chain solves a non-problem:** a SHA-256 hash already reveals nothing; hiding it in a private record is redundant. Worse, evidence timestamps need to be *publicly verifiable* — a private record adds ZK-proof friction at exactly the moment (举证) where simplicity matters.
4. **Reachability & longevity:** Aleo RPC/explorers are not reliably reachable from mainland China (same failure mode as Arweave); evidence horizons are 5–10 years, TSA/公证处 have state-backed longevity.
5. **Architecture correction (independent of chain choice):** the hash must be computed client-side at capture/encryption time, never "returned by the cloud" — otherwise a tampering window opens between capture and fixation.

**Reasoning — decryption key as Aleo record:** key management is relocated, not solved. "Record owner retrieves the key" requires the user to safeguard an Aleo account private key — still a root secret that, if lost, loses everything, but now with worse usability (wallet UX, GFW-blocked nodes, gas). The master-key + paper recovery code design achieves the same recoverability with no new dependencies and no crypto exposure.

---

## D-015 — ZKP-based user screening ("prove I'm a survivor without revealing identity"): not for launch (2026-07-06)

**Decision:** Do not build ZKP-based qualification/screening for launch. Filed as a post-launch idea in one narrow form only (see below).

**Reasoning:**
1. **Oracle problem:** ZKP proves possession of a credential, not the truth behind it. Proving "I am a survivor" requires a trusted issuer of digitally verifiable victim credentials (告诫书/保护令 as signed digital documents) — no such system exists in China. Without an issuer there is nothing to prove.
2. **Self-attested substitutes don't screen:** proving properties of one's own vault ("≥3 evidence records older than 30 days") is trivially gamed by storing junk files.
3. **It does not cure the reason the alert map was cut:** ZKP mitigates Sybil attacks (mass fake accounts), but a fully verified real user can still post a false danger alert. Fake-alert risk is a content-trust problem, out of ZKP's reach — the original decision to remove the alert map stands.

**Narrow viable form (post-launch, if anonymous reporting/mutual aid is ever revisited):** phone-OTP-anchored anonymous membership with rate limiting (Semaphore-style: one phone number = one anonymous identity, N posts/day, bannable without deanonymization). Note this requires **no blockchain** — a server-published Merkle root suffices. ZKP ≠ chain.

**Status vs three pillars:** anonymous mutual aid is outside the three-pillar launch scope; per the minimalism principle the default answer remains no.

---

## D-016 — Managed cloud storage only; no self-hosted servers (2026-07-06)

**Context:** An engineer friend suggested replacing Supabase with a self-built server.

**Decision:** Evidence ciphertext and encrypted metadata stay on managed cloud — Supabase now, migrate to Tencent Cloud (COS + cloud functions) at formal mainland launch. No self-hosted/raw VPS at any stage.

**Reasoning:**
1. **The server is untrusted by design.** Confidentiality comes from client-side AES-256-GCM + the key hierarchy (D-017), not from owning the machine. A breach or subpoena yields only ciphertext regardless of who runs the box. "Own your data" is achieved by E2E encryption, not by self-hosting.
2. **Durability is the thing we cannot afford to lose.** Evidence horizons are 5–10 years. Managed object storage is multi-replicated; a self-run VPS makes us responsible for backups, and a dead disk = lost evidence.
3. **Ops burden violates the minimalism principle** (7×24 patching, DDoS, monitoring for a small team). Small-team self-hosted servers are also the most commonly breached targets.
4. **Legal neutrality:** third-party-platform storage reads better under 民诉证据规定第94条 than "the app company's own server".
5. **Compliance path is identical:** a domestic self-hosted box needs ICP filing just like Tencent Cloud does.

**Lock-in mitigation:** keep the storage abstraction layer (`arweaveService.ts` interface) so the backend swap (Supabase → COS) touches one file; maintain periodic export capability. Server-side code is limited to thin serverless functions (future TSA proxy, phone OTP) — not standing servers.

---

## D-017 — Key hierarchy: one recovery code per user, master key wraps all per-file keys (2026-07-06)

**Decision:** Replace the per-file downloadable JSON key bundle with a three-tier hierarchy:

```
Recovery code (12 chars, written on paper, ONE per user, permanent)
   │ derives (Argon2/PBKDF2)
   ▼
Master key (one per user, random, never leaves device in plaintext)
   │ wraps
   ▼
Per-file keys (random per evidence file) ──encrypt──▶ evidence blobs
```

- Master key is stored in the cloud **twice-wrapped**: once by a password-derived key (daily unlock), once by the recovery-code-derived key (device change / forgotten password).
- Per-file wrapped keys + the encrypted record index are stored in the cloud, bound to the account → cross-device recovery = login + recovery code.
- Upload flow requires zero key handling from the user; the recovery code is shown once at setup and never again.
- Legacy per-file JSON bundles remain decryptable (read-only path) — no forced migration for demo-era data.

**Trade-off (intentional):** losing both password and recovery code = permanent evidence loss. The server can never decrypt anything; this preserves D-004/D-010 zero-knowledge guarantees under real-name login (D-012: "实名的是账号，加密的是内容").

**Rejected alternative:** storing keys as Aleo private records (see D-014) — relocates the root-secret problem to a wallet key with worse usability, GFW-blocked access, and crypto compliance exposure.

### D-017 附录 — 密钥与存储答疑(2026-07-06 与 Katie 逐条确认,重新讨论前先读这里)

**Q1: 恢复码是每次上传一个,还是一人一个?**
一人一个,管所有文件(过去和未来的)。每次上传自动生成的文件密钥由主密钥包裹,用户全程无感。

**Q2: 恢复码会存到 Supabase 吗?我们能帮用户找回吗?**
不会,也不能。云端存的是"被恢复码派生密钥加密后的主密钥"(打不开的保险箱),恢复码明文只存在于用户抄写的纸上。我们若能找回 = 传票/泄露就能解开所有用户证据 = Aspire News 的死法。**我们保管箱子,但永远打不开箱子。**

**Q3: 登录密码和恢复码绑定吗?**
不绑定。是同一间房的两扇独立的门:主密钥随机生成,分别被密码派生钥匙和恢复码派生钥匙各加密一份存云端。改密码不影响恢复码,换恢复码不影响密码。

**Q4: 丢了会怎样?**
- 只忘密码:邮箱重置账号 → 恢复码解锁数据 → 设新密码 ✅
- 只丢恢复码:密码解出主密钥 → 生成新恢复码 ✅
- **两个都丢:证据永久丢失,任何人都救不了 ❌**(刻意取舍——"任何人都拿不走你的证据"的另一面)
- 注意:邮箱重置只恢复"能否登录",不恢复"能否解密"(否则黑掉邮箱=拿到全部证据)。

**Q5: 别人知道了登录密码怎么办?**
密码单独就是完整钥匙——知道密码的人能解密一切、能重新生成恢复码。防护:① 文案告知"两个码都不能告诉任何人,包括伴侣家人;不要用生日等施暴者猜得到的密码";② 新设备登录需邮箱验证码 + 登录/恢复码变更邮件提醒;③ 当面胁迫无法用密码学防御,靠删除冷静期缓解。

**Q6: 密文是什么?和哈希什么关系?**
密文 = 整个文件加密后的完整数据(50MB 视频≈50MB 密文),有密钥可还原出逐比特一致的原件——负责"拿得回来"。哈希 = 32 字节指纹,永不可还原——负责"证明没改过"。举证时:取回密文 → 解密 → 重算哈希 → 与时间戳比对。

**Q7: 私密文件正式版存在哪?**
密文存云端(现 Supabase 私有桶+RLS;正式大陆上线迁腾讯云 COS,见 D-016)。明文只在用户设备上、只在拍摄和举证解密的瞬间存在。主密钥明文从不落盘、从不上云。紧急联系人/SOS 模板仍仅 localStorage(D-004)。

**Q8: 手机上的文件被删了,证据不就没了?**
不会——密文在云端,新手机登录+恢复码即可全部取回;App 内拍摄的证据明文根本不进相册,施暴者翻手机看不到。真正的两个例外:① 尚未上传完成的记录(对策:激进补传 + 每条记录显示"已同步云端/待上传"状态);② 微信聊天记录法庭要原始载体,我们的截图只是辅助证据(文案已如实告知"勿删原始对话")。

**Q9: Supabase 大陆延迟?要国内服务器吗?**
跨境 200–500ms 且不稳定,但 SOS 完全不依赖云,上传有本地降级。开发期留 Supabase,正式上线迁腾讯云(同 CloudBase 一个账号一条备案线),不用阿里云,不自建(D-016)。

---

## D-018 — Two-layer auth: email OTP for the account, password stays on-device for the data (2026-07-06)

**Decision:** Split "can you log in?" from "can you decrypt?" into two independent layers:

| Layer | Secret | Enforced by | Resettable? |
|---|---|---|---|
| Account access | 6-digit email OTP (Supabase `signInWithOtp`) | Server | Yes — anyone with the inbox |
| Data access | Login password / paper recovery code (D-017) | Client-side crypto only | Password yes (via recovery code); both lost = permanent |

- **The login password is NEVER sent to any server.** It exists only to derive the KEK that opens the password box. A database breach or subpoena yields nothing decryptable; a hacked email account yields login but zero evidence.
- Sessions persist per device (`persistSession: true`) → the OTP is only needed on NEW devices, making "new device requires the email inbox" a server-enforced guarantee rather than an app-side speed bump.
- Every page load still requires the password (master key lives only in memory) — an abuser picking up a logged-in phone cannot open records.
- Offline/no-env fallback: legacy local bcrypt path remains (D-013 pattern) so dev builds work; it cannot use the cloud vault.

**Also decided (same session):** the fake ChainMaker "anchoring" step was removed from the new evidence pipeline entirely — new records store only real facts (hashes, sync status, dual timestamps). Legacy demo records keep their simulated chain fields, displayed under "旧版记录". Honest copy per the Aspire News lesson: never claim security that doesn't exist.

---

## D-019 — Honest capture grading: 现场取证 vs 事后导入 (2026-07-07)

**Decision:** Every evidence record carries a capture grade shown to the user and stored (plaintext column, usable for future court-export weighting):

| Path | Grade | Rule |
|---|---|---|
| In-app audio recording (MediaRecorder) | 1 现场取证 | Always — the file cannot pre-exist |
| 拍照/录像 buttons (`<input capture>`) | 1 or 2 | File's own `lastModified` ≤ 2 min old → 1, else 2 |
| Explicit 导入已有文件 entry | 2 事后导入 | Always, even if the file is fresh |

**Why the freshness heuristic:** `capture="environment"` opens the camera on mobile but is silently ignored on desktop, and mobile users can switch to the gallery mid-flow. The file's own timestamp exposes that honestly — we grade what we can verify, not what the button implied. Never overclaim (Aspire News lesson) applies to evidence strength too: a mislabeled "live" record could be discredited in court and take the user's whole vault's credibility with it.

**Location policy:** GCJ-02 coordinates (pre-warmed on entering the capture view, SOS-button pattern) attach to grade-1 records only — where the user is when *importing* is not where the evidence happened. Precise coordinates are permitted because they go into the sealed metadata (ciphertext in the cloud); the ~0.1° rounding rule continues to apply to anything broadcast.

**Metadata schema (all sealed):** `capturedAt` (device clock), `location {lat,lng,accuracy,system:"GCJ-02"}`, `deviceInfo` (full UA). Plaintext columns stay minimal: hashes, grade, client/server timestamps — exactly what retroactive TSA anchoring (补锚定) needs.

---

## D-020 — Court package = plain ZIP + self-contained bilingual HTML, verifiable without 非默 (2026-07-08)

**Decision:** The Phase-3 举证 export is a plain ZIP containing the decrypted original file (under `证据文件/`) and one self-contained `举证说明.html` — no proprietary formats, no app dependency, no server round-trip. Built client-side with fflate.

**Why this shape:**
- **Survivable evidence.** The package must remain usable if the app is taken down, the company never materialises, or the user can no longer install anything. SHA-256 verification instructions use only OS-built-in tools (`certutil` on Windows, `shasum` on macOS/Linux), with the expected value printed next to the command.
- **Court-facing, not tech-facing.** The HTML explains capture grade (现场取证/事后导入) in plain language, shows dual timestamps (device + server clocks) honestly, and includes per-scenario guidance (保护令 / 离婚诉讼 / 报警立案) plus the 12348/12338 hotlines — so the package is also a "what do I do with this" guide.
- **Honesty rules carry over (Aspire News lesson):** the HTML says fingerprints were *locally fixed at capture time* and TSA is 接入中; it never says 绝对安全 or 区块链. Unit tests enforce these as assertions.
- **User-controlled fields are HTML-escaped** (file name, note, device info) — a malicious file name must not become script in the court document.

**Known trade-off:** Chinese entry names use the ZIP UTF-8 flag (0x800, set by fflate). Windows 10+, macOS Finder, and `ditto` extract correctly; only the legacy Info-ZIP CLI `unzip` (6.0) fails. Accepted — target users extract via Finder/Explorer, and Chinese names (`举证说明.html`, `证据文件/`) matter more for a court audience than CLI compatibility.

**Naming:** `举证包_YYYY-MM-DD_<txId前6位>.zip` — date for the user, short ID for matching back to the cloud record.

---

## D-021 — 非默不是"家暴专用"App：文案与法律指引必须覆盖性侵、骚扰等所有侵害情形 (2026-07-08)

**Decision (user directive):** The Unmuted 的核心是"帮助用户加密存储私密信息，并在未来有需要的时候能够作为有效证据进行举证"。用户群体包括遭受性侵害、骚扰跟踪及其他侵害的女性，不仅是家暴受害者。所有用户可见文案（App 内 + 举证包 HTML）不得默认"家暴 + 婚姻"框架。

**Rules for copy:**
- 报警与立案 is the universal first scenario — every survivor can use it. Sexual-assault-specific advice (report promptly, forensic exam, don't wash self/clothing beforehand) belongs there.
- 人身安全保护令 applies to family members AND intimate relationships (同居、恋爱) — say 不需要先起诉离婚、不限于婚姻关系; never present it as the default path for everyone.
- Litigation guidance covers 刑事、民事赔偿、离婚诉讼 — divorce is one case, not the frame.
- DV-specific instruments (告诫书, 反家暴法) stay, but labelled as applying 属于家庭暴力的.

**Applied 2026-07-08:** 举证说明.html 场景指引 restructured; LegalTipsDisclosure first tip broadened.

---

## D-022 — 72h 删除冷静期，且"可恢复"这一事实必须对旁观者不可见（防胁迫删除）(2026-07-09)

**Decision (user directive):** Evidence deletion is a 72-hour soft delete, but the delete path must **look final**. No 回收站 / "3 天内可恢复" wording anywhere on the delete flow — success shows only 「已删除。」. Recovery lives behind an inconspicuous grey line at the very bottom of the records list（「找回误删的记录」）which requires **re-entering the vault password** before anything is shown.

**Why the stealth requirement (user's words):** 施暴者可能胁迫她当面删除证据。如果界面透露"还能恢复"，施暴者发现后可能引发二次施暴。So the coerced "delete" must convincingly look permanent to an onlooker, while the owner can quietly restore within 72h.

**Mechanics:**
- `evidence_records.deleted_at` (already in migration 0001) marks the soft delete; `listEvidence` filters it out; local index entry + cached blob are removed immediately so nothing shows on-device.
- Purge is client-triggered: `purgeExpiredEvidence` runs on records-view open and before listing deleted records; removes storage object + row once `deleted_at` is ≥72h old. No server cron (no entity yet) — worst case a record lingers in ciphertext until the next visit, which is acceptable.
- Recovery view (`最近删除`) requires a fresh `unlockWithPassword` even in an unlocked session, lists deleted records with 「约 N 天/小时后彻底清除」, one-tap 恢复 (`deleted_at = null`).
- Pending (never-uploaded) records are still deleted outright — there is no cloud copy to recover.

**Trade-off accepted:** a survivor who genuinely wants data gone immediately cannot force-purge from the UI; 72h is the anti-coercion price. The password gate means an abuser who saw the grey line but doesn't know the vault password still cannot confirm anything was ever deleted.

## D-023 — 解锁密码容忍首尾空白（trim 重试 + 创建时 trim）(2026-07-10)

**Decision:** `unlockWithPassword` tries the raw password first, then retries with `password.trim()` if it differs; new passwords are trimmed at creation (set-password and recovery re-wrap) so the stored wrap never contains stray edge whitespace.

**Why:** 2026-07-09 incident — a pasted password with a leading space failed to unlock and the toast-only error gave no clue. Survivors often paste passwords from notes apps; edge whitespace is invisible and the cost of a false "wrong password" here is a user believing their evidence is lost.

**Trade-off accepted:** passwords that *intentionally* differ only by edge whitespace become equivalent — a negligible loss of password space against PBKDF2-310k, vastly outweighed by the lockout-avoidance benefit. Interior whitespace is untouched.

## D-024 — 解锁页 ‼️ 求救入口（icon-only，仅本机有联系人时显示）(2026-07-11)

**Decision:** The unlock/login screen shows a discreet SOS entry — a bare ‼️ icon in the bottom-right corner, no text. Tapping it opens a full-screen overlay with the standard hold-2s SOS button. Rendered only when this device already has emergency contacts in localStorage.

**Why:** Katie's 2026-07-10 friction feedback — an emergency must not wait behind email OTP + vault password. SOS never needed the account or the vault (contacts + sound settings are localStorage-only), so the login wall was blocking it artificially. The icon-only form is Katie's own call (2026-07-11): 「可以不用写成紧急求救，而是设置成这个‼️图标」.

**Disguise trade-off, and how it's contained:**
- No text like 紧急求救 on the wall — a bare ‼️ is ambiguous to an onlooker; the owner learns what it is once.
- Contacts-gated rendering: a fresh/stranger's device shows a plain login wall with nothing extra.
- Tap opens the hold button, never fires SMS directly — same 2s hold as in-app guards against accidental/pocket triggers.
- No contact names/numbers are rendered pre-auth.

**Mechanics:** new `UnlockSOSEntry.tsx` mounted in `LoginFlow`; reuses `SOSButton` unmodified (validated code untouched) with `useSilentMode` settings from localStorage.

## D-025 — 云端保险柜逐条操作需重输密码（解锁查看 / 导出举证包 / 删除）(2026-07-17)

**Decision:** Every per-record action in the Cloud Vault that decrypts or destroys evidence — 解锁查看, 导出举证包, and 删除 — requires a fresh password entry (`unlockWithPassword`) at the moment of the action. The list-level password gate stays as-is.

**Why:** Katie's 2026-07-17 feedback: after unlocking the records list, 解锁查看 worked with a single tap, which felt unsafe — the threat is a phone grabbed *while the list is already unlocked* (abuser reads plaintext evidence, exports it, or deletes it). The session master key in memory made decryption invisible; correct cryptographically, but the UX gave no barrier at the sensitive moment. Delete included at Katie's explicit choice (defense-in-depth on top of the D-022 72h recovery).

**Trade-off accepted:** one extra password entry per view/export/delete. For evidence access this friction is the point; capture/upload flows are untouched, so recording in an emergency stays friction-free.

**Mechanics:** inline password prompt inside the record card (`CloudVaultHistory` in `EvidencePage.tsx`), replacing the old two-button delete confirm — typing the password *is* the confirmation. Same inline error copy as the page gate (wrong-secret vs vault-unavailable, D-023 trim tolerance applies). D-022 invariant preserved: delete still looks final; no recovery hint on the delete path.
