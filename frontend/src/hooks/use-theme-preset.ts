import { useState, useEffect, useCallback } from "react"

export type PresetName = "parchment" | "ocean" | "forest" | "slate" | "rose"

interface ThemePreset {
  readonly label: string
  readonly colors: readonly [string, string, string, string] // preview dots
  readonly vars: Readonly<Record<string, string>>
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
    vars: {}, // empty = use tokens.css defaults
  },
  ocean: {
    label: "Ocean",
    colors: ["#0f2942", "#0077be", "#f0f6fa", "#cde0ed"],
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
  },
  forest: {
    label: "Forest",
    colors: ["#1b3426", "#2d7d46", "#f2f5f3", "#cdddd3"],
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
  },
  slate: {
    label: "Slate",
    colors: ["#1e293b", "#6366f1", "#f8fafc", "#e2e8f0"],
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
  },
  rose: {
    label: "Rose",
    colors: ["#3d1f2e", "#d97292", "#fdf5f7", "#f0d4dc"],
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
  },
}

const STORAGE_KEY = "theme-preset"

function applyPreset(name: PresetName) {
  const el = document.documentElement
  const vars = PRESETS[name].vars

  for (const v of CSS_VARS) {
    if (vars[v]) {
      el.style.setProperty(v, vars[v])
    } else {
      el.style.removeProperty(v)
    }
  }
}

export function useThemePreset() {
  const [preset, setPresetState] = useState<PresetName>(() => {
    if (typeof window === "undefined") return "parchment"
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored && stored in PRESETS ? (stored as PresetName) : "parchment"
  })

  useEffect(() => {
    applyPreset(preset)
    localStorage.setItem(STORAGE_KEY, preset)
  }, [preset])

  const setPreset = useCallback((name: PresetName) => {
    setPresetState(name)
  }, [])

  const resetPreset = useCallback(() => {
    setPresetState("parchment")
  }, [])

  return { preset, setPreset, resetPreset, presets: PRESETS } as const
}
