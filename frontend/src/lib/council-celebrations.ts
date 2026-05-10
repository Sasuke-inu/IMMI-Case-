/**
 * frontend/src/lib/council-celebrations.ts
 *
 * Delight orchestration for the LLM Council — confetti, achievements,
 * sound cues, easter eggs. All effects honour prefers-reduced-motion
 * and are skippable. localStorage-tracked achievements persist across
 * sessions but degrade gracefully in incognito.
 *
 * Client-only (window/localStorage). Lazy-import in components.
 */

import confetti from "canvas-confetti";

// ---------------------------------------------------------------------------
// localStorage-backed counter (try-catch wrapped per project convention)
// ---------------------------------------------------------------------------

const COUNCIL_RUN_COUNT_KEY = "council:run-count";
const COUNCIL_LAST_RUN_KEY = "council:last-run";
const COUNCIL_STREAK_KEY = "council:streak";
const COUNCIL_THEME_UNLOCKED_KEY = "council:theme-unlocked";
const SOUND_OPT_IN_KEY = "council:sound-on";

function readCount(key: string): number {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return 0;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function writeCount(key: string, value: number): void {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* incognito or quota */
  }
}

function readString(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeString(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* incognito or quota */
  }
}

// ---------------------------------------------------------------------------
// Reduced-motion guard
// ---------------------------------------------------------------------------

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Detect environments where canvas-confetti will fail (e.g. JSDOM in
 * vitest, server-side rendering). Skipping confetti silently in these
 * contexts prevents unhandled exceptions during unit tests while
 * preserving the production effect.
 */
function canRunConfetti(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return typeof canvas.getContext === "function" && !!canvas.getContext("2d");
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Sound — Web Audio API tones (no asset deps). Muted by default; opt-in
// via toggleSound(). Tones suggest courtroom: gavel thunk, judgment ding.
// ---------------------------------------------------------------------------

export function isSoundOn(): boolean {
  return readString(SOUND_OPT_IN_KEY) === "1";
}

export function toggleSound(): boolean {
  const next = !isSoundOn();
  writeString(SOUND_OPT_IN_KEY, next ? "1" : "0");
  return next;
}

let cachedAudioCtx: AudioContext | null = null;
function getAudioCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    (window as unknown as {
      AudioContext?: typeof AudioContext;
      webkitAudioContext?: typeof AudioContext;
    }).AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  if (!cachedAudioCtx) cachedAudioCtx = new Ctor();
  return cachedAudioCtx;
}

/**
 * Play a brief tone. Honours user's sound-opt-in flag (default: muted).
 * @param kind  "gavel" | "ding" | "tap" | "verdict"
 */
export function playCue(
  kind: "gavel" | "ding" | "tap" | "verdict",
): void {
  if (!isSoundOn()) return;
  const ctx = getAudioCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => undefined);
  }

  const now = ctx.currentTime;

  if (kind === "gavel") {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.18);
    gain.gain.setValueAtTime(0.0, now);
    gain.gain.linearRampToValueAtTime(0.4, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
    return;
  }

  if (kind === "ding") {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, now);
    gain.gain.setValueAtTime(0.0, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.55);
    return;
  }

  if (kind === "tap") {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(2200, now);
    gain.gain.setValueAtTime(0.0, now);
    gain.gain.linearRampToValueAtTime(0.04, now + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.06);
    return;
  }

  if (kind === "verdict") {
    // Two-note solemn resolution
    const tone = (
      freq: number,
      start: number,
      dur: number,
      g: number,
    ) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + start);
      gain.gain.setValueAtTime(0, now + start);
      gain.gain.linearRampToValueAtTime(g, now + start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + dur + 0.05);
    };
    tone(660, 0, 0.4, 0.16);
    tone(880, 0.18, 0.6, 0.14);
    return;
  }
}

// ---------------------------------------------------------------------------
// Confetti — courtroom-tasteful palette (amber + navy + cream)
// ---------------------------------------------------------------------------

const COUNCIL_PALETTE = [
  "#d4a017",
  "#1b2838",
  "#f5f4f1",
  "#a86f0b",
  "#8b8580",
];

export function fireSubmitGavelBurst(): void {
  if (prefersReducedMotion()) return;
  if (!canRunConfetti()) return;
  // Downward burst from top-center suggesting a gavel strike
  confetti({
    particleCount: 30,
    spread: 40,
    startVelocity: 35,
    angle: 270, // straight down
    origin: { x: 0.5, y: 0 },
    colors: COUNCIL_PALETTE,
    scalar: 0.7,
    ticks: 80,
  });
}

