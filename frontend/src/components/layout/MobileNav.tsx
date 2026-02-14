import { NavLink } from "react-router-dom"
import { X, FileText } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Search,
  Download,
  Database,
  GitBranch,
  BookOpen,
  Palette,
} from "lucide-react"

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/cases", icon: FileText, label: "Cases" },
  { to: "/search", icon: Search, label: "Search" },
  { to: "/download", icon: Download, label: "Download" },
  { to: "/update-db", icon: Database, label: "Update DB" },
  { to: "/pipeline", icon: GitBranch, label: "Pipeline" },
  { to: "/data-dictionary", icon: BookOpen, label: "Data Dictionary" },
  { to: "/design-tokens", icon: Palette, label: "Design Tokens" },
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
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              onClick={onClose}
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
        </nav>
      </div>
    </>
  )
}
