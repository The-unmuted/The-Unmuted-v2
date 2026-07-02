/**
 * Unified emergency entry point.
 *
 * Primary path  → 5-step anonymous help-request flow (5.1 spec)
 * Secondary path → blockchain panic button (existing SOSButton)
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Loader2, Send, Shield, Users, Lock,
  Clock, CheckCircle2, X, UserPlus, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import SOSButton from "./SOSButton";
import { NGOSuggestionSheet } from "./NGOPage";
import {
  HELP_TYPE_CONFIG, SUPPORT_TYPE_CONFIG,
  type HelpType, type SupportType, type HelpRequest,
  createHelpRequest, broadcastHelpRequest, getFuzzyLocation,
} from "@/lib/supportNetwork";
import { sendMessage, subscribeRoom, type ChatMessage } from "@/lib/p2pChat";
import { useZKPIdentity } from "@/hooks/useZKPIdentity";
import { recordCommunityHelpMapAlert } from "@/lib/geoAlert";
import { AppLanguage, copyFor } from "@/lib/locale";
import { useEmergencyContacts } from "@/hooks/useEmergencyContacts";
import { useSosMessage, DEFAULT_TEMPLATE } from "@/hooks/useSosMessage";

// ── Types ──────────────────────────────────────────────────────────────────────

type PageView =
  | "home"
  | "help:type"
  | "help:location"
  | "help:support"
  | "matching"
  | "session";

interface FlowState {
  view:          PageView;
  helpType?:     HelpType;
  locationHint?: string;
  supportTypes?: SupportType[];
  request?:      HelpRequest;
}

export interface SOSPageProps {
  isSilent:          boolean;
  voiceDeterrent:    boolean;
  customAudioUrl:    string | null;
  language:          AppLanguage;
}

function helpLabel(helpType: HelpType | undefined, language: AppLanguage) {
  const config = HELP_TYPE_CONFIG.find(c => c.id === helpType);
  return config ? copyFor(language, config.labelEn, config.labelZh) : "";
}

function helpDesc(helpType: HelpType | undefined, language: AppLanguage) {
  const config = HELP_TYPE_CONFIG.find(c => c.id === helpType);
  return config ? copyFor(language, config.descEn, config.descZh) : "";
}

function supportLabel(supportType: SupportType | undefined, language: AppLanguage) {
  const config = SUPPORT_TYPE_CONFIG.find(c => c.id === supportType);
  return config ? copyFor(language, config.labelEn, config.labelZh) : "";
}

function supportDesc(supportType: SupportType | undefined, language: AppLanguage) {
  const config = SUPPORT_TYPE_CONFIG.find(c => c.id === supportType);
  return config ? copyFor(language, config.descEn, config.descZh) : "";
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function SOSPage(props: SOSPageProps) {
  const [flow, setFlow] = useState<FlowState>({ view: "home" });
  const [showNGOSuggestion, setShowNGOSuggestion] = useState(false);
  const zkp   = useZKPIdentity();
  const alias = zkp.alias ?? copyFor(props.language, "Anonymous user", "匿名用户");

  // Session chat state
  const [messages,  setMessages]  = useState<ChatMessage[]>([]);
  const [msgInput,  setMsgInput]  = useState("");
  const [sending,   setSending]   = useState(false);
  const unsubRef  = useRef<(() => void) | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const sessionCode = flow.view === "session" ? flow.request?.roomCode ?? null : null;

  useEffect(() => {
    if (!sessionCode) { unsubRef.current?.(); return; }
    unsubRef.current?.();
    setMessages([]);
    unsubRef.current = subscribeRoom(sessionCode, alias, (msg) => {
      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev, msg].sort((a, b) => a.timestamp - b.timestamp);
      });
    });
    return () => { unsubRef.current?.(); };
  }, [sessionCode, alias]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(async () => {
    if (!sessionCode || !msgInput.trim()) return;
    setSending(true);
    try {
      await sendMessage(sessionCode, alias, msgInput.trim());
      setMsgInput("");
    } finally { setSending(false); }
  }, [sessionCode, alias, msgInput]);

  const go = (next: Partial<FlowState>) =>
    setFlow(prev => ({ ...prev, ...next }));

  // ── View rendering ─────────────────────────────────────────────────────────

  return (
    <div className="flex flex-1 flex-col">
      <AnimatePresence>
        {showNGOSuggestion && (
          <NGOSuggestionSheet
            language={props.language}
            onClose={() => setShowNGOSuggestion(false)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence mode="wait">

        {/* ── Home ── */}
        {flow.view === "home" && (
          <Pane key="home">
            <HomeView
              onUserSafe={() => setShowNGOSuggestion(true)}
              language={props.language}
              isSilent={props.isSilent}
              voiceDeterrent={props.voiceDeterrent}
              customAudioUrl={props.customAudioUrl}
            />
          </Pane>
        )}

        {/* ── Step 1: Help type ── */}
        {flow.view === "help:type" && (
          <Pane key="help:type">
            <StepHeader step={1} total={3} onBack={() => go({ view: "home" })} />
            <div className="space-y-4 px-4 pb-6">
              <div>
                <h2 className="text-xl font-bold text-foreground">
                  {copyFor(props.language, "What happened?", "发生了什么？")}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {copyFor(props.language, "Choose the closest situation", "选择最接近的情况")}
                </p>
              </div>
              <div className="grid gap-3">
                {HELP_TYPE_CONFIG.map(c => (
                  <button
                    key={c.id}
                    onClick={() => go({ view: "help:location", helpType: c.id })}
                    className="flex items-center gap-4 rounded-2xl border border-border bg-card px-4 py-4 text-left active:scale-[0.98] transition-transform"
                  >
                    <span className="text-3xl">{c.icon}</span>
                    <div>
                      <p className="font-bold text-foreground">{helpLabel(c.id, props.language)}</p>
                      <p className="text-xs text-muted-foreground">{helpDesc(c.id, props.language)}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </Pane>
        )}

        {/* ── Step 2: Location ── */}
        {flow.view === "help:location" && (
          <Pane key="help:location">
            <LocationStep
              helpType={flow.helpType!}
              language={props.language}
              onBack={() => go({ view: "help:type" })}
              onNext={(loc) => go({ view: "help:support", locationHint: loc })}
            />
          </Pane>
        )}

        {/* ── Step 3: Support type ── */}
        {flow.view === "help:support" && (
          <Pane key="help:support">
            <SupportStep
              language={props.language}
              onBack={() => go({ view: "help:location" })}
              onNext={(types) => go({ view: "matching", supportTypes: types })}
            />
          </Pane>
        )}

        {/* ── Matching ── */}
        {flow.view === "matching" && (
          <Pane key="matching">
            <MatchingView
              flow={flow}
              language={props.language}
              onSession={(req) => go({ view: "session", request: req })}
              onCancel={() => { toast(copyFor(props.language, "Help request canceled", "已取消求助")); go({ view: "home" }); }}
            />
          </Pane>
        )}

        {/* ── Session ── */}
        {flow.view === "session" && flow.request && (
          <Pane key="session">
            <SessionView
              request={flow.request}
              alias={alias}
              messages={messages}
              msgInput={msgInput}
              setMsgInput={setMsgInput}
              sending={sending}
              onSend={handleSend}
              bottomRef={bottomRef}
              language={props.language}
              onEnd={() => {
                unsubRef.current?.();
                go({ view: "home" });
                setShowNGOSuggestion(true);
                toast(copyFor(props.language, "Support conversation ended safely", "支援对话已安全结束"));
              }}
            />
          </Pane>
        )}

      </AnimatePresence>
    </div>
  );
}

// ── Shared frame ───────────────────────────────────────────────────────────────

function Pane({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -16 }}
      transition={{ duration: 0.2 }}
      className="flex flex-1 flex-col"
    >
      {children}
    </motion.div>
  );
}

