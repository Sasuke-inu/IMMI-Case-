import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { X, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  CloudDownload,
  Workflow,
  Activity,
  BookOpen,
  BookMarked,
  Palette,
  TrendingUp,
  Users,
} from "lucide-react";

interface NavItem {
  readonly to: string;
  readonly icon: LucideIcon;
  readonly label: string;
  readonly description?: string;
}

interface NavGroup {
  readonly title: string;
  readonly items: readonly NavItem[];
}

interface MobileNavProps {
  open: boolean;
  onClose: () => void;
}

export function MobileNav({ open, onClose }: MobileNavProps) {
  const { t } = useTranslation();

  if (!open) return null;

  const navGroups: readonly NavGroup[] = [
    {
      title: t("nav.browse"),
      items: [
        { to: "/", icon: LayoutDashboard, label: t("nav.dashboard") },
        { to: "/analytics", icon: TrendingUp, label: t("nav.analytics") },
        { to: "/judge-profiles", icon: Users, label: t("nav.judge_profiles") },
        { to: "/cases", icon: FileText, label: t("nav.cases") },
      ],
    },
    {
      title: t("nav.data_tools"),
      items: [
        {
          to: "/download",
          icon: CloudDownload,
          label: t("pipeline.download_title"),
          description: t("pipeline.download_description"),
        },
        {
          to: "/pipeline",
          icon: Workflow,
          label: t("pipeline.crawl_title"),
          description: t("pipeline.crawl_description"),
        },
        {
          to: "/jobs",
          icon: Activity,
          label: t("nav.jobs"),
        },
      ],
    },
    {
      title: t("nav.reference"),
      items: [
        {
          to: "/legislations",
          icon: BookMarked,
          label: t("nav.legislations"),
        },
        {
          to: "/data-dictionary",
          icon: BookOpen,
          label: t("nav.data_dictionary"),
        },
        { to: "/design-tokens", icon: Palette, label: t("nav.design_tokens") },
      ],
    },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
        onClick={onClose}
      />
      {/* Drawer */}
      <div className="fixed inset-y-0 left-0 z-50 w-64 bg-sidebar shadow-lg lg:hidden">
        <div className="flex h-14 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-accent" />
            <span className="font-heading text-lg font-semibold">
              IMMI-Case
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-secondary-text hover:bg-surface"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="p-2">
          {navGroups.map((group, gi) => (
            <div key={group.title} className={cn(gi > 0 && "mt-3")}>
              <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-text">
                {group.title}
              </p>
              {group.items.map(({ to, icon: Icon, label, description }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === "/"}
                  onClick={onClose}
                  title={description ?? label}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-accent-muted text-accent"
                        : "text-secondary-text hover:bg-surface hover:text-foreground",
                    )
                  }
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </div>
    </>
  );
}
