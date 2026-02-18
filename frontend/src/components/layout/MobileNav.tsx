import { NavLink } from "react-router-dom"
import { X, FileText } from "lucide-react"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"
import {
  LayoutDashboard,
  CloudDownload,
  Workflow,
  BookOpen,
  Palette,
  TrendingUp,
  Users,
} from "lucide-react"

interface NavItem {
  readonly to: string
  readonly icon: LucideIcon
  readonly label: string
  readonly description?: string
}

interface NavGroup {
  readonly title: string
  readonly items: readonly NavItem[]
}

const navGroups: readonly NavGroup[] = [
  {
    title: "Browse",
    items: [
      { to: "/", icon: LayoutDashboard, label: "Dashboard" },
      { to: "/analytics", icon: TrendingUp, label: "Analytics" },
      { to: "/judge-profiles", icon: Users, label: "Judge Profiles" },
      { to: "/cases", icon: FileText, label: "Cases" },
    ],
  },
  {
    title: "Data Tools",
    items: [
      {
        to: "/download",
        icon: CloudDownload,
        label: "Scrape AustLII",
        description: "Manual download by court & year",
      },
      {
        to: "/pipeline",
        icon: Workflow,
        label: "Smart Pipeline",
        description: "Auto 3-phase crawl → clean → download",
      },
    ],
  },
  {
    title: "Reference",
    items: [
      { to: "/data-dictionary", icon: BookOpen, label: "Data Dictionary" },
      { to: "/design-tokens", icon: Palette, label: "Design Tokens" },
    ],
  },
]

interface MobileNavProps {
  open: boolean
  onClose: () => void
}

export function MobileNav({ open, onClose }: MobileNavProps) {
  if (!open) return null

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
                        : "text-secondary-text hover:bg-surface hover:text-foreground"
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
  )
}
