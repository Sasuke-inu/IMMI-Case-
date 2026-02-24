import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  FileText,
  CloudDownload,
  Workflow,
  Activity,
  BookOpen,
  BookMarked,
  Palette,
  TrendingUp,
  Users,
  Network,
  Bookmark,
  BookmarkCheck,
  Tags,
  Search,
  Scale,
} from "lucide-react";

export interface AppNavItem {
  readonly to: string;
  readonly icon: LucideIcon;
  readonly labelKey: string;
  readonly descriptionKey?: string;
  readonly showSavedSearchBadge?: boolean;
}

export interface AppNavGroup {
  readonly titleKey: string;
  readonly items: readonly AppNavItem[];
}

export const APP_NAV_GROUPS: readonly AppNavGroup[] = [
  {
    titleKey: "nav.browse",
    items: [
      { to: "/", icon: LayoutDashboard, labelKey: "nav.dashboard" },
      { to: "/analytics", icon: TrendingUp, labelKey: "nav.analytics" },
      { to: "/judge-profiles", icon: Users, labelKey: "nav.judge_profiles" },
      { to: "/court-lineage", icon: Network, labelKey: "nav.court_lineage" },
      { to: "/cases", icon: FileText, labelKey: "nav.cases" },
      {
        to: "/collections",
        icon: BookmarkCheck,
        labelKey: "nav.collections",
      },
      {
        to: "/saved-searches",
        icon: Bookmark,
        labelKey: "nav.saved_searches",
        showSavedSearchBadge: true,
      },
    ],
  },
  {
    titleKey: "nav.search",
    items: [
      { to: "/taxonomy", icon: Tags, labelKey: "nav.search_taxonomy" },
      { to: "/guided-search", icon: Search, labelKey: "nav.guided_search" },
      { to: "/llm-council", icon: Scale, labelKey: "nav.llm_council" },
    ],
  },
  {
    titleKey: "nav.data_tools",
    items: [
      {
        to: "/download",
        icon: CloudDownload,
        labelKey: "nav.download",
        descriptionKey: "nav_descriptions.download",
      },
      {
        to: "/pipeline",
        icon: Workflow,
        labelKey: "nav.pipeline",
        descriptionKey: "nav_descriptions.pipeline",
      },
      { to: "/jobs", icon: Activity, labelKey: "nav.jobs" },
    ],
  },
  {
    titleKey: "nav.reference",
    items: [
      {
        to: "/legislations",
        icon: BookMarked,
        labelKey: "nav.legislations",
      },
      {
        to: "/data-dictionary",
        icon: BookOpen,
        labelKey: "nav.data_dictionary",
      },
      { to: "/design-tokens", icon: Palette, labelKey: "nav.design_tokens" },
    ],
  },
];
