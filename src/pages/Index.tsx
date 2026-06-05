import { useState } from "react";
import { useZKPIdentity } from "@/hooks/useZKPIdentity";
import { useSilentMode } from "@/hooks/useSilentMode";
import SOSPage from "@/components/SOSPage";
import BottomNav, { type MainTab } from "@/components/BottomNav";
import EvidencePage from "@/components/EvidencePage";
import PsychPage from "@/components/PsychPage";
import LegalPage from "@/components/LegalPage";
import { useLocale, copyFor } from "@/lib/locale";
import { Eye, EyeOff, KeyRound, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import FeedbackWidget from "@/components/FeedbackWidget";
import DonationWidget from "@/components/DonationWidget";
import SettingsWidget from "@/components/SettingsWidget";
import { hasPassword, verifyPassword, savePassword } from "@/lib/userCredentials";

const BRAND_BANNER_EN = "SECURE RECORD PROTECT SPEAK";
const BRAND_BANNER_ZH = "安全 记录 守护 发声";
const LOGO_SRC = "/the-unmuted-mark.png";

export default function Index() {
  const [activeTab, setActiveTab] = useState<MainTab>("sos");
  const { language, setLanguage } = useLocale();
  const identity = useZKPIdentity();
  const { isSilent, voiceDeterrent, customAudioUrl } = useSilentMode();
  type SignupMode = "idle" | "password-login" | "set-password";
  const [signupMode, setSignupMode] = useState<SignupMode>("idle");
  const [pendingEmail, setPendingEmail] = useState("");

  const isSignedIn = Boolean(identity.identity?.provider && identity.identity.commitment);

  const handleEmailSignup = async (email: string) => {
    const normalized = email.trim().toLowerCase();
    if (!normalized || !normalized.includes("@")) {
      toast.error(copyFor(language, "Enter a valid email address.", "请输入有效邮箱地址。"));
      return;
    }
    setPendingEmail(normalized);
    const hasPwd = await hasPassword(normalized);
    if (hasPwd) {
      setSignupMode("password-login");
    } else {
      // New user — generate a local identity then let them set a password
      await identity.generateFromEmail(normalized, `local:${normalized}`, false);
      setSignupMode("set-password");
    }
  };

  const handlePasswordLogin = async (password: string) => {
    const ok = await verifyPassword(pendingEmail, password);
    if (!ok) {
      toast.error(copyFor(language, "Incorrect password.", "密码错误。"));
      return;
    }
    await identity.generateFromEmail(pendingEmail, `password:${pendingEmail}`, true);
    toast.success(copyFor(language, "Welcome back!", "欢迎回来！"));
    setSignupMode("idle");
  };

  const handleSetPassword = async (password: string) => {
    if (password.length < 6) {
      toast.error(copyFor(language, "Password must be at least 6 characters.", "密码至少6位。"));
      return;
    }
    await savePassword(pendingEmail, password);
    // Upgrade identity to verified now that they have a password
    await identity.generateFromEmail(pendingEmail, `password:${pendingEmail}`, true);
    toast.success(copyFor(language, "Account created. Welcome!", "账号已创建，欢迎使用！"));
    setSignupMode("idle");
  };

  const handleLogout = () => {
    identity.revoke();
    setSignupMode("idle");
    setPendingEmail("");
  };

  return (
    <div className="flex h-[100dvh] min-h-0 flex-col bg-background">
      {/* Top bar — sits below the iOS status bar (safe-area-inset-top handled by body) */}
      <header className="flex shrink-0 items-center justify-between border-b border-border/80 px-4 py-3">
        <div className="flex items-center gap-3">
          <img
            src={LOGO_SRC}
            alt=""
            className="h-12 w-12 object-contain drop-shadow-[0_0_18px_hsl(var(--primary)/0.32)]"
          />
          <div className="leading-tight">
            <span className="block text-sm font-black tracking-[0.08em] text-foreground">
              {copyFor(language, "THE UNMUTED", "非默")}
            </span>
            <span className="block whitespace-nowrap text-[11px] tracking-[0.16em] text-primary/80">
              {copyFor(language, BRAND_BANNER_EN, BRAND_BANNER_ZH)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <DonationWidget language={language} />
          <FeedbackWidget language={language} />
          {isSignedIn && (
            <SettingsWidget
              language={language}
              email={pendingEmail}
              onLogout={handleLogout}
            />
          )}
          <button
            onClick={() => setLanguage(language === "en" ? "zh" : "en")}
            className="inline-flex shrink-0 min-w-[3.75rem] items-center justify-center whitespace-nowrap rounded-full border border-border bg-card/90 px-3 py-2 text-[11px] font-semibold leading-none text-primary transition-colors hover:bg-accent"
          >
            {language === "en" ? "中文" : "EN"}
          </button>
        </div>
      </header>

      {!isSignedIn || signupMode === "set-password" ? (
        <SignupPage
          language={language}
          loading={identity.generating}
          mode={signupMode}
          pendingEmail={pendingEmail}
          onEmailSignup={handleEmailSignup}
          onCancelEmail={() => setSignupMode("idle")}
          onPasswordLogin={handlePasswordLogin}
          onSetPassword={handleSetPassword}
          onSkipPassword={() => setSignupMode("idle")}
        />
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

function SignupPage({
  language,
  loading,
  mode,
  pendingEmail,
  onEmailSignup,
  onCancelEmail,
  onPasswordLogin,
  onSetPassword,
  onSkipPassword,
}: {
  language: "en" | "zh";
  loading: boolean;
  mode: "idle" | "password-login" | "set-password";
  pendingEmail: string;
  onEmailSignup: (email: string) => void;
  onCancelEmail: () => void;
  onPasswordLogin: (password: string) => void;
  onSetPassword: (password: string) => void;
  onSkipPassword: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const busy = loading;

  return (
    <main className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-10">
      <div className="w-full max-w-sm text-center">
        <img
          src={LOGO_SRC}
          alt=""
          className="mx-auto mb-6 h-24 w-24 object-contain drop-shadow-[0_0_34px_hsl(var(--primary)/0.34)]"
        />
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {copyFor(
            language,
            "Enter your email to create a private identity. The app will remember you next time.",
            "输入邮箱创建私密身份。之后再次打开会保持登录状态。"
          )}
        </p>

        <div className="mt-8 rounded-[1.75rem] border border-border bg-card/80 p-4 text-left">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
              <Mail className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">
                {copyFor(language, "Continue with email", "使用邮箱继续")}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {copyFor(language, "Your email is used as your identity. No verification email is sent.", "邮箱用于标识你的身份，不会发送验证邮件。")}
              </p>
            </div>
          </div>

          {/* Email input — idle state */}
          {mode === "idle" && (
            <div className="mt-4 space-y-3">
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onEmailSignup(email)}
                placeholder={copyFor(language, "Email address", "邮箱地址")}
                type="email"
                className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
              />
              <button
                onClick={() => onEmailSignup(email)}
                disabled={busy || !email.includes("@")}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-background py-3 text-sm font-bold text-foreground active:scale-[0.98] disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                {copyFor(language, "Continue", "继续")}
              </button>
            </div>
          )}

          {/* Password login — returning user */}
          {mode === "password-login" && (
            <div className="mt-4 space-y-3">
              <p className="text-xs text-muted-foreground">
                {copyFor(language, `Welcome back, ${pendingEmail}`, `欢迎回来，${pendingEmail}`)}
              </p>
              <div className="relative">
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && onPasswordLogin(password)}
                  placeholder={copyFor(language, "Password", "密码")}
                  type={showPwd ? "text" : "password"}
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 pr-11 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
                />
                <button
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <button
                onClick={() => onPasswordLogin(password)}
                disabled={!password || busy}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-60"
              >
                <KeyRound className="h-4 w-4" />
                {copyFor(language, "Sign in", "登录")}
              </button>
              <button onClick={onCancelEmail} className="w-full text-xs text-muted-foreground underline">
                {copyFor(language, "Use a different email", "使用其他邮箱")}
              </button>
            </div>
          )}
        </div>

        {/* Set password — new user */}
        {mode === "set-password" && (
          <div className="mt-5 rounded-[1.75rem] border border-primary/30 bg-primary/5 p-4 text-left">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                <KeyRound className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">
                  {copyFor(language, "Set a password", "设置密码")}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {copyFor(language, "You'll use this to sign in next time.", "下次直接用密码登录。")}
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              <div className="relative">
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && password.length >= 6 && onSetPassword(password)}
                  placeholder={copyFor(language, "Choose a password (min. 6 chars)", "设置密码（至少6位）")}
                  type={showPwd ? "text" : "password"}
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 pr-11 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
                />
                <button
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <button
                onClick={() => onSetPassword(password)}
                disabled={password.length < 6 || busy}
                className="w-full rounded-2xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : copyFor(language, "Create account", "创建账号")}
              </button>
              <button onClick={onSkipPassword} className="w-full text-xs text-muted-foreground underline">
                {copyFor(language, "Skip for now", "跳过")}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
