import { useCallback, useSyncExternalStore } from "react"

export type PresetName = "parchment" | "ocean" | "forest" | "slate" | "rose"

interface ThemePreset {
  readonly label: string
  readonly colors: readonly [string, string, string, string] // preview dots (light)
  readonly darkColors: readonly [string, string, string, string] // preview dots (dark)
  readonly vars: Readonly<Record<string, string>>
  readonly darkVars: Readonly<Record<string, string>>
}

const CSS_VARS = [
  "--color-primary",
  "--color-primary-light",
  "--color-primary-lighter",
  "--color-accent",
  "--color-accent-light",
  "--color-accent-muted",
  "--color-background",
  "--color-background-card",
  "--color-background-sidebar",
  "--color-background-surface",
  "--color-border",
  "--color-border-light",
  "--color-text",
  "--color-text-secondary",
  "--color-text-muted",
] as const

export const PRESETS: Record<PresetName, ThemePreset> = {
  parchment: {
    label: "Parchment",
    colors: ["#1b2838", "#b8860b", "#f5f4f1", "#e0ded8"],
    darkColors: ["#141a22", "#d4a017", "#1b2332", "#2a3545"],
    vars: {}, // empty = use tokens.css defaults
    darkVars: {}, // empty = use tokens.css .dark defaults
  },
  ocean: {
    label: "Ocean",
    colors: ["#0f2942", "#0077be", "#f0f6fa", "#cde0ed"],
    darkColors: ["#0a1929", "#2a9fd6", "#0f2137", "#1a3450"],
    vars: {
      "--color-primary": "#0f2942",
      "--color-primary-light": "#1a3d5c",
      "--color-primary-lighter": "#2a5a80",
      "--color-accent": "#0077be",
      "--color-accent-light": "#2a9fd6",
      "--color-accent-muted": "rgba(0,119,190,0.12)",
      "--color-background": "#f0f6fa",
      "--color-background-card": "#ffffff",
      "--color-background-sidebar": "#f5f9fc",
      "--color-background-surface": "#e8f1f8",
      "--color-border": "#cde0ed",
      "--color-border-light": "#dfeaf3",
      "--color-text": "#0f2942",
      "--color-text-secondary": "#3d5a73",
      "--color-text-muted": "#7a94a8",
    },
    darkVars: {
      "--color-primary": "#b0cfe0",
      "--color-primary-light": "#7aa8c4",
      "--color-primary-lighter": "#4d8ab0",
      "--color-accent": "#2a9fd6",
      "--color-accent-light": "#5bb8e0",
      "--color-accent-muted": "rgba(42,159,214,0.15)",
      "--color-background": "#0a1929",
      "--color-background-card": "#0f2137",
      "--color-background-sidebar": "#0c1c30",
      "--color-background-surface": "#142840",
      "--color-border": "#1a3450",
      "--color-border-light": "#1e3a58",
      "--color-text": "#d8e8f2",
      "--color-text-secondary": "#8fafc4",
      "--color-text-muted": "#567a94",
    },
  },
  forest: {
    label: "Forest",
    colors: ["#1b3426", "#2d7d46", "#f2f5f3", "#cdddd3"],
    darkColors: ["#0e1f16", "#3da55d", "#162419", "#1e3528"],
    vars: {
      "--color-primary": "#1b3426",
      "--color-primary-light": "#2a4d38",
      "--color-primary-lighter": "#3a6b4e",
      "--color-accent": "#2d7d46",
      "--color-accent-light": "#3da55d",
      "--color-accent-muted": "rgba(45,125,70,0.12)",
      "--color-background": "#f2f5f3",
      "--color-background-card": "#ffffff",
      "--color-background-sidebar": "#f6f9f7",
      "--color-background-surface": "#eaf0ec",
      "--color-border": "#cdddd3",
      "--color-border-light": "#dde9e1",
      "--color-text": "#1b3426",
      "--color-text-secondary": "#3d5a48",
      "--color-text-muted": "#7a9485",
    },
    darkVars: {
      "--color-primary": "#b0d4bc",
      "--color-primary-light": "#80b090",
      "--color-primary-lighter": "#5a9470",
      "--color-accent": "#3da55d",
      "--color-accent-light": "#5cc07a",
      "--color-accent-muted": "rgba(61,165,93,0.15)",
      "--color-background": "#0e1f16",
      "--color-background-card": "#162419",
      "--color-background-sidebar": "#111f15",
      "--color-background-surface": "#1e3528",
      "--color-border": "#254232",
      "--color-border-light": "#2d4d3a",
      "--color-text": "#d4e8da",
      "--color-text-secondary": "#8fb8a0",
      "--color-text-muted": "#567a64",
    },
  },
  slate: {
    label: "Slate",
    colors: ["#1e293b", "#6366f1", "#f8fafc", "#e2e8f0"],
    darkColors: ["#0f172a", "#818cf8", "#1e293b", "#334155"],
    vars: {
      "--color-primary": "#1e293b",
      "--color-primary-light": "#334155",
      "--color-primary-lighter": "#475569",
      "--color-accent": "#6366f1",
      "--color-accent-light": "#818cf8",
      "--color-accent-muted": "rgba(99,102,241,0.12)",
      "--color-background": "#f8fafc",
      "--color-background-card": "#ffffff",
      "--color-background-sidebar": "#f1f5f9",
      "--color-background-surface": "#f1f5f9",
      "--color-border": "#e2e8f0",
      "--color-border-light": "#eef2f7",
      "--color-text": "#1e293b",
      "--color-text-secondary": "#475569",
      "--color-text-muted": "#94a3b8",
    },
    darkVars: {
      "--color-primary": "#cbd5e1",
      "--color-primary-light": "#94a3b8",
      "--color-primary-lighter": "#64748b",
      "--color-accent": "#818cf8",
      "--color-accent-light": "#a5b4fc",
      "--color-accent-muted": "rgba(129,140,248,0.15)",
      "--color-background": "#0f172a",
      "--color-background-card": "#1e293b",
      "--color-background-sidebar": "#141d2e",
      "--color-background-surface": "#253348",
      "--color-border": "#334155",
      "--color-border-light": "#3b4c64",
      "--color-text": "#e2e8f0",
      "--color-text-secondary": "#94a3b8",
      "--color-text-muted": "#64748b",
    },
  },
  rose: {
    label: "Rose",
    colors: ["#3d1f2e", "#d97292", "#fdf5f7", "#f0d4dc"],
    darkColors: ["#1f0f17", "#e8a0b4", "#2a1520", "#3d2030"],
    vars: {
      "--color-primary": "#3d1f2e",
      "--color-primary-light": "#5c3347",
      "--color-primary-lighter": "#7a4a62",
      "--color-accent": "#d97292",
      "--color-accent-light": "#e8a0b4",
      "--color-accent-muted": "rgba(217,114,146,0.12)",
      "--color-background": "#fdf5f7",
      "--color-background-card": "#ffffff",
      "--color-background-sidebar": "#fdf8f9",
      "--color-background-surface": "#f9edf1",
      "--color-border": "#f0d4dc",
      "--color-border-light": "#f5e4ea",
      "--color-text": "#3d1f2e",
      "--color-text-secondary": "#6b4555",
      "--color-text-muted": "#a87d8e",
    },
    darkVars: {
      "--color-primary": "#e0c4cc",
      "--color-primary-light": "#c0909f",
      "--color-primary-lighter": "#a06878",
      "--color-accent": "#e8a0b4",
      "--color-accent-light": "#f0c0d0",
      "--color-accent-muted": "rgba(232,160,180,0.15)",
      "--color-background": "#1f0f17",
      "--color-background-card": "#2a1520",
      "--color-background-sidebar": "#24111b",
      "--color-background-surface": "#3d2030",
      "--color-border": "#4a2838",
      "--color-border-light": "#553040",
      "--color-text": "#f0dce2",
      "--color-text-secondary": "#c0909f",
      "--color-text-muted": "#886070",
    },
  },
}

