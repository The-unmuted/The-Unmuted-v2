# Architecture — The Unmuted (非默)

## Overview

Single-Page Application (SPA) built with React 18 + TypeScript + Vite. Deployed to two hosts:
- **Primary:** Vercel (`https://the-unmuted.vercel.app/`)
- **Secondary:** Tencent CloudBase COS bucket (`ap-shanghai`, bucket `45b6-static-theunmuted-v2-...`)

CI/CD: GitHub Actions auto-deploys `main` to CloudBase; Vercel deploys via GitHub integration.

---

## Provider Tree (`src/App.tsx`)

```
QueryClientProvider (react-query)
  └── PrivyAuthProvider (email OTP, optional)
        └── LocaleProvider (EN/ZH toggle, persisted in localStorage)
              └── TooltipProvider (Radix UI)
                    └── BrowserRouter
                          ├── Route "/"  → <Index>
                          └── Route "*"  → <NotFound>
```

---

## Page Layout (`src/pages/Index.tsx`)

`Index` owns all top-level state: auth/unlock, active tab, language. The master key is memory-only (D-017), so **every page load starts locked** — `LoginFlow` shows until the vault is unlocked, even when a Supabase session persists.

```
<header>          — logo, brand banner, language toggle, FeedbackWidget, SettingsWidget (incl. 修改密码)
<LoginFlow>        — shown until account + vault are unlocked
  OR
<main>            — scrollable content area
  ├── SOSPage     (activeTab === "sos")
  ├── EvidencePage (activeTab === "evidence")
  ├── PsychPage   (activeTab === "psych")
  └── LegalPage   (activeTab === "legal")
<BottomNav>       — 4 tabs: Help / Evidence / Mental Health / Legal Aid
```

---

## Authentication (D-017 / D-018 — production track, 2026-07-06)

Two layers with different trust models:

| Layer | Mechanism | Enforced by | Resettable |
|-------|-----------|-------------|------------|
| **Account** (who you are) | Supabase Auth email OTP, 6-digit code (`authService.ts`) | Server | Yes (email OTP again) |
| **Data** (what you can decrypt) | Login password OR 12-char paper recovery code | Client-side crypto only | Only while one of the two still works |

Key hierarchy (`keyVault.ts` pure crypto, `keyVaultService.ts` Supabase-backed ops):

```
password ──PBKDF2-SHA256 310k──> KEK₁ ──AES-GCM──> wraps ┐
                                                          ├─ master key (memory-only, per session)
recovery code ──PBKDF2────────> KEK₂ ──AES-GCM──> wraps ┘        │
                                                                  └─ wraps every per-file key (sealJson)
```

- Wrapped master-key boxes live in the `key_vaults` table; the **password itself never leaves the device**.
- Persistent Supabase session per device → OTP only on new devices; but the master key is memory-only, so every page load requires the password.
- Losing both password and recovery code = permanent data loss (by design — the server cannot decrypt, even under compulsion).
- Recovery code is displayed exactly once at signup and never stored.
- Legacy: `useZKPIdentity` (localStorage commitment) still provides the local identity object; bcrypt local passwords remain only for legacy accounts.

---

## Evidence Vault Pipeline (production, D-016/D-017)

Orchestrated by `useEvidenceVault.ts` → `evidenceVaultService.ts`. Cloud sees ciphertext only.

```
User picks file
  → encryptFile()            [AES-256-GCM local; fresh key per file; SHA-256 of plaintext + ciphertext]
  → sealJson(masterKey, …)   [wrap file key + metadata with session master key]
  → cacheBlob()              [IndexedDB ciphertext cache — offline + fast re-open]
  → pushRecord()             [ciphertext → private bucket evidence-vault/{userId}/{txId} (RLS)
                              record → evidence_records (wrapped key, sealed meta, hashes,
                              capture grade, client_time + server created_at)]
  → on failure: pending queue (localStorage, ciphertext only) → auto-retry on `online` event
```

Reading back: `listEvidence()` (cloud index first, mirrored locally for offline) → `openEvidenceFile()` (cache→cloud download, ciphertext SHA-256 integrity check, unwrap file key, `decryptFile()`).

Delete is soft (`deleted_at`); 72h cooling-off UI planned (Phase 4).

No key-file downloads anymore. Legacy records (localStorage + user-held JSON key bundles) are listed read-only under 旧版记录. The old Arweave/public-bucket path (`arweaveService.ts`) was deleted 2026-07-06. ChainMaker anchoring is not part of the new pipeline (honest UI: hash locally fixed, trusted timestamping 接入中 — gated on company entity for TSA access).

