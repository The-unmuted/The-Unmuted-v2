import { useRef, useCallback, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera, Video, Mic, MicOff, CheckCircle2, Loader2,
  ArrowLeft, Clock, Download, ExternalLink, ShieldCheck, Copy, ChevronDown,
  ClipboardList, HeartPulse, MapPin, ShieldAlert,
  Lock, ChevronRight, Eye, EyeOff, Archive, Share2, AlertTriangle, Scale,
  Trash2, RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { useEvidenceVault } from "@/hooks/useEvidenceVault";
import { shortenHash } from "@/hooks/useWallet";
import { formatBytes } from "@/lib/evidenceCrypto";
import { AppLanguage, copyFor } from "@/lib/locale";
import { hasReportNotes, saveEncryptedReportNotes, type EncryptedReportNoteRecord } from "@/lib/reportNotesVault";
import { hasPassword, verifyPassword } from "@/lib/userCredentials";
import { unlockWithPassword, type UnlockFailureReason } from "@/lib/keyVaultService";
import {
  listDeletedEvidence,
  restoreEvidence,
  DELETE_RETENTION_MS,
  type EvidenceRecord,
  type DeletedEvidenceRecord,
} from "@/lib/evidenceVaultService";
import { buildCourtPackage, courtPackageName } from "@/lib/evidenceExport";
import {
  gradeForFile,
  getCaptureLocation,
  getDeviceInfo,
  type CaptureLocation,
} from "@/lib/captureMetadata";

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

function GradeBadge({ grade, language }: { grade: 1 | 2; language: AppLanguage }) {
  return grade === 1 ? (
    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400">
      {copyFor(language, "Captured live", "现场取证")}
    </span>
  ) : (
    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
      {copyFor(language, "Added later", "事后导入")}
    </span>
  );
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
  onReset,
  onComplete,
  language,
}: {
  result: NonNullable<ReturnType<typeof useEvidenceVault>["result"]>;
  selectedSituation: SituationId;
  reportNotes: ReportNotes;
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
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-bold text-foreground">{copyFor(language, "Evidence Secured", "存证完成")}</p>
            <GradeBadge grade={record.captureGrade} language={language} />
          </div>
          <p className="text-xs text-muted-foreground">
            {getMimeIcon(record.meta.mimeType)} {getMimeLabel(record.meta.mimeType, language)} ·{" "}
            {formatBytes(record.meta.originalSize)} ·{" "}
            {new Date(record.clientTime).toLocaleString(language === "zh" ? "zh-CN" : "en-US")}
          </p>
        </div>
      </div>

      {/* Where it lives now — plain-language reassurance */}
      {record.syncStatus === "synced" ? (
        <div className="flex items-start gap-2 rounded-xl bg-sos-success/8 border border-sos-success/25 px-3 py-2.5">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-sos-success" />
          <p className="text-[11px] leading-4 text-muted-foreground">
            {copyFor(
              language,
              "Locked and saved to your cloud vault. Even if this phone is lost, sign in with your email and password to get it back. Nobody else can open it — not even us.",
              "已加密保存到你的云端保险柜。就算手机丢了，用邮箱和密码登录就能找回。除了你，任何人都打不开——包括我们。"
            )}
          </p>
        </div>
      ) : (
        <div className="flex items-start gap-2 rounded-xl bg-amber-500/8 border border-amber-500/20 px-3 py-2.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <p className="text-[11px] leading-4 text-amber-400/90">
            {copyFor(
              language,
              "No internet right now — saved on this phone, locked. It will upload to your cloud vault automatically when you're back online.",
              "现在没有网络——已加密存在这台手机上。等有网络时会自动上传到你的云端保险柜。"
            )}
          </p>
        </div>
      )}

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

            {/* Original file fingerprint (needed for future timestamp anchoring) */}
            <HashRow
              label={copyFor(language, "Original file fingerprint (SHA-256)", "原始文件指纹 (SHA-256)")}
              value={record.originalHash}
              short={shortenHash("0x" + record.originalHash.slice(0, 8) + record.originalHash.slice(-8))}
              language={language}
            />

            {/* Capture-instant metadata (from sealed meta — only this device can read it) */}
            {record.meta.capturedAt && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground">
                  {copyFor(language, "Captured at", "拍摄时间")}
                </p>
                <div className="rounded-lg bg-card px-3 py-2">
                  <p className="text-xs text-foreground">
                    {new Date(record.meta.capturedAt).toLocaleString(language === "zh" ? "zh-CN" : "en-US")}
                  </p>
                </div>
              </div>
            )}
            {record.meta.location && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground">
                  {copyFor(language, "Captured at location (only you can see this)", "拍摄地点（只有你能看到）")}
                </p>
                <div className="flex items-center gap-2 rounded-lg bg-card px-3 py-2">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <p className="text-xs text-foreground">
                    {record.meta.location.lat.toFixed(6)}, {record.meta.location.lng.toFixed(6)}
                    {record.meta.location.accuracy != null ? ` (±${record.meta.location.accuracy}m)` : ""}
                  </p>
                </div>
              </div>
            )}

            {/* Record ID */}
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground">
                {copyFor(language, "Record ID", "记录编号")}
              </p>
              <div className="flex items-center gap-2 rounded-lg bg-card px-3 py-2">
                <p className="flex-1 font-mono text-xs text-foreground truncate">
                  {record.txId.slice(0, 12)}…{record.txId.slice(-6)}
                </p>
                <button onClick={() => copyToClipboard(record.txId, language)}>
                  <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </div>
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
  const importInputRef = useRef<HTMLInputElement>(null);

  // Navigation within the evidence section
  const [view, setView] = useState<EvidenceView>("hub");

  // Capture sub-view state
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [showLegalTips, setShowLegalTips] = useState(false);

  // Notes sub-view state
  const [selectedSituation, setSelectedSituation] = useState<SituationId>("memory-gap");
  const [reportNotes, setReportNotes] = useState<ReportNotes>(() => emptyReportNotes());

  // Records unlock state
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [unlockPwd, setUnlockPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [unlockError, setUnlockError] = useState<UnlockFailureReason | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [hasPwd, setHasPwd] = useState<boolean | null>(null);

  // Check if user has a password when records view opens
  useEffect(() => {
    if (view !== "records") return;
    if (vault.canUseVault) {
      // Production: vault password always exists; also refresh the cloud index
      setHasPwd(true);
      void vault.refreshHistory();
      void vault.syncNow();
    } else if (userEmail && hasPwd === null) {
      hasPassword(userEmail).then(setHasPwd);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, userEmail, hasPwd, vault.canUseVault]);

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

  // Pre-warm a location fix when the capture view opens (same pattern as the
  // SOS button) so coordinates are ready at the capture instant. Best-effort:
  // denial or timeout never blocks saving evidence.
  const captureLocationRef = useRef<CaptureLocation | null>(null);
  useEffect(() => {
    if (view !== "capture") return;
    let cancelled = false;
    void getCaptureLocation().then((loc) => {
      if (!cancelled && loc) captureLocationRef.current = loc;
    });
    return () => {
      cancelled = true;
    };
  }, [view]);

  const audioRecorder = useAudioRecorder(
    (blob) =>
      // In-app recording is always grade 1 — the hash is computed the moment
      // the recording stops (processFile encrypts + hashes immediately).
      vault.processFile(blob, "audio/webm", {
        captureGrade: 1,
        capturedAt: new Date().toISOString(),
        location: captureLocationRef.current ?? undefined,
        deviceInfo: getDeviceInfo(),
      }),
    language
  );

  // Camera inputs (`capture="environment"`): trust the file's own timestamp —
  // a just-taken photo is grade 1, a gallery pick shows its age honestly.
  const handleCameraInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const grade = gradeForFile(file);
      vault.processFile(file, file.type, {
        fileName: file.name,
        captureGrade: grade,
        capturedAt: grade === 1 ? new Date(file.lastModified).toISOString() : undefined,
        location: grade === 1 ? captureLocationRef.current ?? undefined : undefined,
        deviceInfo: getDeviceInfo(),
      });
      e.target.value = "";
    },
    [vault]
  );

  // Explicit import path: always grade 2 (事后导入), no location attached —
  // where the user is when importing is not where the evidence happened.
  const handleImportInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      vault.processFile(file, file.type, {
        fileName: file.name,
        captureGrade: 2,
        deviceInfo: getDeviceInfo(),
      });
      e.target.value = "";
    },
    [vault]
  );

  const handleUnlock = async () => {
    setUnlocking(true);
    setUnlockError(null);
    // Production: re-verify against the vault's password box (privacy gate for
    // a phone grabbed while unlocked). Legacy fallback: local bcrypt check.
    if (vault.canUseVault && vault.userId) {
      const res = await unlockWithPassword(vault.userId, unlockPwd);
      setUnlocking(false);
      if (res.ok) setIsUnlocked(true);
      else setUnlockError(res.reason);
      return;
    }
    const ok = userEmail ? await verifyPassword(userEmail, unlockPwd) : true;
    setUnlocking(false);
    if (ok) setIsUnlocked(true);
    else setUnlockError("wrong-secret");
  };

  const isProcessing = vault.step === "encrypting" || vault.step === "saving";

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
                    "Photo, video, or audio — encrypted on the spot, with time and place recorded.",
                    "拍照、录像或录音，当场加密，并记下时间和地点。"
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
          <div className="space-y-2">
            <HowItWorksDisclosure
              open={showHowItWorks}
              onToggle={() => setShowHowItWorks((c) => !c)}
              language={language}
            />
            <LegalTipsDisclosure
              open={showLegalTips}
              onToggle={() => setShowLegalTips((c) => !c)}
              language={language}
            />
          </div>
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
              <input ref={photoInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleCameraInput} />
              <input ref={videoInputRef} type="file" accept="video/*" capture="environment" className="hidden" onChange={handleCameraInput} />

              {/* Import pre-existing files — honestly graded as 事后导入 */}
              <button
                onClick={() => importInputRef.current?.click()}
                className="col-span-3 rounded-2xl border border-dashed border-border bg-card/60 px-4 py-3 text-left active:scale-[0.98] transition-transform"
              >
                <div className="flex items-center gap-3">
                  <Download className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground">
                      {copyFor(language, "Import an existing photo, recording or file", "导入已有的照片、录音或文件")}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
                      {copyFor(
                        language,
                        "Imported records are honestly labeled \"added later\" — captured-live records carry more weight.",
                        "导入的记录会如实标注\"事后导入\"——当场拍摄的记录更有分量。"
                      )}
                    </p>
                  </div>
                </div>
              </button>
              <input ref={importInputRef} type="file" accept="image/*,video/*,audio/*,.pdf,.txt" className="hidden" onChange={handleImportInput} />

              <p className="col-span-3 text-center text-[11px] leading-4 text-muted-foreground">
                {copyFor(
                  language,
                  "Capture time and location are saved with the file and locked together. Only you can see them.",
                  "拍摄时间和所在位置会和文件一起加密保存，只有你自己能看到。"
                )}
              </p>
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
                label={copyFor(language, "Locking the file (AES-256 encryption)", "锁上文件（AES-256 加密）")}
                sublabel={copyFor(language, "Done on your phone. Nothing leaves unencrypted.", "在你的手机上完成，未加密的内容不会离开本机")}
                status={vault.steps.encrypting}
              />
              <StepRow
                label={copyFor(language, "Saving to your cloud vault", "存入你的云端保险柜")}
                sublabel={copyFor(language, "Only the locked file is stored. No one can open it but you.", "只保存加密后的文件，除了你没有人能打开")}
                status={vault.steps.saving}
              />
            </motion.div>
          )}

          {vault.step === "done" && vault.result && (
            <motion.div key="receipt" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <ReceiptCard
                result={vault.result}
                selectedSituation={selectedSituation}
                reportNotes={reportNotes}
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
                <p className="text-xs leading-5 text-destructive">
                  {unlockError === "vault-unavailable"
                    ? copyFor(
                        language,
                        "Couldn't open your vault right now. Check your connection and try again.",
                        "暂时打不开你的保险柜。请检查网络后再试。"
                      )
                    : copyFor(language, "Incorrect password. Please try again.", "密码错误，请再试一次。")}
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
      ) : showRecovery && vault.userId ? (
        <DeletedRecordsRecovery
          userId={vault.userId}
          language={language}
          onBack={() => setShowRecovery(false)}
          onRestored={() => void vault.refreshHistory()}
        />
      ) : (
        <>
          {vault.history.length === 0 && vault.legacyHistory.length === 0 ? (
            <div className="rounded-2xl border border-border/60 bg-card/50 p-6 text-center">
              <ShieldCheck className="mx-auto mb-2 h-8 w-8 text-primary/40" />
              <p className="text-sm text-muted-foreground">
                {copyFor(language, "No evidence records yet.", "暂无存证记录。")}
              </p>
            </div>
          ) : (
            <>
              {vault.history.length > 0 && vault.userId && (
                <CloudVaultHistory
                  records={vault.history}
                  userId={vault.userId}
                  onOpen={vault.openFile}
                  onDelete={vault.deleteRecord}
                  language={language}
                />
              )}
              {vault.legacyHistory.length > 0 && (
                <LegacyVaultHistory records={vault.legacyHistory} language={language} />
              )}
            </>
          )}
          {/* D-022: deliberately low-key — the delete path never hints that this exists */}
          {vault.canUseVault && (
            <button
              onClick={() => setShowRecovery(true)}
              className="mx-auto block pt-1 text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            >
              {copyFor(language, "Recover a mistakenly deleted record", "找回误删的记录")}
            </button>
          )}
        </>
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
      copyFor(language, "Encrypted on your device", "当场加密"),
      copyFor(language, "Files are encrypted on your device before anything is uploaded. Only you hold the key.", "文件先在你的设备上加密再上传，钥匙只在你手里"),
    ],
    [
      "☁️",
      copyFor(language, "Private cloud vault", "云端保险柜"),
      copyFor(language, "Encrypted files go into your private vault — the cloud only ever sees sealed content.", "加密后的文件存入你的私人保险柜，云端只能看到加密后的内容"),
    ],
    [
      "🕒",
      copyFor(language, "Fingerprint & time, fixed at capture", "指纹与时间当场固定"),
      copyFor(language, "The file's fingerprint and time are fixed the moment you capture — any later change is detectable. Trusted timestamping is being integrated.", "取证瞬间记下文件指纹和时间，此后任何改动都能被发现；可信时间戳服务接入中"),
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

function LegalTipsDisclosure({
  open,
  onToggle,
  language,
}: {
  open: boolean;
  onToggle: () => void;
  language: AppLanguage;
}) {
  const items: Array<[string, string, string]> = [
    [
      "🚔",
      copyFor(language, "Police records are strongest", "报警记录最有力"),
      copyFor(
        language,
        "Police reports and dispatch records are among the strongest evidence in court. For sexual assault, report promptly and get a forensic exam — avoid washing yourself or the clothing involved first. For domestic violence, also ask for a written warning (告诫书). Call the police when it is safe to do so.",
        "报警回执与出警记录是法院最认可的证据之一。遭遇性侵害的，尽快报警并接受人身检查最关键，报警前尽量不要洗澡或清洗衣物；属于家庭暴力的，还可要求公安出具告诫书。在安全的情况下尽量报警。"
      ),
    ],
    [
      "📷",
      copyFor(language, "Injury photos", "伤情拍摄"),
      copyFor(
        language,
        "Photograph injuries with your face and the wound in the same frame, from several angles. Seek medical care promptly and keep all records — a forensic injury assessment carries the most weight.",
        "拍摄伤情时让面部与伤处同框，多角度拍摄。尽快就医并保留病历，伤情鉴定的证明力最强。"
      ),
    ],
    [
      "💬",
      copyFor(language, "Chat records", "聊天记录"),
      copyFor(
        language,
        "Screenshots should include the other party's name/avatar and full context. Never delete the original conversation on your phone — courts may ask to verify it.",
        "截图需包含对方昵称/头像和完整上下文。不要删除手机里的原始对话，法院可能需要核对原始载体。"
      ),
    ],
    [
      "🎙",
      copyFor(language, "Audio & video", "录音录像"),
      copyFor(
        language,
        "When recording, try to capture the date, place and who is present. Recordings made to protect your own rights are generally admissible.",
        "录制时尽量说明或体现时间、地点和在场人。为维护自身权益的录音一般可作为证据。"
      ),
    ],
    [
      "🤝",
      copyFor(language, "Other evidence", "其他证据"),
      copyFor(
        language,
        "Witness statements, and help records from neighborhood committees, the Women's Federation (妇联) or hospitals also count as evidence.",
        "证人证言，以及居委会、妇联、医院的求助与接访记录同样可以作为证据。"
      ),
    ],
  ];

  return (
    <div className="space-y-2">
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="inline-flex min-h-0 items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
      >
        {copyFor(language, "What counts as evidence?", "哪些能作为证据？")}
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
            <div className="rounded-xl border border-border bg-card/50 px-4 py-3 space-y-2.5">
              {items.map(([icon, title, desc]) => (
                <div key={title} className="flex items-start gap-2.5 text-xs leading-5">
                  <span>{icon}</span>
                  <div>
                    <span className="font-semibold text-foreground">{title}</span>
                    <span className="text-muted-foreground"> — {desc}</span>
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

type VaultActionKind = "open" | "export" | "delete";

function CloudVaultHistory({
  records,
  userId,
  onOpen,
  onDelete,
  language,
}: {
  records: EvidenceRecord[];
  userId: string;
  onOpen: (record: EvidenceRecord) => Promise<Blob | null>;
  onDelete: (record: EvidenceRecord) => Promise<boolean>;
  language: AppLanguage;
}) {
  const [openingTx, setOpeningTx] = useState<string | null>(null);
  const [exportingTx, setExportingTx] = useState<string | null>(null);
  const [deletingTx, setDeletingTx] = useState<string | null>(null);
  // Every decrypt/delete re-asks for the password: an unlocked list on a
  // grabbed phone must not be enough to read or destroy evidence.
  const [pendingAction, setPendingAction] = useState<{ txId: string; kind: VaultActionKind } | null>(null);
  const [pwd, setPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [pwdError, setPwdError] = useState<UnlockFailureReason | null>(null);

  const requestAction = (record: EvidenceRecord, kind: VaultActionKind) => {
    setPendingAction({ txId: record.txId, kind });
    setPwd("");
    setPwdError(null);
  };

  const cancelAction = () => {
    setPendingAction(null);
    setPwd("");
    setPwdError(null);
  };

  const handleConfirm = async (record: EvidenceRecord) => {
    if (!pendingAction || verifying) return;
    setVerifying(true);
    setPwdError(null);
    const res = await unlockWithPassword(userId, pwd);
    setVerifying(false);
    if (!res.ok) {
      setPwdError(res.reason);
      return;
    }
    const kind = pendingAction.kind;
    cancelAction();
    if (kind === "open") await handleOpen(record);
    else if (kind === "export") await handleExport(record);
    else await handleDelete(record);
  };

  // D-022: deletion must look final — success copy never mentions recovery.
  const handleDelete = async (record: EvidenceRecord) => {
    setDeletingTx(record.txId);
    const ok = await onDelete(record);
    setDeletingTx(null);
    if (ok) {
      toast.success(copyFor(language, "Record deleted.", "已删除。"));
    } else {
      toast.error(copyFor(language, "Could not delete right now.", "暂时无法删除，请稍后再试。"));
    }
  };

  const handleExport = async (record: EvidenceRecord) => {
    setExportingTx(record.txId);
    try {
      const blob = await onOpen(record);
      if (!blob) {
        toast.error(
          copyFor(language, "Could not open this file right now.", "暂时无法打开这个文件，请稍后再试。")
        );
        return;
      }
      const pkg = await buildCourtPackage(record, blob);
      const url = URL.createObjectURL(pkg);
      const a = document.createElement("a");
      a.href = url;
      a.download = courtPackageName(record);
      a.click();
      URL.revokeObjectURL(url);
      toast.success(
        copyFor(
          language,
          "Court package saved: original file + description + how to verify. The encrypted copy stays in your vault.",
          "举证包已保存：原件 + 证据说明 + 校验方法。加密原件仍留在你的保险柜里。"
        )
      );
    } finally {
      setExportingTx(null);
    }
  };

  const handleOpen = async (record: EvidenceRecord) => {
    setOpeningTx(record.txId);
    const blob = await onOpen(record);
    setOpeningTx(null);
    if (!blob) {
      toast.error(
        copyFor(language, "Could not open this file right now.", "暂时无法打开这个文件，请稍后再试。")
      );
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download =
      record.meta.fileName ||
      `evidence-${record.clientTime.slice(0, 10)}.${(record.meta.mimeType.split("/")[1] ?? "bin").split(";")[0]}`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(
      copyFor(
        language,
        "File unlocked and saved to this device. Delete it after use if this phone isn't safe.",
        "文件已解锁并保存到本机。如果这台手机不安全，用完后记得删除。"
      )
    );
  };

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-bold text-foreground">
        {copyFor(language, "Cloud Vault", "云端保险柜")}
      </h3>
      {records.map((r) => (
        <div key={r.txId} className="rounded-xl border border-border bg-card p-3 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-base">{getMimeIcon(r.meta.mimeType)}</span>
            <span className="text-xs font-medium text-foreground">
              {getMimeLabel(r.meta.mimeType, language)} · {formatBytes(r.meta.originalSize)}
            </span>
            <span className="ml-auto" />
            <GradeBadge grade={r.captureGrade} language={language} />
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                r.syncStatus === "synced"
                  ? "bg-sos-success/15 text-sos-success"
                  : "bg-amber-500/15 text-amber-400"
              }`}
            >
              {r.syncStatus === "synced"
                ? copyFor(language, "In cloud vault ✓", "已进保险柜 ✓")
                : copyFor(language, "Waiting to upload", "等待上传")}
            </span>
          </div>
          <p className="font-mono text-[11px] text-muted-foreground">
            SHA-256: {r.encryptedHash.slice(0, 16)}…
          </p>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3 shrink-0" />
            <span>{new Date(r.clientTime).toLocaleString(language === "zh" ? "zh-CN" : "en-US")}</span>
            {pendingAction?.txId !== r.txId && (
              <>
                <button
                  onClick={() => requestAction(r, "export")}
                  disabled={exportingTx === r.txId || openingTx === r.txId || deletingTx === r.txId}
                  className="ml-auto flex items-center gap-1 text-primary disabled:opacity-60"
                >
                  {exportingTx === r.txId ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Scale className="h-3 w-3" />
                  )}
                  {copyFor(language, "Court package", "导出举证包")}
                </button>
                <button
                  onClick={() => requestAction(r, "open")}
                  disabled={openingTx === r.txId || exportingTx === r.txId || deletingTx === r.txId}
                  className="flex items-center gap-1 text-primary disabled:opacity-60"
                >
                  {openingTx === r.txId ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Download className="h-3 w-3" />
                  )}
                  {copyFor(language, "Unlock & save", "解锁查看")}
                </button>
                <button
                  onClick={() => requestAction(r, "delete")}
                  disabled={openingTx === r.txId || exportingTx === r.txId || deletingTx === r.txId}
                  aria-label={copyFor(language, "Delete", "删除")}
                  className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-60"
                >
                  {deletingTx === r.txId ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3" />
                  )}
                </button>
              </>
            )}
          </div>
          {pendingAction?.txId === r.txId && (
            <div className="space-y-2 pt-1">
              <p className="text-[11px] text-muted-foreground">
                {pendingAction.kind === "open"
                  ? copyFor(language, "Enter your password to unlock this file.", "输入密码后解锁查看这个文件。")
                  : pendingAction.kind === "export"
                    ? copyFor(language, "Enter your password to export the court package.", "输入密码后导出举证包。")
                    : copyFor(language, "Enter your password to delete this record.", "输入密码后删除这条记录。")}
              </p>
              <div className="relative">
                <input
                  value={pwd}
                  onChange={(e) => setPwd(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleConfirm(r)}
                  type={showPwd ? "text" : "password"}
                  placeholder={copyFor(language, "Password", "密码")}
                  autoFocus
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 pr-10 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
                />
                <button
                  onClick={() => setShowPwd((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPwd ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
              {pwdError && (
                <p className="text-[11px] leading-4 text-destructive">
                  {pwdError === "vault-unavailable"
                    ? copyFor(
                        language,
                        "Couldn't open your vault right now. Check your connection and try again.",
                        "暂时打不开你的保险柜。请检查网络后再试。"
                      )
                    : copyFor(language, "Incorrect password. Please try again.", "密码错误，请再试一次。")}
                </p>
              )}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleConfirm(r)}
                  disabled={!pwd || verifying}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold disabled:opacity-60 ${
                    pendingAction.kind === "delete"
                      ? "bg-destructive text-destructive-foreground"
                      : "bg-primary text-primary-foreground"
                  }`}
                >
                  {verifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
                  {pendingAction.kind === "delete"
                    ? copyFor(language, "Confirm delete", "确定删除")
                    : copyFor(language, "Confirm", "确认")}
                </button>
                <button
                  onClick={cancelAction}
                  disabled={verifying}
                  className="rounded-xl border border-border px-4 py-2 text-xs text-muted-foreground disabled:opacity-60"
                >
                  {copyFor(language, "Cancel", "取消")}
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// D-022: hidden recovery view. Reached only via the low-key entry line and a
// fresh password check, so a coerced "delete" stays invisible to an onlooker
// while the owner can quietly restore within 72h.
function DeletedRecordsRecovery({
  userId,
  language,
  onBack,
  onRestored,
}: {
  userId: string;
  language: AppLanguage;
  onBack: () => void;
  onRestored: () => void;
}) {
  const [pwd, setPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [checking, setChecking] = useState(false);
  const [pwdError, setPwdError] = useState<UnlockFailureReason | null>(null);
  const [records, setRecords] = useState<DeletedEvidenceRecord[] | null>(null);
  const [restoringTx, setRestoringTx] = useState<string | null>(null);

  const handleVerify = async () => {
    setChecking(true);
    setPwdError(null);
    const res = await unlockWithPassword(userId, pwd);
    if (res.ok) {
      setRecords(await listDeletedEvidence(userId).catch(() => []));
    } else {
      setPwdError(res.reason);
    }
    setChecking(false);
  };

  const handleRestore = async (rec: DeletedEvidenceRecord) => {
    setRestoringTx(rec.txId);
    const ok = await restoreEvidence(rec.txId);
    setRestoringTx(null);
    if (ok) {
      setRecords((prev) => (prev ?? []).filter((r) => r.txId !== rec.txId));
      onRestored();
      toast.success(copyFor(language, "Restored to your records.", "已恢复到存证记录。"));
    } else {
      toast.error(copyFor(language, "Could not restore right now.", "暂时无法恢复，请稍后再试。"));
    }
  };

  const remainingLabel = (deletedAt: string) => {
    const msLeft = DELETE_RETENTION_MS - (Date.now() - new Date(deletedAt).getTime());
    const hours = Math.max(1, Math.ceil(msLeft / 3_600_000));
    if (hours >= 24) {
      const days = Math.ceil(hours / 24);
      return copyFor(language, `Erased for good in about ${days} day${days > 1 ? "s" : ""}`, `约 ${days} 天后彻底清除`);
    }
    return copyFor(language, `Erased for good in about ${hours} hour${hours > 1 ? "s" : ""}`, `约 ${hours} 小时后彻底清除`);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="text-muted-foreground">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h3 className="text-sm font-bold text-foreground">
          {copyFor(language, "Recently deleted", "最近删除")}
        </h3>
      </div>

      {records === null ? (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <p className="text-xs leading-5 text-muted-foreground">
            {copyFor(
              language,
              "Enter your password again to see records deleted in the last 3 days.",
              "再次输入密码，查看最近 3 天内删除的记录。"
            )}
          </p>
          <div className="relative">
            <input
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && pwd && !checking && handleVerify()}
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
          {pwdError && (
            <p className="text-xs leading-5 text-destructive">
              {pwdError === "vault-unavailable"
                ? copyFor(
                    language,
                    "Couldn't open your vault right now. Check your connection and try again.",
                    "暂时打不开你的保险柜。请检查网络后再试。"
                  )
                : copyFor(language, "Incorrect password. Please try again.", "密码错误，请再试一次。")}
            </p>
          )}
          <button
            onClick={handleVerify}
            disabled={!pwd || checking}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            {copyFor(language, "Verify", "确认")}
          </button>
        </div>
      ) : records.length === 0 ? (
        <div className="rounded-2xl border border-border/60 bg-card/50 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            {copyFor(language, "Nothing to recover.", "没有可找回的记录。")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            {copyFor(
              language,
              "Records deleted more than 3 days ago are erased for good.",
              "删除超过 3 天的记录已彻底清除，无法找回。"
            )}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {records.map((r) => (
            <div key={r.txId} className="rounded-xl border border-border bg-card p-3 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-base">{getMimeIcon(r.meta.mimeType)}</span>
                <span className="text-xs font-medium text-foreground">
                  {getMimeLabel(r.meta.mimeType, language)} · {formatBytes(r.meta.originalSize)}
                </span>
                <span className="ml-auto" />
                <GradeBadge grade={r.captureGrade} language={language} />
              </div>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <Clock className="h-3 w-3 shrink-0" />
                <span>{remainingLabel(r.deletedAt)}</span>
                <button
                  onClick={() => handleRestore(r)}
                  disabled={restoringTx === r.txId}
                  className="ml-auto flex items-center gap-1 text-primary disabled:opacity-60"
                >
                  {restoringTx === r.txId ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RotateCcw className="h-3 w-3" />
                  )}
                  {copyFor(language, "Restore", "恢复")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LegacyVaultHistory({
  records,
  language,
}: {
  records: import("@/lib/localStorage").VaultRecord[];
  language: AppLanguage;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-bold text-foreground">
        {copyFor(language, "Older records (need your saved key file)", "旧版记录（需要你当时保存的密钥文件）")}
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
              {r.isSimulated ? copyFor(language, "Demo", "演示") : copyFor(language, "Test chain (legacy)", "测试链（旧版）")}
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


