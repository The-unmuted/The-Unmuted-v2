# The Unmuted v2.0 | 非默 v2.0

> *Make truth indelible; ensure no survivor stands alone.*  
> *让真相不被抹去，让求助不再孤身一人。*

**The Unmuted v2.0** is a bilingual, mobile-first safety app for survivors of domestic violence and gender-based harm — rebuilt for mainland China compliance. All cryptocurrency and wallet dependencies have been removed. Evidence is now anchored on ChainMaker (长安链), China's judicial alliance blockchain. Emergency SOS opens a pre-filled SMS to trusted contacts. The DAO governance layer has been replaced with a verified NGO directory so survivors can find real local help immediately.

**非默 v2.0** 是面向家暴及性别暴力受害者的双语移动端安全应用，本版本针对中国大陆合规性全面重构。所有加密货币与钱包依赖已移除，改为使用中国司法区块链联盟链（长安链）进行存证锚定，紧急 SOS 将向信任联系人发送预填内容的短信，DAO 治理层改为可信 NGO 机构目录，让求助者能第一时间找到真实本地支援资源。

---

## What Changed from v1.0 | v2.0 核心变更

| Area | v1.0 | v2.0 |
|------|------|------|
| Evidence anchoring | Solana Memo (Devnet) | ChainMaker 长安链 (testnet) |
| SOS trigger | 3s hold → blockchain tx | 5s hold → SMS to emergency contacts |
| Login | Email OTP + Phantom wallet | Email OTP only (no crypto) |
| Aid governance | DAO proposals + MagicBlock TEE | NGO directory: browse + apply |
| Bottom nav | Help / Map / Support / DAO | Help / Map / Support / NGOs |

---

## Current Demo | 当前版本

- **Bilingual UI:** English and Chinese switch with one button; the app shows one language at a time.
- **First-time signup:** Email OTP via Privy. No wallet required anywhere in the app.
- **Soft safety design:** Gentle purple interface, mark-only logo, and the banner "secure, record, protect, speak."
- **Bottom tabs:** Help, Map, Support, NGOs.
- **Map page:** Displays warning zones from reported help requests, color-graded by density.
- **Support page:** Supporter workflow for nearby anonymous help requests, P2P encrypted chat.
- **NGO page:** Browse verified organisations by category; apply for directory listing; post-SOS suggestion sheet.

- **双语界面：** 中英文通过按钮切换，同一时间只展示一种语言。
- **首次注册：** 通过 Privy 邮箱 OTP 注册，全程无需钱包。
- **柔和安全视觉：** 紫色系为主，图形 Logo，保留 "secure, record, protect, speak / 安全，记录，守护，发声" 的品牌语义。
- **底部导航：** Help、Map、Support、NGOs。
- **地图页面：** 根据求助上报生成颜色分级预警区域。
- **支援页面：** 附近匿名求助的支援者流程，支持端到端加密聊天通道。
- **NGO 页面：** 按类别浏览认证机构；申请入驻目录；SOS 结束后显示推荐机构。

---

## Core Features | 核心功能

### 1. SOS Emergency Alert | SOS 紧急求助

- Hold the SOS button for **5 seconds** to trigger an alert.
- On trigger, the app acquires GPS coordinates and opens the native SMS app pre-filled with a bilingual help message and a Google Maps link.
- Emergency contacts (name + phone) are stored privately in device localStorage — no server involved.
- Multiple contacts are shown as tap-able links if the first SMS is sent.
- After the situation resolves, "I'm Safe" opens the NGO suggestion sheet.
- A no-contacts state prompts the user to add at least one contact before relying on SOS.

- 长按 SOS 按钮 **5 秒**触发求助。
- 触发后自动获取 GPS 坐标，打开系统短信应用，预填双语求助内容与 Google Maps 定位链接。
- 紧急联系人（姓名 + 电话）仅保存在设备本地 localStorage，不上传服务器。
- 如需联系多人，页面提供可点击的额外联系人链接。
- 情况解除后点击"我安全了"弹出 NGO 推荐卡片。
- 若尚未添加联系人，系统提示先完成设置再依赖 SOS 功能。

### 2. Map Alerts | 地图预警

- The Map page directly displays warning zones based on reported help requests.
- Reported help requests are grouped into map zones and visualised with colour-graded alert blocks.
- Purple and yellow are the main contrast colours, matching the product UI.
- Each alert zone shows a report count, making the level of reported need visible at a glance.
- The map supports drag, zoom, user location, and map-local scrolling.

- Map 页面直接展示基于求助上报生成的预警区域。
- 上报求助聚合为地图区域，通过颜色分级提示预警强度。
- 颜色以紫色和黄色作为主要对比，贴合产品 UI。
- 每个预警区域展示上报数量，让求助密度一眼可见。
- 地图支持拖动、缩放、用户定位和地图内部滚动。

### 3. Support | 互助支援

- Community members can opt in as supporters and watch nearby anonymous requests.
- SOS support alerts and community help requests are shown separately inside the support workflow.
- Supporters can open encrypted P2P-style chat rooms for follow-up.

- 社区成员可选择成为支援者，查看附近匿名求助。
- SOS 紧急支援与社区非紧急求助在支援流程中分开展示。
- 支援者可进入端到端加密风格的匿名聊天通道继续沟通。

### 4. Evidence Preservation | 安全存证