Schema: `supabase/migrations/0001_key_vault_and_evidence.sql` (key_vaults, evidence_records, private bucket + per-user RLS).

---

## SOS Flow (`src/components/SOSPage.tsx`)

Single path on the Help tab (the anonymous help-request wizard, P2P chat, and 预警地图 were removed 2026-07-09, Phase 4b — no chat feature by product scope):

`SOSButton` component: 5s hold → acquires GPS → opens native `sms:` URI with pre-filled bilingual message + coordinates. The page also hosts `EmergencyContactsCard` (max 2 contacts, localStorage) and `SosMessageCard` (editable SMS template).

After "I'm Safe" → `NGOSuggestionSheet` appears with top 3 relevant NGOs.

---

## NGO Directory (`src/components/NGOPage.tsx`)

- Data source: Supabase table `ngo_applications` (read for directory, write for new applications)
- Fallback: 5 hardcoded seed organisations if Supabase is unreachable
- Filter: service type + location text search

---

## Internationalization (`src/lib/locale.tsx`)

`copyFor(language, english, chinese)` used inline everywhere. Language persisted to `localStorage["the-unmuted-language"]`. No i18n library — all copy is co-located with JSX.

---

## Module Map

```
src/
├── App.tsx                 — providers + router
├── pages/
│   └── Index.tsx           — auth state, header, tab routing
├── components/
│   ├── SOSPage.tsx         — SOS button + emergency contacts + SMS template
│   ├── SOSButton.tsx       — physical hold button + SMS trigger
│   ├── LoginFlow.tsx       — email OTP + password / recovery-code unlock
│   ├── EvidencePage.tsx    — evidence hub (upload, report notes, cloud + legacy history)
│   ├── PsychPage.tsx       — mental health resources (renders AidResourceList)
│   ├── LegalPage.tsx       — legal aid resources (renders AidResourceList)
│   ├── AidResourceList.tsx — shared directory renderer: city filter chips + verified-date cards
│   ├── NGOPage.tsx         — NGO directory + post-SOS suggestion sheet
│   ├── BottomNav.tsx       — 4-tab navigation
│   ├── FeedbackWidget.tsx  — feedback submission (Supabase)
│   ├── SettingsWidget.tsx  — logout, change password, language
│   ├── DeterrentAudioPanel.tsx — deterrent audio playback
│   └── ui/                 — shadcn/ui components
├── hooks/
│   ├── useEvidenceVault.ts — production evidence pipeline state (encrypt → cloud vault)
│   ├── useZKPIdentity.ts   — identity management
│   ├── useEmergencyContacts.ts — localStorage contacts CRUD
│   ├── useSosMessage.ts    — editable SOS SMS template
│   ├── useSilentMode.ts    — silent mode toggle
│   └── useOfflineBuffer.ts — offline queue
└── lib/
    ├── supabaseClient.ts   — single shared Supabase client (all modules import this)
    ├── authService.ts      — Supabase email OTP (account layer, D-018)
    ├── keyVault.ts         — D-017 crypto: KEK derivation, master-key wrap, sealJson/openJson
    ├── keyVaultService.ts  — cloud key vault ops + in-memory session master key
    ├── evidenceVaultService.ts — private bucket + encrypted index + pending queue
    ├── evidenceCrypto.ts   — AES-256-GCM encrypt/decrypt + hashes
    ├── chainmakerService.ts — ChainMaker REST + simulation fallback (legacy path)
    ├── localStorage.ts     — legacy vault record persistence (read-only)
    ├── aidDirectory.ts     — typed loader/filters for src/data/aidDirectory.json (D-026)
    ├── locale.tsx          — EN/ZH copyFor utility
    ├── privyAuth.tsx       — Privy OTP email auth (legacy, superseded by Supabase)
    ├── zkpIdentity.ts      — pseudo-ZKP commitment scheme
    ├── geoAlert.ts         — geo alert record helpers (localStorage only; SOSButton imports)
    ├── ngoService.ts       — NGO data access
    ├── userCredentials.ts  — bcrypt password hash helpers
    └── reportNotesVault.ts — encrypted report notes storage
```

---

## Deployment Architecture

```
GitHub push → main
  ├── GitHub Actions (dd73d70) → deploy-cloudbase.mjs → Tencent COS
  └── Vercel GitHub integration → vercel.json → Vercel Edge Network
```

`vercel.json` rewrites all paths to `index.html` for SPA routing.
