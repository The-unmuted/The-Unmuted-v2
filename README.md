# The Unmuted | 非默

> Make truth harder to erase. Make seeking help easier to begin.  
> 让真相不被轻易抹去，让求助可以更早开始。

**The Unmuted** is a bilingual mobile personal safety tool designed for scenarios involving sexual harassment, stalking, sexual assault, coercion, domestic violence, and other gender-based harm."

This version focuses on individual emergency use: trusted-contact SOS, encrypted evidence saving, guided post-report notes, and fast access to mental health and legal aid resources.

**非默** 是一款面向性骚扰、跟踪、性侵、胁迫、家暴及其他性别伤害场景的双语移动端个人安全工具。

当前版本聚焦个人紧急使用：可信联系人 SOS、加密存证、事后记录指引，以及心理援助和法律援助资源入口。

---

## Live Demo | 在线演示

- Production: https://the-unmuted.vercel.app/

---

## Current Product Scope | 当前版本范围

### 1. Personal SOS | 个人紧急求助

- Users can add trusted emergency contacts.
- SOS opens the phone's native SMS flow with a pre-filled emergency message.
- The message can include location information when the user grants location permission.

- 用户可以添加可信紧急联系人。
- SOS 会打开系统短信，自动填入求助内容。
- 在用户授权定位后，求助内容可包含位置信息。

### 2. Evidence Vault | 加密存证

- Users can save photos, videos, audio, and written notes as evidence.
- Files are encrypted locally with AES-256-GCM before storage.
- Evidence records include hashes and timestamps for later verification.
- Evidence hashes can be anchored to ChainMaker (长安链) testnet when configured.
- Without ChainMaker credentials, the demo uses deterministic simulation so judges can test the full flow.

- 用户可以保存照片、视频、音频和文字记录作为证据。
- 文件在本机使用 AES-256-GCM 加密后再保存。
- 存证记录包含哈希和时间戳，方便后续核验。
- 配置长安链接口后，可将证据哈希锚定到 ChainMaker 测试网。
- 未配置长安链凭证时，演示版使用确定性模拟，方便评审完整体验流程。

### 3. Guided Report Notes | 事后记录指引

- The app provides different note prompts for situations such as memory gap, sexual assault, stalking, and unsafe dates.
- Notes can be encrypted and saved locally.
- The goal is to reduce panic and help users record important details before memory fades.

- 应用会根据记忆空白、性侵害、跟踪、约会风险等不同情况提供记录提示。
- 填写内容可加密保存在本机。
- 目标是在紧张状态下降低记录难度，帮助用户尽早保存关键细节。

### 4. Mental Health Support | 心理援助

- The Mental Health tab lists verified crisis hotline resources.
- Current cards focus on direct phone access, coverage area, hours, and location.

- 心理援助页面展示已核实的心理危机热线资源。
- 当前卡片重点展示电话、覆盖范围、服务时间和所在地。

### 5. Legal Aid | 法律援助

- The Legal Aid tab lists verified legal aid and women's rights resources.
- Users can quickly find phone numbers, service coverage, office hours, and official websites where useful.
- The directory is informational only; it does not replace professional legal advice.

- 法律援助页面展示已核实的法律援助和妇女权益相关资源。
- 用户可以快速查看电话、服务地区、工作时间，以及必要时的官方网站。
- 该目录仅作为信息入口，不替代专业法律意见。

### 6. Bilingual Mobile UI | 双语移动端界面

- English and Chinese are switched by a compact language button.
- The app only shows one language at a time.
- The current visual direction is soft, calm, and privacy-oriented.

- 用户可通过一个小型语言按钮切换中英文。
- 页面同一时间只展示一种语言。
- 当前视觉风格偏柔和、安静、重视隐私感。

---

## Future Roadmap | 未来规划

### Verified Personal Helpers | 可信个人帮助者

We plan to integrate verified individual psychologists and lawyers into the aid section. Instead of only showing organization-level resources, users will be able to find trusted professionals who can provide first-step support.

我们计划在援助模块中接入经过认证的个人心理咨询师和律师。未来用户不仅能看到机构资源，也能找到可信赖的专业个人帮助者，获得更直接的初步支持。

### End-to-End Encrypted Talking Rooms | 端到端加密沟通室

Once verified helpers are added, the app will provide end-to-end encrypted talking rooms between users and selected lawyers or psychologists. The first conversation period may be free, such as a limited number of messages or an initial short consultation, before moving into real paid services when both sides agree.

接入可信帮助者后，应用将为用户与律师或心理咨询师提供端到端加密沟通室。初始阶段可以提供一段免费沟通，例如有限次数消息或一次短时初谈；在双方确认后，再进入现实中的付费服务。

---

## Business Model | 商业模式设想

Our goal is to keep core safety access affordable.

- A very low membership fee can cover encrypted evidence storage, on-chain timestamping, and basic platform maintenance.
- Emergency contact setup, core SOS, and essential aid information should remain easy to access.
- If a mental health or legal aid introduction becomes a real paid case outside the app, the platform may charge a small service or referral fee.
- Future paid services should be transparent, consent-based, and separated from emergency access.

我们的目标是让核心安全能力保持低门槛。

- 通过极低会员费覆盖加密存证、链上时间戳和基础平台维护成本。
- 紧急联系人设置、核心 SOS 和基础援助信息应尽量保持易访问。
- 如果通过平台介绍形成现实中的心理咨询或法律服务付费案件，平台可收取少量服务费或转介费。
- 未来付费服务应保持透明、基于用户同意，并与紧急求助入口清晰分离。

---

## Tech Stack | 技术栈

| Layer | Technology |
| --- | --- |
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS, shadcn/ui, lucide-react |
| Auth / identity | Privy email OTP where configured; local email/password fallback for demo |
| Local data | localStorage, IndexedDB |
| Evidence encryption | Web Crypto API, AES-256-GCM |
| Evidence storage | Supabase Storage when configured; IndexedDB fallback |
| Evidence timestamping | ChainMaker (长安链) testnet integration with deterministic simulation fallback |
| Feedback / forms | Supabase |
| Deployment | Vercel, Tencent CloudBase static hosting |

---

## Safety Notes | 安全说明

- The Unmuted is not a replacement for emergency services, medical care, police, or a lawyer.
- If a user is in immediate physical danger, they should contact local emergency services or a trusted person as soon as possible.
- Evidence encryption protects content, but users must keep their device and downloaded key bundle safe.
- Phone numbers and contacts should be checked carefully before relying on SOS.

- 非默不能替代急救、医疗、警方或律师。
- 如果用户正处于人身危险中，应尽快联系当地紧急服务或可信任的人。
- 加密可以保护内容，但用户仍需妥善保管设备和下载的密钥包。
- 依赖 SOS 前，应仔细确认联系人电话是否正确。

---

## Team Members | 团队成员

- Gu Shi: https://github.com/hesta1218-collab
- Wendy Wu: https://github.com/DancinWendy
- Liz Wu: https://github.com/touhouzigei-crypto
- Katie Lin: https://github.com/katielin0207-dev