- Evidence capture is available after a help report.
- Photo, video, and audio evidence is encrypted locally with AES-256-GCM.
- Encrypted evidence is uploaded to an Arweave-style demo vault.
- Evidence hashes are anchored on **ChainMaker (长安链)**, China's judicial alliance blockchain.
  - If `VITE_CHAINMAKER_API_KEY` is set, a real REST call is made to the ChainMaker testnet.
  - Without a key, a deterministic simulation runs so the demo works for reviewers without infrastructure.
  - Explorer: `https://testnet.chainmaker.org.cn/explorer/tx/<txHash>`
- No wallet or browser extension required — ChainMaker uses certificate-based auth server-side.
- Users can download a local key bundle for later decryption.

- 存证功能可在求助上报后使用。
- 图片、视频和音频证据通过本地 AES-256-GCM 加密。
- 加密证据上传至演示版 Arweave 风格存证库。
- 证据哈希锚定至**长安链（ChainMaker）**——中国司法区块链联盟链。
  - 设置 `VITE_CHAINMAKER_API_KEY` 后，系统向长安链测试网发起真实 REST 调用。
  - 未设置密钥时以确定性模拟替代，方便评审无需基础设施即可体验完整流程。
  - 区块链浏览器：`https://testnet.chainmaker.org.cn/explorer/tx/<txHash>`
- 全程无需钱包或浏览器插件——长安链采用服务端证书认证。
- 用户可下载本地密钥包，方便后续解密。

### 5. NGO Directory | NGO 机构目录

- **Browse tab:** Filter by service type (Legal / Mental Health / Shelter / Hotline) and location text search. Each card shows organisation name, coverage area, phone, and website.
- **Apply tab:** NGOs and nonprofits can submit an application form. Submissions go to Supabase `ngo_applications` for admin review.
- **Post-SOS suggestion sheet:** After "I'm Safe", the app surfaces the top 3 relevant organisations based on help type, with direct contact buttons.
- Seed data includes 5 verified demo organisations covering major Chinese cities.

- **找机构 tab：** 按服务类型（法律援助 / 心理支援 / 庇护所 / 热线）和地区文本筛选。每张卡片展示机构名称、服务地区、电话及官网。
- **申请入驻 tab：** NGO 和非营利组织可提交申请表，数据提交至 Supabase `ngo_applications` 等待管理员审核。
- **SOS 后推荐：** 点击"我安全了"后，根据求助类型推荐最相关的 3 家机构，提供直接联系按钮。
- 内置 5 家覆盖中国主要城市的认证演示机构数据。

---

## Tech Stack | 技术栈

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS, shadcn/ui, lucide-react |
| Auth | Privy email OTP, local bcrypt password hash (localStorage) |
| Evidence chain | ChainMaker 长安链 testnet (REST API, cert-based, no wallet) |
| Storage | Arweave-style demo vault, Supabase (NGO directory), localStorage |
| Encryption | Web Crypto API, AES-256-GCM |
| P2P Demo | Gun.js for support / chat demo broadcasts |
| Map Alerts | OpenStreetMap tiles, local alert records, colour-graded zones |
| Emergency SOS | Native SMS via `sms:` URI scheme, GPS geolocation API |

---

## Getting Started | 运行

Live demo: **https://the-unmuted.vercel.app/**

```bash
npm install
npm run dev
```

---

## Environment Variables | 环境变量

Create `.env.local` for optional real-service integrations:

```bash
# Privy — enables real email OTP signup
VITE_PRIVY_APP_ID=your_privy_app_id

# Supabase — NGO directory (already configured in the demo)
VITE_SUPABASE_URL=https://iisjendxxmxpgwohckiq.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key

# ChainMaker — leave blank for demo simulation
VITE_CHAINMAKER_API_KEY=
```

Without `VITE_CHAINMAKER_API_KEY`, the evidence anchoring flow runs in deterministic simulation mode — reviewers can test the full flow with no infrastructure required.

不设置 `VITE_CHAINMAKER_API_KEY` 时，存证锚定流程以确定性模拟模式运行，无需基础设施即可体验完整流程。

---

## Demo Notes | Demo 说明

- All cryptocurrency dependencies have been removed. No Phantom, no Solana, no wallet prompt anywhere.
- The SMS SOS flow requires a mobile device; on desktop it opens the default mail/messaging client.
- Emergency contacts are stored only on-device (localStorage). No phone numbers are transmitted to any server.
- Evidence encryption keys are user-held. Losing the downloaded key bundle makes encrypted evidence unrecoverable.
- The NGO directory falls back to 5 hardcoded seed organisations if Supabase is unreachable.
- ChainMaker anchoring uses deterministic simulation if `VITE_CHAINMAKER_API_KEY` is not set.

- 所有加密货币依赖已完全移除，无 Phantom、无 Solana、无任何钱包提示。
- SMS SOS 流程需要移动设备；桌面端会打开系统默认短信或邮件客户端。
- 紧急联系人仅存储在设备本地（localStorage），电话号码不传输至任何服务器。
- 存证加密密钥由用户自持；正式版本中若遗失密钥，加密证据将无法恢复。
- NGO 目录在 Supabase 不可达时回退至 5 条硬编码演示数据。
- 未设置 `VITE_CHAINMAKER_API_KEY` 时，长安链锚定以确定性模拟运行。

---

## Team Members | 团队成员

- Gu Shi: https://github.com/hesta1218-collab
- Wendy Wu: https://github.com/DancinWendy
- Liz Wu: https://github.com/touhouzigei-crypto
- Katie Lin: https://github.com/katielin0207-dev
