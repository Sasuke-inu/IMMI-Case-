import { NavLink } from "react-router-dom"
import {
  LayoutDashboard,
  FileText,
  Search,
  Download,
  Database,
  GitBranch,
  BookOpen,
  Palette,
} from "lucide-react"
import { cn } from "@/lib/utils"

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

interface SidebarProps {
  collapsed?: boolean
}

export function Sidebar({ collapsed = false }: SidebarProps) {
  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-30 flex h-screen flex-col border-r border-border bg-sidebar transition-all duration-200",
        collapsed ? "w-16" : "w-56"
      )}
    >
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <FileText className="h-6 w-6 shrink-0 text-accent" />
        {!collapsed && (
          <span className="font-heading text-lg font-semibold text-foreground">
            IMMI-Case
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-2">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-accent-muted text-accent"
                  : "text-secondary-text hover:bg-surface hover:text-foreground"
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-3">
        {!collapsed && (
          <p className="text-xs text-muted-text">
            Australian Immigration Cases
          </p>
        )}
      </div>
    </aside>
  )
}
