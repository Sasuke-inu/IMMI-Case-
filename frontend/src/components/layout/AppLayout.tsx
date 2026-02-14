import { useState, useCallback } from "react"
import { Outlet } from "react-router-dom"
import { Sidebar } from "./Sidebar"
import { Topbar } from "./Topbar"
import { MobileNav } from "./MobileNav"
import { useKeyboard } from "@/hooks/use-keyboard"

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleSearchClick = useCallback(() => {
    const searchInput = document.querySelector<HTMLInputElement>(
      "[data-global-search]"
    )
    searchInput?.focus()
  }, [])

  useKeyboard({ onSearch: handleSearchClick })

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Mobile nav drawer */}
      <MobileNav open={mobileOpen} onClose={() => setMobileOpen(false)} />

      {/* Main content */}
      <div className="lg:pl-56">
        <Topbar
          onMenuClick={() => setMobileOpen(true)}
          onSearchClick={handleSearchClick}
        />
        <main className="mx-auto max-w-7xl p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