function StepHeader({
  step, total, onBack,
}: {
  step: number; total: number; onBack: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-3 px-4 py-3">
      <button onClick={onBack} className="text-muted-foreground">
        <ArrowLeft className="h-5 w-5" />
      </button>
      <div className="flex flex-1 gap-1.5">
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i < step ? "bg-primary" : "bg-border"
            }`}
          />
        ))}
      </div>
      <span className="text-xs text-muted-foreground">{step} / {total}</span>
    </div>
  );
}

// ── Home view ──────────────────────────────────────────────────────────────────

function HomeView({
  onUserSafe,
  language,
  isSilent,
  voiceDeterrent,
  customAudioUrl,
}: {
  onUserSafe: () => void;
  language: AppLanguage;
  isSilent: boolean;
  voiceDeterrent: boolean;
  customAudioUrl: string | null;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-5 py-6">
      <div className="flex w-full max-w-[25rem] items-center justify-center py-4">
        <SOSButton
          isSilent={isSilent}
          voiceDeterrent={voiceDeterrent}
          customAudioUrl={customAudioUrl}
          language={language}
          onUserSafe={onUserSafe}
        />
      </div>

      {/* Emergency contacts management card */}
      <EmergencyContactsCard language={language} />

      {/* Pre-set SOS message template card */}
      <SosMessageCard language={language} />

    </div>
  );
}

// ── Emergency Contacts Card ────────────────────────────────────────────────────

function EmergencyContactsCard({ language }: { language: AppLanguage }) {
  const { contacts, addContact, removeContact } = useEmergencyContacts();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [adding, setAdding] = useState(false);

  const handleAdd = () => {
    if (!name.trim() || !phone.trim()) return;
    addContact(name.trim(), phone.trim());
    setName("");
    setPhone("");
    setAdding(false);
  };

  return (
    <div className="w-full max-w-sm rounded-2xl border border-border/80 bg-card/92 px-5 py-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-foreground">
          {copyFor(language, "Emergency Contacts", "紧急联系人")}
        </p>
        <button
          onClick={() => setAdding((v) => !v)}
          className="flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <UserPlus className="h-3.5 w-3.5" />
          {copyFor(language, "Add", "添加")}
        </button>
      </div>

      <p className="text-xs leading-5 text-muted-foreground">
        {copyFor(
          language,
          "They'll receive an SMS with your location when you trigger SOS.",
          "SOS触发时，会向他们发送带有你位置的短信。"
        )}
      </p>

      <AnimatePresence>
        {adding && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-2 pt-1">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={copyFor(language, "Name", "姓名")}
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
              />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={copyFor(language, "Phone number", "手机号")}
                type="tel"
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
              />
              <button
                onClick={handleAdd}
                disabled={!name.trim() || !phone.trim()}
                className="w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
              >
                {copyFor(language, "Save contact", "保存联系人")}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {contacts.length === 0 ? (
        <p className="text-xs text-muted-foreground/70 italic">
          {copyFor(language, "No contacts yet. Add one above.", "暂无联系人，请点击添加。")}
        </p>
      ) : (
        <div className="space-y-2">
          {contacts.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2.5"
            >
              <div>
                <p className="text-sm font-semibold text-foreground">{c.name}</p>
                <p className="text-xs text-muted-foreground">{c.phone}</p>
              </div>
              <button
                onClick={() => removeContact(c.id)}
                className="rounded-lg p-1.5 text-muted-foreground hover:text-red-400 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── SOS Message Template Card ─────────────────────────────────────────────────

function SosMessageCard({ language }: { language: AppLanguage }) {
  const { template, setTemplate, reset } = useSosMessage();
  const isDefault = template === DEFAULT_TEMPLATE;

  return (
    <div className="w-full max-w-sm rounded-2xl border border-border/80 bg-card/92 px-5 py-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-foreground">
            {copyFor(language, "SOS Message", "求救信息")}
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {copyFor(
              language,
              "Edit to match your situation. {位置} will be replaced with your GPS coordinates.",
              "根据你的情况修改。{位置} 会自动替换成 GPS 坐标（可粘贴到任意地图 App）。"
            )}
          </p>
        </div>
        {!isDefault && (
          <button
            onClick={reset}
            className="shrink-0 text-xs text-muted-foreground underline hover:text-foreground transition-colors"
          >
            {copyFor(language, "Reset", "恢复默认")}
          </button>
        )}
      </div>

      <textarea
        value={template}
        onChange={(e) => setTemplate(e.target.value)}
        rows={6}
        className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary resize-none leading-6"
      />

      <p className="text-[11px] text-muted-foreground/60">
        {copyFor(
          language,
          "Tip: keep {位置} to include your GPS location automatically.",
          "提示：保留 {位置} 可自动插入你的 GPS 定位。"
        )}
      </p>
    </div>
  );
}

// ── Location step ──────────────────────────────────────────────────────────────

function LocationStep({
  helpType, language, onBack, onNext,
}: {
  helpType: HelpType;
  language: AppLanguage;
  onBack: () => void;
  onNext: (locationHint: string) => void;
}) {
  const [location, setLocation] = useState(copyFor(language, "Current area", "当前区域"));
  const [locating, setLocating] = useState(false);
  const typeConfig = HELP_TYPE_CONFIG.find(c => c.id === helpType);

  const handleAutoLocate = async () => {
    setLocating(true);
    try {
      const loc = await getFuzzyLocation(language);
      setLocation(loc);
    } finally { setLocating(false); }
  };

  return (
    <div className="flex flex-1 flex-col">
      <StepHeader step={2} total={3} onBack={onBack} />
      <div className="flex-1 space-y-5 px-4 pb-6">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="text-xl">{typeConfig?.icon}</span>
            <span className="text-sm font-semibold text-primary">{helpLabel(helpType, language)}</span>
          </div>
          <h2 className="text-xl font-bold text-foreground">
            {copyFor(language, "Where are you approximately?", "你大概在哪里？")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {copyFor(
              language,
              "Only used to match nearby supporters. Precise location is not recorded.",
              "仅用于匹配附近支援者，精确位置不会被记录"
            )}
          </p>
        </div>

        <input
          value={location}
          onChange={e => setLocation(e.target.value)}
          placeholder={copyFor(language, "City or area name", "城市或区域名称")}
          className="w-full rounded-2xl border border-border bg-card px-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
        />

        <button
          onClick={handleAutoLocate}
          disabled={locating}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card py-3 text-sm font-medium text-foreground disabled:opacity-50 active:scale-[0.98] transition-transform"
        >
          {locating
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <span>📍</span>}
          {copyFor(language, "Use approximate location", "自动获取大致位置")}
        </button>

        <p className="text-center text-[11px] text-muted-foreground">
          {copyFor(
            language,
            "Coordinates are rounded to about 11km precision. Exact location is not stored.",
            "坐标被四舍五入至约 11km 精度，不存储精确位置"
          )}
        </p>

        <button
          onClick={() => onNext(location.trim() || copyFor(language, "Current area", "当前区域"))}
          disabled={!location.trim()}
          className="mt-auto w-full rounded-2xl bg-primary py-4 text-base font-bold text-primary-foreground disabled:opacity-40 active:scale-[0.98] transition-transform"
        >
          {copyFor(language, "Next", "下一步")}
        </button>
      </div>
    </div>
  );
}

// ── Support type step ──────────────────────────────────────────────────────────

function SupportStep({
  language, onBack, onNext,
}: {
  language: AppLanguage;
  onBack: () => void;
  onNext: (types: SupportType[]) => void;
}) {
  const [selected, setSelected] = useState<SupportType[]>(["emotional"]);

  const toggle = (id: SupportType) =>
    setSelected(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );

  return (
    <div className="flex flex-1 flex-col">
      <StepHeader step={3} total={3} onBack={onBack} />
      <div className="flex-1 space-y-5 px-4 pb-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">
            {copyFor(language, "What support do you need?", "需要什么帮助？")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {copyFor(language, "Choose one or more", "可多选")}
          </p>
        </div>

        <div className="grid gap-3">
          {SUPPORT_TYPE_CONFIG.map(c => {
            const active = selected.includes(c.id);
            return (
              <button
                key={c.id}
                onClick={() => toggle(c.id)}
                className={`flex items-center gap-4 rounded-2xl border px-4 py-4 text-left transition-all active:scale-[0.98] ${
                  active
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card"
                }`}
              >
                <span className="text-3xl">{c.icon}</span>
                <div className="flex-1">
                  <p className={`font-bold ${active ? "text-primary" : "text-foreground"}`}>
                    {supportLabel(c.id, language)}
                  </p>
                  <p className="text-xs text-muted-foreground">{supportDesc(c.id, language)}</p>
                </div>
                {active && <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => onNext(selected)}
          disabled={selected.length === 0}
          className="mt-auto w-full rounded-2xl bg-primary py-4 text-base font-bold text-primary-foreground disabled:opacity-40 active:scale-[0.98] transition-transform"
        >
          {copyFor(language, "Find supporters", "寻找支援者")}
        </button>
      </div>
    </div>
  );
}

// ── Matching view ──────────────────────────────────────────────────────────────

function MatchingView({
  flow, language, onSession, onCancel,
}: {
  flow: FlowState;
  language: AppLanguage;
  onSession: (req: HelpRequest) => void;
  onCancel: () => void;
}) {
  const [phase, setPhase]     = useState<"searching" | "found">("searching");
  const [request, setRequest] = useState<HelpRequest | null>(null);

  useEffect(() => {
    let cancelled = false;

    const req = createHelpRequest(
      flow.helpType!,
      flow.supportTypes!,
      flow.locationHint!
    );
    broadcastHelpRequest(req);
    void recordCommunityHelpMapAlert({
      helpType: req.helpType,
      supportTypes: req.supportTypes,
      locationHint: req.locationHint,
    });
    setRequest(req);

    const timer = setTimeout(() => {
      if (!cancelled) setPhase("found");
    }, 3000);

    return () => { cancelled = true; clearTimeout(timer); };
  }, []);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-10">
      {phase === "searching" ? (
        <>
          <div className="relative flex h-32 w-32 items-center justify-center">
            {[0, 1, 2].map(i => (
              <motion.div
                key={i}
                className="absolute h-full w-full rounded-full border-2 border-primary/40"
                initial={{ scale: 0.5, opacity: 0.8 }}
                animate={{ scale: 1.8, opacity: 0 }}
                transition={{ duration: 2, repeat: Infinity, delay: i * 0.6, ease: "easeOut" }}
              />
            ))}
            <Users className="h-12 w-12 text-primary" />
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-foreground">
              {copyFor(language, "Matching supporters...", "正在匹配支援者…")}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {copyFor(language, "The system is finding trusted community members.", "系统正在为你寻找可信社区成员")}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="text-sm text-muted-foreground underline"
          >
            {copyFor(language, "Cancel", "取消")}
          </button>
        </>
      ) : (
        <>
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary/10">
            <CheckCircle2 className="h-12 w-12 text-primary" />
          </div>
          <div className="text-center">
            <p className="text-2xl font-black text-foreground">
              {copyFor(language, "3 supporters found", "找到 3 位支援者")}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {copyFor(language, "A private encrypted channel is ready.", "已准备好私密加密通道")}
            </p>
            <div className="mt-3 flex justify-center gap-2">
              {(flow.supportTypes ?? []).map(st => {
                const c = SUPPORT_TYPE_CONFIG.find(s => s.id === st);
                return (
                  <span
                    key={st}
                    className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"
                  >
                    {c?.icon} {supportLabel(st, language)}
                  </span>
                );
              })}
            </div>
          </div>
          <div className="w-full space-y-2">
            <button
              onClick={() => request && onSession(request)}
              disabled={!request}
              className="w-full rounded-2xl bg-primary py-4 text-base font-bold text-primary-foreground active:scale-[0.98] transition-transform"
            >
              {copyFor(language, "Enter support channel", "进入支援通道")}
            </button>
            <p className="text-center text-[11px] text-muted-foreground">
              <Lock className="mr-1 inline h-3 w-3" />
              {copyFor(language, "End-to-end encrypted · Chat expires after 2 hours", "端到端加密 · 对话 2 小时后自动过期")}
            </p>
          </div>
        </>
      )}
    </div>
  );
}

// ── Session view ───────────────────────────────────────────────────────────────

function SessionView({
  request, alias, messages, msgInput, setMsgInput,
  sending, onSend, bottomRef, language, onEnd,
}: {
  request:     HelpRequest;
  alias:       string;
  messages:    ChatMessage[];
  msgInput:    string;
  setMsgInput: (v: string) => void;
  sending:     boolean;
  onSend:      () => void;
  bottomRef:   React.RefObject<HTMLDivElement>;
  language:    AppLanguage;
  onEnd:       () => void;
}) {
  const typeConfig = HELP_TYPE_CONFIG.find(c => c.id === request.helpType);
  const minsLeft   = Math.max(0, Math.ceil((request.expiresAt - Date.now()) / 60000));

  return (
    <div className="flex flex-1 flex-col -mx-0">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-4 py-3">
        <span className="text-xl">{typeConfig?.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-bold text-foreground">{helpLabel(request.helpType, language)}</p>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{copyFor(language, `${minsLeft} min left`, `${minsLeft} 分钟后过期`)}</span>
            <span className="mx-1">·</span>
            <Lock className="h-3 w-3" />
            <span>{copyFor(language, "End-to-end encrypted", "端到端加密")}</span>
          </div>
        </div>
        <button
          onClick={onEnd}
          className="flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground active:scale-95 transition-transform"
        >
          <X className="h-3.5 w-3.5" />
          {copyFor(language, "I'm safe", "我已安全")}
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 px-4 py-4">
        {/* System message */}
        <div className="flex justify-center">
          <div className="rounded-full bg-card border border-border px-4 py-1.5 text-[11px] text-muted-foreground">
            {copyFor(language, "Encrypted channel ready · Supporters are standing by", "已建立加密通道 · 支援者已就绪")}
          </div>
        </div>

        {messages.map(msg => (
          <div key={msg.id} className={`flex flex-col gap-0.5 ${msg.isMine ? "items-end" : "items-start"}`}>
            <span className="px-1 text-[11px] text-muted-foreground">{msg.alias}</span>
            <div
              className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm ${
                msg.isMine
                  ? "rounded-tr-sm bg-primary text-primary-foreground"
                  : "rounded-tl-sm border border-border bg-card text-foreground"
              }`}
            >
              {msg.text}
            </div>
            <span className="px-1 text-[10px] text-muted-foreground/50">
              {new Date(msg.timestamp).toLocaleTimeString(language === "zh" ? "zh-CN" : "en-US", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        ))}

        {messages.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
            <Shield className="h-10 w-10 opacity-20" />
            <p className="text-sm font-medium">
              {copyFor(language, "The channel is encrypted. Waiting for supporters...", "通道已加密，等待支援者回应…")}
            </p>
            <p className="text-xs opacity-60">
              {copyFor(language, "You can describe your situation first.", "你可以先描述你的情况")}
            </p>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        className="shrink-0 flex gap-2 border-t border-border bg-card px-4 py-3"
      >
        <input
          value={msgInput}
          onChange={e => setMsgInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }}
          placeholder={copyFor(language, "Describe your situation...", "描述你的情况…")}
          className="flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
        />
        <button
          onClick={onSend}
          disabled={sending || !msgInput.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40 active:scale-95 transition-transform"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
