import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, MessageSquare, AlertTriangle, PhoneCall } from "lucide-react";
import { playBeep, startDeterrentAudio, stopDeterrentAudio, isDeterrentPlaying_ } from "@/lib/audio";
import { addSOSHistory } from "@/lib/localStorage";
import { recordEmergencyMapAlert, reportZone } from "@/lib/geoAlert";
import { canPublishMapAlert } from "@/lib/reportTrust";
import { AppLanguage, copyFor } from "@/lib/locale";
import { toast } from "sonner";
import {
  useEmergencyContacts,
  loadContacts,
  buildSmsUri,
  type EmergencyContact,
  type LocationExtras,
} from "@/hooks/useEmergencyContacts";
import { loadSosTemplate } from "@/hooks/useSosMessage";

type SOSState = "idle" | "pressing" | "triggered" | "success" | "no-contacts";
const LOGO_SRC = "/sos-button-logo-cutout.png";

interface SOSButtonProps {
  isSilent: boolean;
  voiceDeterrent: boolean;
  customAudioUrl: string | null;
  language: AppLanguage;
  onUserSafe?: () => void;
}

export default function SOSButton({
  isSilent,
  voiceDeterrent,
  customAudioUrl,
  language,
  onUserSafe,
}: SOSButtonProps) {
  const [state, setState] = useState<SOSState>("idle");
  const [progress, setProgress] = useState(0);
  const [countdown, setCountdown] = useState(5);
  const [showSafeButton, setShowSafeButton] = useState(false);
  const [extraContacts, setExtraContacts] = useState<EmergencyContact[]>([]);
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({ lat: 0, lng: 0 });
  const [triggeredNote, setTriggeredNote] = useState<string>("");
  const [triggeredExtras, setTriggeredExtras] = useState<LocationExtras | undefined>(undefined);

  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const startTimeRef = useRef<number>(0);
  // GPS pre-warm: start watchPosition at press-start so hardware GPS has
  // 5 seconds to lock on before we actually need the coordinates.
  const gpsWatchRef = useRef<number | null>(null);
  const latestPositionRef = useRef<GeolocationPosition | null>(null);
  const { contacts } = useEmergencyContacts();

  const HOLD_DURATION = 5000;

  const triggerSOS = useCallback(async () => {
    setState("triggered");

    if (!isSilent) {
      playBeep();
      const flashEl = document.getElementById("screen-flash");
      if (flashEl) {
        flashEl.classList.add("screen-flash");
        flashEl.style.opacity = "0.5";
        setTimeout(() => {
          flashEl.classList.remove("screen-flash");
          flashEl.style.opacity = "0";
        }, 300);
      }
    }

    let lat = 0, lng = 0;
    let accuracy: number | undefined;

    // Stop the pre-warm watcher (started at press-down)
    if (gpsWatchRef.current !== null) {
      navigator.geolocation.clearWatch(gpsWatchRef.current);
      gpsWatchRef.current = null;
    }

    // Use the pre-warmed position if fresh (acquired during the 5-second hold)
    const prewarmed = latestPositionRef.current;
    latestPositionRef.current = null;

    // Fetch battery in parallel with any remaining GPS work
    const battPromise = (navigator as unknown as { getBattery?: () => Promise<{ level: number }> })
      .getBattery?.() ?? Promise.reject();

    if (prewarmed && Date.now() - prewarmed.timestamp < 30_000) {
      // Great — use the already-precise pre-warmed fix
      lat = prewarmed.coords.latitude;
      lng = prewarmed.coords.longitude;
      accuracy = prewarmed.coords.accuracy ?? undefined;
    } else {
      // Fallback: cold request with a shorter timeout (user already waited 5s)
      const [posResult] = await Promise.allSettled([
        new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0,
          })
        ),
      ]);
      if (posResult.status === "fulfilled") {
        lat = posResult.value.coords.latitude;
        lng = posResult.value.coords.longitude;
        accuracy = posResult.value.coords.accuracy ?? undefined;
      }
    }

    const [battResult] = await Promise.allSettled([battPromise]);

    // Device status for rescuers
    const battery =
      battResult.status === "fulfilled"
        ? Math.round((battResult.value as { level: number }).level * 100)
        : undefined;
    const network =
      (navigator as unknown as { connection?: { effectiveType?: string } })
        .connection?.effectiveType ?? undefined;

    const extras: LocationExtras = { accuracy, battery, network };

    setCoords({ lat, lng });
    setTriggeredExtras(extras);

    addSOSHistory({
      latitude: Math.round(lat * 1_000_000),
      longitude: Math.round(lng * 1_000_000),
      timestamp: Math.floor(Date.now() / 1000),
      status: "pending",
    });

    if (voiceDeterrent && !isSilent) {
      startDeterrentAudio(customAudioUrl, language);
      setShowSafeButton(true);
    }

    if (lat !== 0 || lng !== 0) {
      recordEmergencyMapAlert(lat, lng);
    }
    if (canPublishMapAlert() && (lat !== 0 || lng !== 0)) {
      void reportZone(lat, lng, "emergency");
    }

    // Read fresh contacts from localStorage at trigger time to avoid stale React state
    const freshContacts = loadContacts();

    if (freshContacts.length === 0) {
      setState("no-contacts");
      if (!isSilent) {
        toast(copyFor(language, "⚠️ No emergency contacts set.", "⚠️ 尚未设置紧急联系人。"));
      }
      return;
    }

    // Read pre-set message template (also fresh from localStorage)
    const situationNote = loadSosTemplate();

    // Open SMS for first contact immediately (with full location block)
    const [first, ...rest] = freshContacts;
    const uri = buildSmsUri(first, lat, lng, situationNote, extras);
    window.location.href = uri;

    setTriggeredNote(situationNote);
    setExtraContacts(rest);
    setState("success");

    if (!isSilent) {
      toast.success(
        copyFor(language, `SMS opening for ${first.name}`, `正在向 ${first.name} 发送短信`)
      );
    }
  }, [contacts, isSilent, voiceDeterrent, customAudioUrl, language]);

  const handlePointerDown = useCallback(() => {
    if (state === "triggered" || state === "success") return;
    setState("pressing");
    setProgress(0);
    setCountdown(5);
    startTimeRef.current = Date.now();

    // ── GPS pre-warm ──────────────────────────────────────────────────────────
    // Start watchPosition immediately so the GPS hardware has the full 5-second
    // hold period to lock on. By trigger time we'll have a much more accurate
    // fix than a cold getCurrentPosition call would give.
    if (navigator.geolocation && gpsWatchRef.current === null) {
      gpsWatchRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          // Keep the most recent (most accurate) fix
          const prev = latestPositionRef.current;
          if (!prev || pos.coords.accuracy < prev.coords.accuracy) {
            latestPositionRef.current = pos;
          }
        },
        () => { /* ignore errors during pre-warm */ },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    }

    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const pct = Math.min(elapsed / HOLD_DURATION, 1);
      setProgress(pct);
      setCountdown(Math.max(0, 5 - Math.floor(elapsed / 1000)));

      if (pct >= 1) {
        clearInterval(intervalRef.current);
        triggerSOS();
      }
    }, 30);
  }, [state, triggerSOS]);

  const handlePointerUp = useCallback(() => {
    if (state === "pressing") {
      clearInterval(intervalRef.current);
      // Cancel GPS pre-warm — user released early
      if (gpsWatchRef.current !== null) {
        navigator.geolocation.clearWatch(gpsWatchRef.current);
        gpsWatchRef.current = null;
        latestPositionRef.current = null;
      }
      setState("idle");
      setProgress(0);
      setCountdown(5);
    }
  }, [state]);

  const handleSafe = () => {
    stopDeterrentAudio();
    setShowSafeButton(false);
    setState("idle");
    setProgress(0);
    setExtraContacts([]);
    setTriggeredNote("");
    setTriggeredExtras(undefined);
    onUserSafe?.();
  };

  const resetAfterDelay = () => {
    setTimeout(() => {
      if (!isDeterrentPlaying_()) {
        setState("idle");
        setProgress(0);
        setExtraContacts([]);
      }
    }, 10000);
  };

  if (state === "success" || state === "no-contacts") {
    resetAfterDelay();
  }

  const glowClass = {
    idle: "drop-shadow-[0_0_34px_hsl(var(--sos-glow))]",
    pressing: "drop-shadow-[0_0_34px_hsl(var(--sos-pressing-glow))]",
    triggered: "drop-shadow-[0_0_34px_hsl(var(--sos-glow))]",
    success: "drop-shadow-[0_0_34px_hsl(var(--sos-success-glow))]",
    "no-contacts": "drop-shadow-[0_0_28px_hsl(45_93%_58%/0.3)]",
  }[state];

  return (
    <div className="flex w-full flex-col items-center justify-center px-1">
      <div
        id="screen-flash"
        className="pointer-events-none fixed inset-0 z-[100] bg-primary opacity-0 transition-opacity"
      />

      <motion.button
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className={`relative aspect-square w-[80vw] max-w-[360px] select-none overflow-visible rounded-[2rem] bg-transparent ${glowClass} transition-colors duration-500`}
        whileTap={state === "idle" ? { scale: 0.95 } : {}}
        style={{ touchAction: "none" }}
      >
        <img
          src={LOGO_SRC}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-full w-full -translate-x-1/2 -translate-y-1/2 object-contain opacity-100 drop-shadow-[0_0_42px_hsl(320_100%_78%/0.26)] [filter:saturate(1.16)_contrast(1.05)_brightness(1.04)]"
        />

        {state === "pressing" && (
          <svg className="absolute inset-0 z-20 h-full w-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="46" fill="none" stroke="hsl(var(--foreground) / 0.15)" strokeWidth="3" />
            <motion.circle
              cx="50" cy="50" r="46" fill="none" stroke="hsl(var(--foreground))" strokeWidth="3"
              strokeLinecap="round" strokeDasharray={289} strokeDashoffset={289 * (1 - progress)}
            />
          </svg>
        )}

        <div className="relative z-10 flex h-full flex-col items-center justify-center gap-2">
          <AnimatePresence mode="wait">
            {state === "idle" && (
              <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            )}
            {state === "pressing" && (
              <motion.div key="pressing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-1">
                <span className="text-7xl font-black text-primary-foreground">{countdown}</span>
                <span className="text-sm text-primary-foreground/80">{Math.round(progress * 100)}%</span>
              </motion.div>
            )}
            {state === "triggered" && (
              <motion.div key="triggered" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-2">
                <MessageSquare className="h-14 w-14 animate-pulse text-primary-foreground" />
                <span className="text-sm font-medium text-primary-foreground/80">
                  {copyFor(language, "Opening SMS...", "正在打开短信...")}
                </span>
              </motion.div>
            )}
            {state === "success" && (
              <motion.div key="success" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-2">
                <Check className="h-16 w-16 text-primary-foreground" strokeWidth={3} />
                <span className="text-lg font-bold text-primary-foreground">
                  {copyFor(language, "SMS Sent", "短信已发送")}
                </span>
              </motion.div>
            )}
            {state === "no-contacts" && (
              <motion.div key="no-contacts" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-2">
                <AlertTriangle className="h-14 w-14 text-background" />
                <span className="text-sm font-bold text-background">
                  {copyFor(language, "No Contacts Set", "未设置联系人")}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.button>

      {state === "idle" && (
        <p className="mt-3 text-center text-xs font-semibold uppercase tracking-[0.16em] text-primary/85">
          {copyFor(language, "SOS: Emergency Alert", "SOS：紧急求救")}
        </p>
      )}

      <p className="mt-2 text-center text-sm text-muted-foreground">
        {state === "idle" && copyFor(language, "Hold for 5 seconds to send SMS alert", "长按 5 秒发送短信求救")}
        {state === "pressing" && copyFor(language, "Keep holding...", "继续按住...")}
        {state === "triggered" && copyFor(language, "Getting location and opening SMS", "正在获取位置并打开短信")}
        {state === "success" && copyFor(language, "SMS app opened with your location", "短信已附上你的位置")}
        {state === "no-contacts" && copyFor(language, "Add emergency contacts below", "请在下方添加紧急联系人")}
      </p>

      {/* Extra contacts (2nd, 3rd…) shown as tap-able SMS links */}
      <AnimatePresence>
        {state === "success" && extraContacts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 w-full max-w-xs space-y-2"
          >
            <p className="text-center text-xs text-muted-foreground">
              {copyFor(language, "Also alert:", "同时通知：")}
            </p>
            {extraContacts.map((c) => (
              <a
                key={c.id}
                href={buildSmsUri(c, coords.lat, coords.lng, triggeredNote, triggeredExtras)}
                className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card py-3 text-sm font-semibold text-foreground active:scale-95 transition-transform"
              >
                <PhoneCall className="h-4 w-4 text-primary" />
                {c.name}
              </a>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSafeButton && (
          <motion.button
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            onClick={handleSafe}
            className="mt-6 rounded-full bg-sos-success px-8 py-3 text-base font-bold text-primary-foreground"
          >
            {copyFor(language, "I'm Safe", "我已安全")}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