export function fireCouncilDoneCelebration(): void {
  if (prefersReducedMotion()) return;
  if (!canRunConfetti()) return;
  // Two-side sweep — applause feel
  const end = Date.now() + 600;
  (function frame() {
    confetti({
      particleCount: 5,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.7 },
      colors: COUNCIL_PALETTE,
    });
    confetti({
      particleCount: 5,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.7 },
      colors: COUNCIL_PALETTE,
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}

export function fireFinalVerdictCelebration(label: string): void {
  if (prefersReducedMotion()) return;
  if (!canRunConfetti()) return;
  const intensity =
    label.toLowerCase() === "high"
      ? 1.3
      : label.toLowerCase() === "low"
        ? 0.6
        : 1.0;
  confetti({
    particleCount: Math.round(120 * intensity),
    spread: 100,
    startVelocity: 45,
    origin: { y: 0.55 },
    colors: COUNCIL_PALETTE,
    ticks: 200,
  });
  if (intensity > 1.1) {
    setTimeout(() => {
      confetti({
        particleCount: 40,
        angle: 60,
        spread: 80,
        origin: { x: 0, y: 0.8 },
        colors: COUNCIL_PALETTE,
      });
      confetti({
        particleCount: 40,
        angle: 120,
        spread: 80,
        origin: { x: 1, y: 0.8 },
        colors: COUNCIL_PALETTE,
      });
    }, 250);
  }
}

// ---------------------------------------------------------------------------
// Achievements — counted via localStorage; emit toast events via callback
// ---------------------------------------------------------------------------

export interface Achievement {
  id: string;
  title: string;
  body: string;
  emoji: string;
}

/**
 * Increment council run count, return any newly-unlocked achievement(s).
 * Pure side-effect on localStorage; caller decides how to present toasts.
 */
export function recordCouncilRun(): Achievement[] {
  const before = readCount(COUNCIL_RUN_COUNT_KEY);
  const after = before + 1;
  writeCount(COUNCIL_RUN_COUNT_KEY, after);

  // Streak — count consecutive distinct calendar days
  const today = new Date().toISOString().slice(0, 10);
  const last = readString(COUNCIL_LAST_RUN_KEY);
  let streak = readCount(COUNCIL_STREAK_KEY);
  if (last !== today) {
    if (last) {
      const yesterday = new Date(Date.now() - 86_400_000)
        .toISOString()
        .slice(0, 10);
      streak = last === yesterday ? streak + 1 : 1;
    } else {
      streak = 1;
    }
    writeCount(COUNCIL_STREAK_KEY, streak);
    writeString(COUNCIL_LAST_RUN_KEY, today);
  }

  const unlocked: Achievement[] = [];
  const milestones: Record<number, Achievement> = {
    1: {
      id: "first-council",
      title: "First Hearing",
      body: "You convened your first Council. Welcome to the panel.",
      emoji: "⚖️",
    },
    5: {
      id: "5-councils",
      title: "Junior Counsel",
      body: "5 hearings down. The bench knows your face.",
      emoji: "📜",
    },
    10: {
      id: "10-councils",
      title: "Senior Counsel",
      body: "10 hearings. Your research files are getting thick.",
      emoji: "🎓",
    },
    25: {
      id: "25-councils",
      title: "Silk",
      body: "25 hearings. Take silk — you've earned it.",
      emoji: "👑",
    },
    50: {
      id: "50-councils",
      title: "King's Counsel",
      body: "50 hearings. Your legal memory is now case-law-grade.",
      emoji: "🏛️",
    },
  };
  if (milestones[after]) unlocked.push(milestones[after]);
  if (streak === 3) {
    unlocked.push({
      id: "streak-3",
      title: "Three-Day Streak",
      body: "Three consecutive days. Diligence noted.",
      emoji: "🔥",
    });
  }
  if (streak === 7) {
    unlocked.push({
      id: "streak-7",
      title: "Weekly Bench",
      body: "Seven straight days of council. The court's regular.",
      emoji: "🗓️",
    });
  }
  return unlocked;
}

export function getCouncilStats(): { totalRuns: number; streak: number } {
  return {
    totalRuns: readCount(COUNCIL_RUN_COUNT_KEY),
    streak: readCount(COUNCIL_STREAK_KEY),
  };
}

// ---------------------------------------------------------------------------
// Easter egg: 5-tap on the Scale icon unlocks the "robe" theme
// ---------------------------------------------------------------------------

export function isRobeThemeUnlocked(): boolean {
  return readString(COUNCIL_THEME_UNLOCKED_KEY) === "robe";
}

export function unlockRobeTheme(): void {
  writeString(COUNCIL_THEME_UNLOCKED_KEY, "robe");
}

// ---------------------------------------------------------------------------
// Time-of-day theming — returns a salutation suited for Council header
// ---------------------------------------------------------------------------

export function timeOfDaySalutation(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Court is now in morning session.";
  if (h >= 12 && h < 17) return "Court is now in afternoon session.";
  if (h >= 17 && h < 22) return "Court is now in evening session.";
  return "Court is now in late session.";
}

// ---------------------------------------------------------------------------
// Token highlighter — finds legal-citation patterns in streaming text
// ---------------------------------------------------------------------------

const STATUTE_RE =
  /\b(?:s\s?\d+[A-Z]?(?:\([0-9a-z]+\))?(?:\s*Migration\s+Act\s+\d{4})?|Migration\s+Act\s+\d{4}|reg(?:ulation)?\s?\d+(?:\.\d+)?[A-Z]?)\b/g;

export function extractStatuteMatches(
  text: string,
): { index: number; length: number }[] {
  const out: { index: number; length: number }[] = [];
  if (!text) return out;
  STATUTE_RE.lastIndex = 0;
  let m;
  while ((m = STATUTE_RE.exec(text)) !== null) {
    out.push({ index: m.index, length: m[0].length });
    if (out.length >= 200) break;
  }
  return out;
}
