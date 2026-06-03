import { useRef, useCallback, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera, Video, Mic, MicOff, CheckCircle2, Loader2,
  ArrowLeft, Clock, Download, ExternalLink, ShieldCheck, Copy, ChevronDown,
  ClipboardList, HeartPulse, MapPin, ShieldAlert,
  Lock, ChevronRight, Eye, EyeOff, Archive, Share2, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { useEvidenceVault } from "@/hooks/useEvidenceVault";
import { shortenHash } from "@/hooks/useWallet"; // eslint-disable-line @typescript-eslint/no-unused-vars
import { formatBytes, buildKeyBundle } from "@/lib/evidenceCrypto";
import { CHAINMAKER_NETWORK } from "@/lib/chainmakerService";
import { AppLanguage, copyFor } from "@/lib/locale";
import { hasReportNotes, saveEncryptedReportNotes, type EncryptedReportNoteRecord } from "@/lib/reportNotesVault";
import { hasPassword, verifyPassword } from "@/lib/userCredentials";

// ── helpers ────────────────────────────────────────────────────────────────────

function getMimeLabel(mime: string, language: AppLanguage) {
  if (mime.startsWith("image/")) return copyFor(language, "Image", "图片");
  if (mime.startsWith("video/")) return copyFor(language, "Video", "视频");
  if (mime.startsWith("audio/")) return copyFor(language, "Audio", "音频");
  return copyFor(language, "File", "文件");
}

function getMimeIcon(mime: string) {
  if (mime.startsWith("image/")) return "📷";
  if (mime.startsWith("video/")) return "🎥";
  if (mime.startsWith("audio/")) return "🎙️";
  return "📄";
}

function copyToClipboard(text: string, language: AppLanguage) {
  navigator.clipboard.writeText(text).then(() => toast.success(copyFor(language, "Copied", "已复制")));
}

function formatTs(ts: number, language: AppLanguage) {
  return new Date(ts * 1000).toLocaleString(language === "zh" ? "zh-CN" : "en-US");
}

type SituationId = "memory-gap" | "assault" | "stalking" | "unsafe-date";

type SituationGuide = {
  id: SituationId;
  titleEn: string;
  titleZh: string;
  descriptionEn: string;
  descriptionZh: string;
  items: { en: string; zh: string }[];
};

type ReportNoteId =
  | "lastClear"
  | "wokeUp"
  | "people"
  | "intake"
  | "body"
  | "safetyNow"
  | "injury"
  | "digital"
  | "scene"
  | "pattern"
  | "accounts"
  | "route"
  | "witness"
  | "plan"
  | "warningSigns";
type ReportNotes = Partial<Record<ReportNoteId, string>>;
type ReportNoteField = {
  id: ReportNoteId;
  labelEn: string;
  labelZh: string;
  placeholderEn: string;
  placeholderZh: string;
};

const SITUATION_GUIDES: SituationGuide[] = [
  {
    id: "memory-gap",
    titleEn: "Memory gap / possible drugging",
    titleZh: "记忆空白 / 疑似被下药",
    descriptionEn: "Use this if you woke up confused, passed out, or cannot remember part of what happened.",
    descriptionZh: "适用于醒来后混乱、昏睡断片，或记不清部分经过的情况。",
    items: [
      { en: "If safe, do not shower, brush teeth, or change clothes yet.", zh: "如果安全，先不要洗澡、刷牙或换衣服。" },
      { en: "Save cups, bottles, tissues, towels, bedding, and clothes separately.", zh: "分开保存杯子、瓶子、纸巾、毛巾、床品和衣物。" },
      { en: "Write down the last clear memory, place, people nearby, and what you drank or ate.", zh: "记录最后清楚的记忆、地点、身边的人、喝过或吃过什么。" },
      { en: "Ask medical or police professionals about urine, blood, injury, and forensic checks.", zh: "可向医疗或警方专业人员询问尿检、血检、伤情和取证检查。" },
    ],
  },
  {
    id: "assault",
    titleEn: "Sexual assault / forced contact",
    titleZh: "性侵犯 / 强迫接触",
    descriptionEn: "Use this if someone forced, touched, filmed, threatened, or controlled you.",
    descriptionZh: "适用于被强迫、触碰、拍摄、威胁或控制的情况。",
    items: [
      { en: "Your safety comes first. Leave the person or place before collecting evidence.", zh: "你的安全第一。先离开对方或现场，再考虑取证。" },
      { en: "Try not to wash your body, wounds, nails, mouth, or private areas before help arrives.", zh: "求助前尽量不要清洗身体、伤口、指甲、口腔或私密部位。" },
      { en: "Photograph injuries with time and context if you can.", zh: "如果可以，拍下伤痕，并保留时间和环境信息。" },
      { en: "Save chat logs, calls, location timeline, and health data from your phone or watch.", zh: "保存聊天、通话、定位轨迹，以及手机或手表里的健康异常数据。" },
    ],
  },
  {
    id: "stalking",
    titleEn: "Stalking / threat",
    titleZh: "跟踪 / 威胁",
    descriptionEn: "Use this if someone is following, watching, exposing, or threatening you.",
    descriptionZh: "适用于被跟踪、监视、信息暴露或威胁的情况。",
    items: [
      { en: "Do not confront them alone. Move toward a public or trusted place.", zh: "不要独自对质。先移动到公共或可信任的地方。" },
      { en: "Save messages, calls, photos, usernames, plates, and repeated time patterns.", zh: "保存消息、通话、照片、账号、车牌和反复出现的时间规律。" },
      { en: "Share your route with a trusted person and ask them to stay online.", zh: "把路线发给可信任的人，请对方保持在线。" },
      { en: "Use Community Help if you need accompaniment or a safe space.", zh: "如果需要陪同接应或安全空间，可使用社区陪伴支持。" },
    ],
  },
  {
    id: "unsafe-date",
    titleEn: "Unsafe date / unfamiliar place",
    titleZh: "约会 / 陌生空间风险",
    descriptionEn: "Use this before or after a meeting, apartment viewing, party, or private room situation.",
    descriptionZh: "适用于见面、看房、聚会、包间或私人空间前后的风险提醒。",
    items: [
      { en: "Meet in public first and keep your phone charged and close.", zh: "尽量先在公共场所见面，手机保持有电并放在身边。" },
      { en: "Get your own drink or food. Leave if dizziness, nausea, or extreme sleepiness feels wrong.", zh: "饮料食物尽量自己拿。若出现异常头晕、恶心或困倦，立刻离开。" },
      { en: "Send the place, contact, and time plan to someone you trust.", zh: "把地点、对方信息和时间安排发给可信任的人。" },
      { en: "If something happened, memory gaps are normal. Write only what you remember.", zh: "如果已经发生，记忆断片是正常反应。只记录你还记得的部分。" },
    ],
  },
];

const REPORT_NOTE_FIELDS: Record<SituationId, ReportNoteField[]> = {
  "memory-gap": [
    {
      id: "lastClear",
      labelEn: "Last clear memory",
      labelZh: "最后清楚的记忆",
      placeholderEn: "Time, place, who was there...",
      placeholderZh: "时间、地点、身边的人...",
    },
    {
      id: "wokeUp",
      labelEn: "Where I woke up / noticed danger",
      labelZh: "醒来或发现异常的地点",
      placeholderEn: "Room, street, car, hotel...",
      placeholderZh: "房间、街道、车里、酒店...",
    },
    {
      id: "people",
      labelEn: "People nearby",
      labelZh: "附近出现的人",
      placeholderEn: "Names, nicknames, accounts, descriptions...",
      placeholderZh: "姓名、昵称、账号、外貌描述...",
    },
    {
      id: "intake",
      labelEn: "Drinks / food / medicine",
      labelZh: "饮料 / 食物 / 药物",
      placeholderEn: "What you drank, ate, or were offered...",
      placeholderZh: "喝过、吃过，或别人递给你的东西...",
    },
    {
      id: "body",
      labelEn: "Body signs / unusual feelings",
      labelZh: "身体异常或伤痕",
      placeholderEn: "Pain, bruises, nausea, extreme sleepiness...",
      placeholderZh: "疼痛、淤青、恶心、异常困倦...",
    },
  ],
  assault: [
    {
      id: "safetyNow",
      labelEn: "Where I am now / safety status",
      labelZh: "现在的位置 / 是否安全",
      placeholderEn: "Safe place, trusted person, urgent risk nearby...",
      placeholderZh: "是否已到安全地点、是否有人陪同、附近是否仍有危险...",
    },
    {
      id: "lastClear",
      labelEn: "What I remember happened",
      labelZh: "我记得发生了什么",
      placeholderEn: "Only write what you remember. Missing details are okay...",
      placeholderZh: "只写你记得的部分，记不清也没关系...",
    },
    {
      id: "injury",
      labelEn: "Injuries / body signs",
      labelZh: "伤痕 / 身体异常",
      placeholderEn: "Pain, bruises, bleeding, torn clothes, unusual feelings...",
      placeholderZh: "疼痛、淤青、出血、衣物破损、异常感觉...",
    },
    {
      id: "scene",
      labelEn: "Things to preserve",
      labelZh: "需要保留的物品",
      placeholderEn: "Clothes, bedding, tissues, towels, protection, cups...",
      placeholderZh: "衣物、床品、纸巾、毛巾、保护用品、杯子...",
    },
    {
      id: "digital",
      labelEn: "Messages / calls / location timeline",
      labelZh: "消息 / 通话 / 定位轨迹",
      placeholderEn: "Chats, calls, ride records, photos, health/watch data...",
      placeholderZh: "聊天、通话、打车记录、照片、健康或手表数据...",
    },
  ],
  stalking: [
    {
      id: "pattern",
      labelEn: "Repeated pattern",
      labelZh: "反复出现的规律",
      placeholderEn: "When, where, how often, same person or account...",
      placeholderZh: "何时、何地、频率、是否同一人或账号...",
    },
    {
      id: "accounts",
      labelEn: "Person / account / vehicle details",
      labelZh: "人员 / 账号 / 车辆信息",
      placeholderEn: "Names, usernames, phone numbers, plates, descriptions...",
      placeholderZh: "姓名、账号、电话、车牌、外貌特征...",
    },
    {
      id: "digital",
      labelEn: "Evidence already saved",
      labelZh: "已保存的证据",
      placeholderEn: "Screenshots, photos, audio, camera footage, call logs...",
      placeholderZh: "截图、照片、录音、监控、通话记录...",
    },
    {
      id: "route",
      labelEn: "Route / safe contact",
      labelZh: "路线 / 安全联系人",
      placeholderEn: "Where you are going, who knows, who can stay online...",
      placeholderZh: "你要去哪里、谁知道、谁可以保持在线...",
    },
  ],
  "unsafe-date": [
    {
      id: "plan",
      labelEn: "Meeting plan / place",
      labelZh: "见面安排 / 地点",
      placeholderEn: "Address, time, room number, who invited you...",
      placeholderZh: "地址、时间、房间号、谁邀请你...",
    },
    {
      id: "people",
      labelEn: "Person / contact details",
      labelZh: "对方 / 联系方式",
      placeholderEn: "Name, account, phone, photos, mutual friends...",
      placeholderZh: "姓名、账号、电话、照片、共同好友...",
    },
    {
      id: "intake",
      labelEn: "Drinks / food offered",
      labelZh: "饮料 / 食物",
      placeholderEn: "What you drank or ate, who gave it to you, when...",
      placeholderZh: "喝了或吃了什么、谁给的、什么时候...",
    },
    {
      id: "warningSigns",
      labelEn: "Warning signs",
      labelZh: "异常信号",
      placeholderEn: "Dizziness, nausea, sleepiness, pressure, locked door...",
      placeholderZh: "头晕、恶心、困倦、被施压、门被锁住...",
    },
    {
      id: "witness",
      labelEn: "Who knows where I am",
      labelZh: "谁知道我的位置",
      placeholderEn: "Trusted friend, roommate, shared location, message sent...",
      placeholderZh: "可信朋友、室友、已共享定位、已发送消息...",
    },
  ],
};

function emptyReportNotes(): ReportNotes {
  return {};
}

function getSituationGuide(id: SituationId) {
  return SITUATION_GUIDES.find((guide) => guide.id === id) ?? SITUATION_GUIDES[0];
}

// ── Step indicator ─────────────────────────────────────────────────────────────

type StepStatusVal = "pending" | "running" | "done" | "error";

function StepRow({
  label,
  sublabel,
  status,
}: {
  label: string;
  sublabel: string;
  status: StepStatusVal;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-card">
        {status === "running" && (
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        )}
        {status === "done" && (
          <CheckCircle2 className="h-4 w-4 text-sos-success" />
        )}
        {status === "error" && (
          <span className="text-xs font-bold text-destructive">✕</span>
        )}
        {status === "pending" && (
          <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
        )}
      </div>
      <div className="flex-1">
        <p
          className={`text-sm font-semibold ${
            status === "running"
              ? "text-foreground"
              : status === "done"
              ? "text-sos-success"
              : "text-muted-foreground"
          }`}
        >
          {label}
        </p>
        <p className="text-xs text-muted-foreground">{sublabel}</p>
      </div>
    </div>
  );
}

// ── Receipt card ───────────────────────────────────────────────────────────────

function ReceiptCard({
  result,
  selectedSituation,
  reportNotes,
  onDownloadKey,
  onReset,
  onComplete,
  language,
}: {
  result: NonNullable<ReturnType<typeof useEvidenceVault>["result"]>;
  selectedSituation: SituationId;
  reportNotes: ReportNotes;
  onDownloadKey: () => void;
  onReset: () => void;
  onComplete?: () => void;
  language: AppLanguage;
}) {
  const { record } = result;
  const [expanded, setExpanded] = useState(false);
  const selectedGuide = getSituationGuide(selectedSituation);
  const noteRows = REPORT_NOTE_FIELDS[selectedSituation]
    .map((field) => ({ field, value: (reportNotes[field.id] ?? "").trim() }))
    .filter((row) => row.value.length > 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-sos-success/30 bg-sos-success/5 p-4 space-y-4"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sos-success/15">
          <ShieldCheck className="h-5 w-5 text-sos-success" />
        </div>
        <div>
          <p className="font-bold text-foreground">{copyFor(language, "Evidence Secured", "存证完成")}</p>
          <p className="text-xs text-muted-foreground">
            {getMimeIcon(record.mimeType)} {getMimeLabel(record.mimeType, language)} ·{" "}
            {formatBytes(record.originalSize)} · {new Date(record.createdAt).toLocaleString(language === "zh" ? "zh-CN" : "en-US")}
          </p>
        </div>
      </div>

      {/* Key save section — most important action */}
      <KeySaveSection result={result} onDownloadKey={onDownloadKey} language={language} />

      {noteRows.length > 0 && (
        <div className="rounded-2xl border border-primary/18 bg-primary/8 p-3">
          <div className="flex items-start gap-2">
            <HeartPulse className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div>
              <p className="text-xs font-black text-foreground">
                {copyFor(language, "Encrypted report notes", "加密报告备注")}
              </p>
              <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                {copyFor(language, selectedGuide.titleEn, selectedGuide.titleZh)}
              </p>
              <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                {copyFor(
                  language,
                  "Demo preview: these notes can be saved with this encrypted evidence report.",
                  "演示预览：这些备注可与本次加密证据报告一起保存。"
                )}
              </p>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            {noteRows.map(({ field, value }) => (
              <div key={field.id} className="rounded-xl border border-border/60 bg-background/55 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                  {copyFor(language, field.labelEn, field.labelZh)}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-foreground">{value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expandable details */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between text-xs text-muted-foreground"
      >
        <span>{copyFor(language, "View evidence details", "查看存证详情")}</span>
        <ChevronDown
          className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden space-y-3"
          >
            {/* Hash */}
            <HashRow
              label={copyFor(language, "Encrypted file fingerprint (SHA-256)", "加密文件指纹 (SHA-256)")}
              value={record.encryptedHash}
              short={shortenHash("0x" + record.encryptedHash.slice(0, 8) + record.encryptedHash.slice(-8))}
              language={language}
            />

            {/* Cloud storage */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-semibold text-muted-foreground">
                  {copyFor(language, "Encrypted file storage", "加密文件云端存储")}
                </p>
                {record.arweaveUrl ? (
                  <span className="rounded px-1 py-0.5 text-[10px] font-bold bg-sos-success/15 text-sos-success">
                    {copyFor(language, "Cloud ✓", "云端 ✓")}
                  </span>
                ) : (
                  <span className="rounded px-1 py-0.5 text-[10px] font-bold bg-amber-500/15 text-amber-400">
                    {copyFor(language, "Local only", "仅本地")}
                  </span>
                )}
              </div>
              {record.arweaveUrl ? (
                <div className="flex items-center gap-2 rounded-lg bg-card px-3 py-2">
                  <p className="flex-1 font-mono text-xs text-foreground truncate">
                    {record.arweaveTxId.slice(0, 12)}…{record.arweaveTxId.slice(-6)}
                  </p>
                  <button onClick={() => copyToClipboard(record.arweaveTxId, language)}>
                    <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                  <a href={record.arweaveUrl} target="_blank" rel="noopener noreferrer" className="text-primary">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-lg bg-amber-500/8 border border-amber-500/20 px-3 py-2">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                  <p className="text-xs text-amber-400/90">
                    {copyFor(language,
                      "Stored on this device only. Clear browser data = file lost.",
                      "仅存储在本设备。清除浏览器数据后文件将丢失。"
                    )}
                  </p>
                </div>
              )}
            </div>

            {/* Chain TX — ChainMaker */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-semibold text-muted-foreground">
                  {copyFor(language, "长安链 ChainMaker Timestamp", "长安链时间戳 / ChainMaker Timestamp")}
                </p>
                {record.isSimulated && (
                  <span className="rounded px-1 py-0.5 text-[10px] font-bold bg-sos-offline/15 text-sos-offline">
                    {copyFor(language, "Demo", "演示模式")}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-card px-3 py-2">
                <p className="flex-1 font-mono text-xs text-foreground truncate">
                  {record.chainTxHash.slice(0, 8)}…{record.chainTxHash.slice(-6)}
                </p>
                <button onClick={() => copyToClipboard(record.chainTxHash, language)}>
                  <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
                <a
                  href={record.chainExplorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {copyFor(language, "Block time", "区块时间")}：{formatTs(record.blockTimestamp, language)}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={onComplete ?? onReset}
        className="w-full rounded-xl border border-border py-2.5 text-sm font-medium text-muted-foreground active:scale-95 transition-transform"
      >
        {onComplete
          ? copyFor(language, "Finish report", "完成报告")
          : copyFor(language, "Continue", "继续存证")}
      </button>
    </motion.div>
  );
}

function HashRow({
  label,
  value,
  short,
  language,
}: {
  label: string;
  value: string;
  short: string;
  language: AppLanguage;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2 rounded-lg bg-card px-3 py-2">
        <p className="flex-1 font-mono text-xs text-foreground">{short}</p>
        <button onClick={() => copyToClipboard(value, language)}>
          <Copy className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}

// ── Key save section ───────────────────────────────────────────────────────────
/**
 * 密钥保存区块
 *
 * AES-256 密钥是解密证据的唯一凭证，丢失后无法恢复文件。
 * 提供三种保存方式，适配手机用户：
 *   1. 分享（Web Share API）— 发给自己的备忘录 / 微信文件助手
 *   2. 复制文本          — 粘贴到任意备忘录
 *   3. 下载 JSON 文件    — 传统下载（桌面端友好）
 */
function KeySaveSection({
  result,
  onDownloadKey,
  language,
}: {
  result: NonNullable<ReturnType<typeof useEvidenceVault>["result"]>;
  onDownloadKey: () => void;
  language: AppLanguage;
}) {
  const [copied, setCopied] = useState(false);

  // 将密钥序列化为 Base64 字符串，方便复制粘贴
  const keyText = (() => {
    try {
      const bundle = buildKeyBundle(result.encryptionResult);
      return btoa(unescape(encodeURIComponent(JSON.stringify(bundle))));
    } catch {
      return "";
    }
  })();

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(keyText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard not available
    }
  };

  const handleShare = async () => {
    const ts = new Date(result.record.createdAt).toISOString().slice(0, 10);
    const fileName = `the-unmuted-key-${ts}.json`;
    try {
      const bundle = buildKeyBundle(result.encryptionResult);
      const file = new File(
        [JSON.stringify(bundle, null, 2)],
        fileName,
        { type: "application/json" }
      );
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "非默存证密钥" });
        return;
      }
    } catch {
      // share failed or cancelled — fall through to text share
    }
    // 降级：分享纯文本
    try {
      await navigator.share({
        title: "非默存证密钥",
        text: keyText,
      });
    } catch {
      // user cancelled or not supported
    }
  };

  const canShare = typeof navigator.share === "function";

  return (
    <div className="space-y-2">
      {/* 警告标题 */}
      <div className="flex items-start gap-2 rounded-xl bg-primary/8 border border-primary/20 px-3 py-2.5">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div>
          <p className="text-xs font-bold text-foreground">
            {copyFor(language, "Save your decryption key", "保存解密密钥")}
          </p>
          <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
            {copyFor(
              language,
              "This key is the ONLY way to recover your evidence. If you lose it, the file cannot be opened by anyone.",
              "这是恢复证据的唯一凭证。丢失后任何人（包括我们）都无法恢复原始文件。"
            )}
          </p>
        </div>
      </div>

      {/* 三个保存按钮 */}
      <div className="grid grid-cols-3 gap-2">
        {/* 1. 分享 */}
        {canShare && (
          <button
            onClick={handleShare}
            className="flex flex-col items-center gap-1 rounded-xl border border-border bg-card py-3 text-xs font-semibold text-foreground active:scale-95 transition-transform"
          >
            <Share2 className="h-5 w-5 text-primary" />
            {copyFor(language, "Share", "分享")}
          </button>
        )}
        {/* 2. 复制文本 */}
        <button
          onClick={handleCopyText}
          className={`flex flex-col items-center gap-1 rounded-xl border py-3 text-xs font-semibold active:scale-95 transition-all ${
            copied
              ? "border-sos-success/40 bg-sos-success/10 text-sos-success"
              : "border-border bg-card text-foreground"
          } ${!canShare ? "col-span-1" : ""}`}
        >
          {copied ? (
            <CheckCircle2 className="h-5 w-5 text-sos-success" />
          ) : (
            <Copy className="h-5 w-5 text-primary" />
          )}
          {copied
            ? copyFor(language, "Copied!", "已复制")
            : copyFor(language, "Copy text", "复制文本")}
        </button>
        {/* 3. 下载文件 */}
        <button
          onClick={onDownloadKey}
          className="flex flex-col items-center gap-1 rounded-xl border border-border bg-card py-3 text-xs font-semibold text-foreground active:scale-95 transition-transform"
        >
          <Download className="h-5 w-5 text-primary" />
          {copyFor(language, "Download", "下载文件")}
        </button>
      </div>

      <p className="text-center text-[11px] text-muted-foreground leading-4">
        {copyFor(
          language,
          'Tip: "Share" sends to WeChat / Notes / Files app directly.',
          '提示：点「分享」可直接发到微信文件助手或备忘录。'
        )}
      </p>
    </div>
  );
}

// ── Audio recorder ─────────────────────────────────────────────────────────────

function useAudioRecorder(onBlob: (blob: Blob) => void, language: AppLanguage) {
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach(t => t.stop());
        onBlob(blob);
      };
      recorder.start();
      mediaRef.current = recorder;
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    } catch {
      toast.error(copyFor(language, "Could not access microphone. Please check permissions.", "无法访问麦克风，请检查权限"));
    }
  }, [onBlob, language]);

  const stop = useCallback(() => {
    mediaRef.current?.stop();
    clearInterval(timerRef.current);
    setRecording(false);
    setSeconds(0);
  }, []);

  return { recording, seconds, start, stop };
}

// ── Main component ─────────────────────────────────────────────────────────────

type EvidenceView = "hub" | "capture" | "notes" | "records";

export default function EvidencePage({
  language,
  userEmail,
  onExit,
  onComplete,
}: {
  language: AppLanguage;
  userEmail?: string;
  onExit?: () => void;
  onComplete?: () => void;
}) {
  const vault = useEvidenceVault(language);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Navigation within the evidence section
  const [view, setView] = useState<EvidenceView>("hub");

  // Capture sub-view state
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  // Notes sub-view state
  const [selectedSituation, setSelectedSituation] = useState<SituationId>("memory-gap");
  const [reportNotes, setReportNotes] = useState<ReportNotes>(() => emptyReportNotes());

  // Records unlock state
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [unlockPwd, setUnlockPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [unlockError, setUnlockError] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [hasPwd, setHasPwd] = useState<boolean | null>(null);

  // Check if user has a password when records view opens
  useEffect(() => {
    if (view === "records" && userEmail && hasPwd === null) {
      hasPassword(userEmail).then(setHasPwd);
    }
  }, [view, userEmail, hasPwd]);

  const goHub = useCallback(() => {
    if (vault.step !== "idle") vault.reset();
    setView("hub");
  }, [vault]);

  const resetReport = useCallback(() => {
    vault.reset();
    setReportNotes(emptyReportNotes());
  }, [vault]);

  const finishReport = useCallback(() => {
    setReportNotes(emptyReportNotes());
    onComplete?.();
  }, [onComplete]);

  const handleSituationChange = useCallback((nextSituation: SituationId) => {
    setSelectedSituation(nextSituation);
    setReportNotes(emptyReportNotes());
  }, []);

  const audioRecorder = useAudioRecorder(
    (blob) => vault.processFile(blob, "audio/webm"),
    language
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      vault.processFile(file, file.type);
      e.target.value = "";
    },
    [vault]
  );

  const handleUnlock = async () => {
    if (!userEmail) { setIsUnlocked(true); return; }
    setUnlocking(true);
    setUnlockError(false);
    const ok = await verifyPassword(userEmail, unlockPwd);
    setUnlocking(false);
    if (ok) {
      setIsUnlocked(true);
    } else {
      setUnlockError(true);
    }
  };

  const isProcessing =
    vault.step === "encrypting" ||
    vault.step === "uploading" ||
    vault.step === "anchoring";

  // ── Hub ──────────────────────────────────────────────────────────────────────
  if (view === "hub") {
    return (
      <div className="flex flex-col gap-5 px-4 py-4">
        <div className="pt-2 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
            <Archive className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-xl font-black text-foreground">
            {copyFor(language, "Evidence Vault", "存证中心")}
          </h1>
          <p className="mt-2 text-sm leading-5 text-muted-foreground">
            {copyFor(
              language,
              "All evidence is encrypted on your device before upload.",
              "所有记录均在本机加密后才上传，无法被第三方读取。"
            )}
          </p>
        </div>

        <div className="space-y-3">
          {/* Capture */}
          <button
            onClick={() => setView("capture")}
            className="w-full rounded-2xl border border-border bg-card p-5 text-left shadow-sm active:scale-[0.98] transition-transform"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-500/10">
                <Camera className="h-6 w-6 text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground">
                  {copyFor(language, "Capture Evidence", "即时取证")}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {copyFor(
                    language,
                    "Photo, video, or audio — encrypted & timestamped on-chain.",
                    "拍照、录像或录音，自动加密并写入区块链存证。"
                  )}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </div>
          </button>

          {/* Notes */}
          <button
            onClick={() => setView("notes")}
            className="w-full rounded-2xl border border-border bg-card p-5 text-left shadow-sm active:scale-[0.98] transition-transform"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-purple-500/10">
                <ClipboardList className="h-6 w-6 text-purple-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground">
                  {copyFor(language, "Situation Log", "情况记录")}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {copyFor(
                    language,
                    "Write down what happened. Encrypted and saved on this device.",
                    "文字记录遭遇经过，加密保存在本机。"
                  )}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </div>
          </button>

          {/* Records (password-locked) */}
          <button
            onClick={() => setView("records")}
            className="w-full rounded-2xl border border-border bg-card p-5 text-left shadow-sm active:scale-[0.98] transition-transform"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-green-500/10">
                <Lock className="h-6 w-6 text-green-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground">
                  {copyFor(language, "View Records", "查看存证记录")}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {copyFor(
                    language,
                    "Password required to view stored evidence.",
                    "需输入密码才能查看已存证的记录。"
                  )}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </div>
          </button>
        </div>
      </div>
    );
  }

  // ── Capture ───────────────────────────────────────────────────────────────────
  if (view === "capture") {
    return (
      <div className="flex flex-1 flex-col px-4 pb-4 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={goHub}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground active:scale-95"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h2 className="text-lg font-bold text-foreground">
              {copyFor(language, "Capture Evidence", "即时取证")}
            </h2>
            <p className="text-xs text-muted-foreground">
              {copyFor(language, "Encrypted on your device before upload.", "拍摄后立即在本机加密。")}
            </p>
          </div>
        </div>

        {vault.step === "idle" && (
          <HowItWorksDisclosure
            open={showHowItWorks}
            onToggle={() => setShowHowItWorks((c) => !c)}
            language={language}
          />
        )}

        <AnimatePresence mode="wait">
          {vault.step === "idle" && (
            <motion.div
              key="capture-btns"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-3 gap-3"
            >
              <CaptureButton
                icon={<Camera className="h-7 w-7" />}
                label={copyFor(language, "Photo", "拍照")}
                color="text-blue-400"
                bgColor="bg-blue-500/10 border-blue-500/20"
                onClick={() => photoInputRef.current?.click()}
              />
              <CaptureButton
                icon={<Video className="h-7 w-7" />}
                label={copyFor(language, "Video", "录像")}
                color="text-purple-400"
                bgColor="bg-purple-500/10 border-purple-500/20"
                onClick={() => videoInputRef.current?.click()}
              />
              <CaptureButton
                icon={
                  audioRecorder.recording ? (
                    <MicOff className="h-7 w-7 text-red-400 animate-pulse" />
                  ) : (
                    <Mic className="h-7 w-7" />
                  )
                }
                label={audioRecorder.recording ? `${audioRecorder.seconds}s` : copyFor(language, "Audio", "录音")}
                color={audioRecorder.recording ? "text-red-400" : "text-green-400"}
                bgColor={
                  audioRecorder.recording
                    ? "bg-red-500/15 border-red-500/40"
                    : "bg-green-500/10 border-green-500/20"
                }
                onClick={audioRecorder.recording ? audioRecorder.stop : audioRecorder.start}
              />
              <input ref={photoInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileInput} />
              <input ref={videoInputRef} type="file" accept="video/*" capture="environment" className="hidden" onChange={handleFileInput} />
            </motion.div>
          )}

          {isProcessing && (
            <motion.div key="processing" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="rounded-2xl border border-border bg-card p-5 space-y-4"
            >
              <p className="text-sm font-bold text-foreground text-center">
                {copyFor(language, "Processing...", "正在处理...")}
              </p>
              <StepRow
                label={copyFor(language, "AES-256-GCM Local encryption", "AES-256-GCM 本地加密")}
                sublabel={copyFor(language, "Done on your device. Data never leaves unencrypted.", "在设备端完成，数据不离开本机")}
                status={vault.steps.encrypting}
              />
              <StepRow
                label={copyFor(language, "Upload to Arweave permanent storage", "上传至 Arweave 永久存储")}
                sublabel={copyFor(language, "Only encrypted originals are stored.", "加密原件，任何人无法解读内容")}
                status={vault.steps.uploading}
              />
              <StepRow
                label={copyFor(language, "ChainMaker (长安链) timestamp", "长安链时间戳")}
                sublabel={copyFor(language, "Hash anchored on ChainMaker judicial alliance chain.", "哈希写入长安链（司法联盟链），不可篡改")}
                status={vault.steps.anchoring}
              />
            </motion.div>
          )}

          {vault.step === "done" && vault.result && (
            <motion.div key="receipt" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <ReceiptCard
                result={vault.result}
                selectedSituation={selectedSituation}
                reportNotes={reportNotes}
                onDownloadKey={vault.downloadKey}
                onReset={resetReport}
                onComplete={onComplete ? finishReport : undefined}
                language={language}
              />
            </motion.div>
          )}

          {vault.step === "error" && (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 space-y-3"
            >
              <p className="text-sm font-bold text-destructive">
                {copyFor(language, "Evidence failed", "存证失败")}
              </p>
              <p className="text-xs text-muted-foreground">{vault.error}</p>
              <button onClick={vault.reset}
                className="w-full rounded-xl bg-card border border-border py-2.5 text-sm font-medium text-foreground"
              >
                {copyFor(language, "Retry", "重试")}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ── Notes ─────────────────────────────────────────────────────────────────────
  if (view === "notes") {
    return (
      <div className="flex flex-1 flex-col px-4 pb-4 space-y-5">
        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={() => setView("hub")}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground active:scale-95"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h2 className="text-lg font-bold text-foreground">
              {copyFor(language, "Situation Log", "情况记录")}
            </h2>
            <p className="text-xs text-muted-foreground">
              {copyFor(language, "Write down what happened. Encrypted on this device.", "文字记录遭遇，加密保存在本机。")}
            </p>
          </div>
        </div>

        <ReportGuidanceCard
          selectedSituation={selectedSituation}
          onSituationChange={handleSituationChange}
          notes={reportNotes}
          onNotesChange={setReportNotes}
          language={language}
        />
      </div>
    );
  }

  // ── Records (password-locked) ─────────────────────────────────────────────────
  return (
    <div className="flex flex-1 flex-col px-4 pb-4 space-y-5">
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={() => setView("hub")}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground active:scale-95"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h2 className="text-lg font-bold text-foreground">
            {copyFor(language, "Evidence Records", "存证记录")}
          </h2>
          <p className="text-xs text-muted-foreground">
            {copyFor(language, "Your encrypted evidence history.", "你的加密存证历史。")}
          </p>
        </div>
      </div>

      {/* Password gate */}
      {!isUnlocked ? (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
              <Lock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">
                {copyFor(language, "Password required", "需要输入密码")}
              </p>
              <p className="text-xs text-muted-foreground">
                {hasPwd === false
                  ? copyFor(language, "No password set. Go to Settings to set one.", "尚未设置密码，请在设置中设置后再查看。")
                  : copyFor(language, "Enter your account password to view records.", "输入账号密码查看存证记录。")}
              </p>
            </div>
          </div>

          {hasPwd !== false && userEmail && (
            <div className="space-y-3">
              <div className="relative">
                <input
                  value={unlockPwd}
                  onChange={(e) => setUnlockPwd(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
                  type={showPwd ? "text" : "password"}
                  placeholder={copyFor(language, "Password", "密码")}
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 pr-11 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
                />
                <button
                  onClick={() => setShowPwd((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {unlockError && (
                <p className="text-xs text-destructive">
                  {copyFor(language, "Incorrect password.", "密码错误。")}
                </p>
              )}
              <button
                onClick={handleUnlock}
                disabled={!unlockPwd || unlocking}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-60"
              >
                {unlocking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                {copyFor(language, "Unlock", "解锁查看")}
              </button>
            </div>
          )}
        </div>
      ) : vault.history.length === 0 ? (
        <div className="rounded-2xl border border-border/60 bg-card/50 p-6 text-center">
          <ShieldCheck className="mx-auto mb-2 h-8 w-8 text-primary/40" />
          <p className="text-sm text-muted-foreground">
            {copyFor(language, "No evidence records yet.", "暂无存证记录。")}
          </p>
        </div>
      ) : (
        <VaultHistory records={vault.history} language={language} />
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ReportGuidanceCard({
  selectedSituation,
  onSituationChange,
  notes,
  onNotesChange,
  language,
}: {
  selectedSituation: SituationId;
  onSituationChange: (situation: SituationId) => void;
  notes: ReportNotes;
  onNotesChange: React.Dispatch<React.SetStateAction<ReportNotes>>;
  language: AppLanguage;
}) {
  const selected = getSituationGuide(selectedSituation);
  const fields = REPORT_NOTE_FIELDS[selectedSituation];
  const [savingNotes, setSavingNotes] = useState(false);
  const [savedRecord, setSavedRecord] = useState<EncryptedReportNoteRecord | null>(null);
  const canSave = hasReportNotes(notes);

  const handleSaveNotes = async () => {
    if (!canSave) {
      toast.info(copyFor(language, "Write one note first.", "请先填写至少一项内容。"));
      return;
    }

    setSavingNotes(true);
    try {
      const record = await saveEncryptedReportNotes(selectedSituation, notes);
      setSavedRecord(record);
      toast.success(copyFor(language, "Encrypted notes saved on this device.", "填写内容已加密保存在本机。"));
    } catch (error) {
      if (error instanceof Error && error.message === "EMPTY_NOTES") {
        toast.info(copyFor(language, "Write one note first.", "请先填写至少一项内容。"));
      } else {
        toast.error(copyFor(language, "Could not save encrypted notes.", "暂时无法加密保存内容。"));
      }
    } finally {
      setSavingNotes(false);
    }
  };

  return (
    <section className="space-y-3 rounded-[1.75rem] border border-primary/16 bg-[linear-gradient(145deg,hsl(336_92%_76%/0.14),hsl(270_75%_62%/0.10),hsl(var(--card)/0.92))] p-4 shadow-[0_14px_34px_hsl(240_70%_4%/0.14)]">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary">
          <ClipboardList className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-black text-foreground">
            {copyFor(language, "What happened?", "你遇到了什么情况？")}
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {copyFor(
              language,
              "Choose one. We only show the most important next steps.",
              "选择一种情况，只显示最重要的下一步。"
            )}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {SITUATION_GUIDES.map((guide) => {
          const active = guide.id === selectedSituation;
          return (
            <button
              key={guide.id}
              type="button"
              onClick={() => onSituationChange(guide.id)}
              className={`rounded-2xl border px-3 py-2.5 text-left text-xs font-bold leading-4 transition-all active:scale-[0.98] ${
                active
                  ? "border-primary/35 bg-primary/12 text-primary shadow-[0_10px_24px_hsl(var(--primary)/0.14)]"
                  : "border-border/70 bg-card/70 text-muted-foreground"
              }`}
            >
              {copyFor(language, guide.titleEn, guide.titleZh)}
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl border border-border/70 bg-background/62 p-3">
        <p className="text-xs font-black text-foreground">
          {copyFor(language, selected.titleEn, selected.titleZh)}
        </p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {copyFor(language, selected.descriptionEn, selected.descriptionZh)}
        </p>
        <div className="mt-3 space-y-2">
          {selected.items.map((item) => (
            <div key={item.en} className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sos-success" />
              <span>{copyFor(language, item.en, item.zh)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-2xl border border-sos/16 bg-sos/8 px-3 py-2.5 text-xs leading-5 text-muted-foreground">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-sos" />
        <span>
          {copyFor(
            language,
            "Safety first. Do not move, do not wash if safe. Photograph first, then seek help.",
            "安全第一。若条件允许，先别动、先别洗。先拍照，再求助。"
          )}
        </span>
      </div>

      <div className="rounded-[1.5rem] border border-border/70 bg-card/58 p-3">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sos-success/12 text-sos-success">
            <HeartPulse className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-black text-foreground">
              {copyFor(language, "Report guideline", "报告填写指引")}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {copyFor(
                language,
                "Fill only what you know. Empty fields are okay.",
                "只填写你知道的部分，空着也没关系。"
              )}
            </p>
          </div>
        </div>

        <div className="mt-3 grid gap-2">
          {fields.map((field) => (
            <label key={field.id} className="space-y-1.5">
              <span className="text-[11px] font-bold text-muted-foreground">
                {copyFor(language, field.labelEn, field.labelZh)}
              </span>
              <textarea
                rows={2}
                value={notes[field.id] ?? ""}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  onNotesChange((current) => ({ ...current, [field.id]: nextValue }));
                }}
                className="min-h-[3.1rem] w-full resize-none rounded-2xl border border-white/80 bg-white/95 px-3 py-2 text-xs font-semibold leading-5 text-[#2d174d] caret-[#7f35b2] outline-none shadow-[inset_0_1px_0_hsl(0_0%_100%/0.75)] transition-colors placeholder:text-[#a996bd] focus:border-primary/70 focus:bg-white"
                placeholder={copyFor(language, field.placeholderEn, field.placeholderZh)}
              />
            </label>
          ))}
        </div>

        <div className="mt-3 grid gap-2">
          <button
            type="button"
            onClick={handleSaveNotes}
            disabled={savingNotes || !canSave}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,hsl(320_100%_78%),hsl(271_100%_74%))] px-4 py-2.5 text-xs font-black text-white shadow-[0_12px_26px_hsl(292_80%_42%/0.22)] transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {savingNotes ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            {copyFor(language, "Save encrypted notes", "加密保存填写内容")}
          </button>

          <div className="flex items-start gap-2 rounded-2xl border border-primary/12 bg-primary/6 px-3 py-2 text-[11px] leading-5 text-muted-foreground">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <span>
              {savedRecord
                ? copyFor(
                    language,
                    `Saved ${savedRecord.noteCount} encrypted notes on this device.`,
                    `已在本机加密保存 ${savedRecord.noteCount} 项内容。`
                  )
                : copyFor(
                    language,
                    "Notes are encrypted before local saving and can attach to the evidence receipt.",
                    "内容会先加密再保存在本机，也可附加到存证回执中。"
                  )}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function CaptureButton({
  icon, label, color, bgColor, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  color: string;
  bgColor: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-2 rounded-2xl border ${bgColor} py-5 active:scale-95 transition-transform ${color}`}
    >
      {icon}
      <span className="text-xs font-bold text-foreground">{label}</span>
    </button>
  );
}

function HowItWorksDisclosure({
  open,
  onToggle,
  language,
}: {
  open: boolean;
  onToggle: () => void;
  language: AppLanguage;
}) {
  const items = [
    [
      "🔒",
      copyFor(language, "AES-256 encryption", "AES-256 加密"),
      copyFor(language, "Files are encrypted locally. Only you hold the key.", "文件在设备本地加密，密钥仅你持有"),
    ],
    [
      "🌐",
      copyFor(language, "Arweave storage", "Arweave 存储"),
      copyFor(language, "Encrypted originals are permanently stored on a decentralized network.", "加密原件永久存储于去中心化网络"),
    ],
    [
      "⛓",
      copyFor(language, "ChainMaker (长安链) timestamp", "长安链时间戳"),
      copyFor(language, "Hashes are anchored on ChainMaker judicial alliance chain.", "哈希写入长安链（司法联盟链），不可篡改"),
    ],
  ];

  return (
    <div className="space-y-2">
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="inline-flex min-h-0 items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
      >
        {copyFor(language, "How it works", "工作原理")}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="rounded-xl border border-border bg-card/50 px-4 py-3 space-y-2">
              {items.map(([icon, title, desc]) => (
                <div key={title} className="flex items-start gap-2.5 text-xs">
                  <span>{icon}</span>
                  <div>
                    <span className="font-semibold text-foreground">{title}</span>
                    <span className="text-muted-foreground"> - {desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function VaultHistory({
  records,
  language,
}: {
  records: import("@/lib/localStorage").VaultRecord[];
  language: AppLanguage;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-bold text-foreground">
        {copyFor(language, "Evidence History", "存证记录")}
      </h3>
      {records.slice(0, 10).map((r) => (
        <div key={r.id} className="rounded-xl border border-border bg-card p-3 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-base">{getMimeIcon(r.mimeType)}</span>
            <span className="text-xs font-medium text-foreground">
              {getMimeLabel(r.mimeType, language)} · {formatBytes(r.originalSize)}
            </span>
            <span
              className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded ${
                r.isSimulated
                  ? "bg-sos-offline/15 text-sos-offline"
                  : "bg-sos-success/15 text-sos-success"
              }`}
            >
              {r.isSimulated ? copyFor(language, "Demo", "演示") : copyFor(language, "On-chain", "已上链")}
            </span>
          </div>
          <p className="font-mono text-[11px] text-muted-foreground">
            SHA-256: {r.encryptedHash.slice(0, 16)}…
          </p>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3 shrink-0" />
            <span>{new Date(r.createdAt).toLocaleString(language === "zh" ? "zh-CN" : "en-US")}</span>
            {!r.isSimulated && (
              <a
                href={r.chainExplorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto text-primary"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function SOSHistory({ language }: { language: AppLanguage }) {
  const history = loadSOSHistory();
  if (history.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-bold text-foreground">
        {copyFor(language, "SOS History", "SOS 记录")}
      </h3>
      {history.slice(0, 5).map((rec, i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-3 space-y-1">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold ${rec.status === "success" ? "text-sos-success" : "text-sos-offline"}`}>
              {rec.status === "success"
                ? copyFor(language, "✓ On-chain", "✓ 已上链")
                : copyFor(language, "⚠ Saved locally", "⚠ 本地存储")}
            </span>
            <span className="ml-auto text-[11px] text-muted-foreground">{formatTs(rec.timestamp, language)}</span>
          </div>
          {rec.txHash && (
            <a
              href={`https://testnet.snowtrace.io/tx/${rec.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs text-primary underline"
            >
              TX: {shortenHash(rec.txHash)}
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