const PRESET_KEY = "theme-preset"
const DARK_KEY = "theme-dark"

function applyPreset(name: PresetName, dark: boolean) {
  const el = document.documentElement
  const preset = PRESETS[name]
  const vars = dark ? preset.darkVars : preset.vars

  // Toggle .dark class
  el.classList.toggle("dark", dark)

  // Apply or clear each CSS var
  for (const v of CSS_VARS) {
    const val = vars[v]
    if (val) {
      el.style.setProperty(v, val)
    } else {
      el.style.removeProperty(v)
    }
  }
}

function readStoredPreset(): PresetName {
  if (typeof window === "undefined") return "parchment"
  const stored = localStorage.getItem(PRESET_KEY)
  return stored && stored in PRESETS ? (stored as PresetName) : "parchment"
}

function readStoredDark(): boolean {
  if (typeof window === "undefined") return false
  const stored = localStorage.getItem(DARK_KEY)
  if (stored !== null) return stored === "true"
  // Fall back to system preference
  return window.matchMedia("(prefers-color-scheme: dark)").matches
}

// ── Eagerly apply on module load (before React mounts) ──────────
const _initialPreset = readStoredPreset()
const _initialDark = readStoredDark()
applyPreset(_initialPreset, _initialDark)

// ── External store for cross-component sync ─────────────────────
type Listener = () => void
interface ThemeState {
  preset: PresetName
  isDark: boolean
}
let _state: ThemeState = { preset: _initialPreset, isDark: _initialDark }
const _listeners = new Set<Listener>()

function subscribe(listener: Listener): () => void {
  _listeners.add(listener)
  return () => _listeners.delete(listener)
}

function getSnapshot(): ThemeState {
  return _state
}

function setState(next: ThemeState) {
  if (_state.preset === next.preset && _state.isDark === next.isDark) return
  _state = next
  applyPreset(next.preset, next.isDark)
  localStorage.setItem(PRESET_KEY, next.preset)
  localStorage.setItem(DARK_KEY, String(next.isDark))
  _listeners.forEach((fn) => fn())
}

export function useThemePreset() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  const setPreset = useCallback((name: PresetName) => {
    setState({ ...getSnapshot(), preset: name })
  }, [])

  const setDark = useCallback((dark: boolean) => {
    setState({ ...getSnapshot(), isDark: dark })
  }, [])

  const toggleDark = useCallback(() => {
    const cur = getSnapshot()
    setState({ ...cur, isDark: !cur.isDark })
  }, [])

  const resetPreset = useCallback(() => {
    setState({ preset: "parchment", isDark: false })
  }, [])

  return {
    preset: state.preset,
    isDark: state.isDark,
    setPreset,
    setDark,
    toggleDark,
    resetPreset,
    presets: PRESETS,
  } as const
}
