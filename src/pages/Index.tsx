import { useState } from "react";
import { useZKPIdentity } from "@/hooks/useZKPIdentity";
import { useSilentMode } from "@/hooks/useSilentMode";
import SOSPage from "@/components/SOSPage";
import BottomNav, { type MainTab } from "@/components/BottomNav";
import EvidencePage from "@/components/EvidencePage";
import PsychPage from "@/components/PsychPage";
import LegalPage from "@/components/LegalPage";
import { useLocale, copyFor } from "@/lib/locale";
import FeedbackWidget from "@/components/FeedbackWidget";
import SettingsWidget from "@/components/SettingsWidget";
import LoginFlow from "@/components/LoginFlow";
import { signOut } from "@/lib/authService";
import { setSessionMasterKey } from "@/lib/keyVaultService";

const BRAND_BANNER_EN = "SECURE RECORD PROTECT SPEAK";
const BRAND_BANNER_ZH = "安全 记录 守护 发声";
const LOGO_SRC = "/the-unmuted-mark.png";

export default function Index() {
  const [activeTab, setActiveTab] = useState<MainTab>("sos");
  const { language, setLanguage } = useLocale();
  const identity = useZKPIdentity();
  const { isSilent, voiceDeterrent, customAudioUrl } = useSilentMode();
  const [pendingEmail, setPendingEmail] = useState("");
  // Master key lives only in memory (D-017), so every page load starts locked
  // even when the account session and local identity persist.
  const [unlocked, setUnlocked] = useState(false);

  const isSignedIn = unlocked && Boolean(identity.identity?.provider && identity.identity.commitment);

  const handleUnlocked = async (email: string) => {
    setPendingEmail(email);
    await identity.generateFromEmail(email, `password:${email}`, true);
    setUnlocked(true);
  };

  const handleLogout = () => {
    identity.revoke();
    setSessionMasterKey(null);
    void signOut();
    setPendingEmail("");
    setUnlocked(false);
  };

  return (
    <div className="flex h-[100dvh] min-h-0 flex-col bg-background">
      {/* Top bar — sits below the iOS status bar (safe-area-inset-top handled by body) */}
      <header className="flex shrink-0 items-center justify-between border-b border-border/80 px-3 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <img
            src={LOGO_SRC}
            alt=""
            className="h-9 w-9 shrink-0 object-contain drop-shadow-[0_0_14px_hsl(var(--primary)/0.28)]"
          />
          <div className="min-w-0 leading-tight">
            <span className="block text-[13px] font-black tracking-[0.06em] text-foreground">
              {copyFor(language, "THE UNMUTED", "非默")}
            </span>
            <span className="block whitespace-nowrap text-[9px] tracking-[0.08em] text-primary/80">
              {copyFor(language, BRAND_BANNER_EN, BRAND_BANNER_ZH)}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <FeedbackWidget language={language} />
          {isSignedIn && (
            <SettingsWidget language={language} onLogout={handleLogout} />
          )}
          <button
            onClick={() => setLanguage(language === "en" ? "zh" : "en")}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center whitespace-nowrap rounded-full border border-border bg-card/90 text-[11px] font-bold leading-none text-primary transition-colors hover:bg-accent"
          >
            {language === "en" ? "中" : "EN"}
          </button>
        </div>
      </header>

      {!isSignedIn ? (
        <LoginFlow language={language} onUnlocked={handleUnlocked} />
      ) : (
        <>
          {/* Main content scrolls above the bottom nav, which now participates in layout. */}
          <main className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-4">
            {activeTab === "sos" && (
              <SOSPage
                isSilent={isSilent}
                voiceDeterrent={voiceDeterrent}
                customAudioUrl={customAudioUrl}
                language={language}
              />
            )}
            {activeTab === "evidence" && (
              <EvidencePage language={language} userEmail={pendingEmail || undefined} />
            )}
            {activeTab === "psych" && <PsychPage language={language} />}
            {activeTab === "legal" && <LegalPage language={language} />}
          </main>

          {/* Bottom nav */}
          <BottomNav activeTab={activeTab} onTabChange={setActiveTab} language={language} />
        </>
      )}
    </div>
  );
}
