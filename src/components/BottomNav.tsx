import { Shield, Archive, Brain, Scale } from "lucide-react";
import { AppLanguage, copyFor } from "@/lib/locale";

export type MainTab = "sos" | "evidence" | "psych" | "legal";

interface BottomNavProps {
  activeTab: MainTab;
  onTabChange: (tab: MainTab) => void;
  language: AppLanguage;
}

const tabs = [
  { id: "sos"      as const, english: "Help",        chinese: "求助",   icon: Shield  },
  { id: "evidence" as const, english: "Evidence",    chinese: "存证",   icon: Archive },
  { id: "psych"    as const, english: "Mental Health", chinese: "心理援助", icon: Brain   },
  { id: "legal"    as const, english: "Legal Aid",   chinese: "法律援助", icon: Scale   },
];

export default function BottomNav({ activeTab, onTabChange, language }: BottomNavProps) {
  return (
    <nav
      aria-label={copyFor(language, "Main navigation", "主导航")}
      className="shrink-0 border-t border-border/80 bg-card/95 shadow-[0_-14px_38px_hsl(240_70%_4%/0.28)] backdrop-blur-xl"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-lg px-1.5 pt-1.5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-1 flex-col items-center gap-1 rounded-2xl px-1 py-2 text-[11px] font-semibold transition-all active:scale-95 ${
                isActive
                  ? "bg-primary/10 text-nav-active shadow-[0_0_20px_hsl(var(--primary)/0.12)]"
                  : "text-nav-inactive hover:bg-secondary/70 hover:text-foreground"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="whitespace-nowrap leading-none">
                {copyFor(language, tab.english, tab.chinese)}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
