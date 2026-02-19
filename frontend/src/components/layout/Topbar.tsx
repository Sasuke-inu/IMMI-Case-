import { Moon, Sun, Menu, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useThemePreset } from "@/hooks/use-theme-preset";
import { cn } from "@/lib/utils";

interface TopbarProps {
  onMenuClick: () => void;
  onSearchClick?: () => void;
}

export function Topbar({ onMenuClick, onSearchClick }: TopbarProps) {
  const { i18n } = useTranslation();
  const { isDark, toggleDark } = useThemePreset();
  const isZhTW = i18n.language === "zh-TW";

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-card/80 px-4 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="rounded-md p-1.5 text-secondary-text hover:bg-surface hover:text-foreground lg:hidden"
          aria-label="Toggle menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      <div className="flex items-center gap-2">
        {/* Search trigger */}
        <button
          onClick={onSearchClick}
          className={cn(
            "hidden items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-muted-text transition-colors hover:border-accent sm:flex",
          )}
        >
          <Search className="h-3.5 w-3.5" />
          <span>Search...</span>
          <kbd className="ml-4 rounded bg-card px-1.5 py-0.5 font-mono text-[10px] text-muted-text">
            /
          </kbd>
        </button>

        {/* Language toggle */}
        <button
          onClick={() => i18n.changeLanguage(isZhTW ? "en" : "zh-TW")}
          className="rounded-md px-2 py-1 text-xs font-medium text-muted-text hover:bg-surface hover:text-foreground border border-border transition-colors"
          title="Toggle language / 切換語言"
        >
          {isZhTW ? "EN" : "中文"}
        </button>

        {/* Theme toggle */}
        <button
          onClick={toggleDark}
          className="rounded-md p-1.5 text-secondary-text hover:bg-surface hover:text-foreground"
          aria-label="Toggle theme"
        >
          {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
      </div>
    </header>
  );
}
