/**
 * Token build pipeline: tokens.json → tokens.css + tokens.ts
 * Run: npx tsx scripts/build-tokens.ts
 */
import { readFileSync, writeFileSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname_resolved = dirname(fileURLToPath(import.meta.url))
const tokensPath = resolve(__dirname_resolved, "../src/tokens/tokens.json")
const tokens = JSON.parse(readFileSync(tokensPath, "utf-8"))

// ─── Generate CSS custom properties ──────────────────────────────
function flattenColors(
  obj: Record<string, unknown>,
  prefix: string
): Array<[string, string]> {
  const result: Array<[string, string]> = []
  for (const [key, value] of Object.entries(obj)) {
    const varName =
      key === "DEFAULT" ? prefix : `${prefix}-${key.toLowerCase()}`
    if (typeof value === "string") {
      result.push([varName, value])
    } else if (typeof value === "object" && value !== null) {
      result.push(...flattenColors(value as Record<string, unknown>, varName))
    }
  }
  return result
}

const lightColors = flattenColors(
  Object.fromEntries(
    Object.entries(tokens.color).filter(([k]) => k !== "dark")
  ),
  "--color"
)
const darkColors = flattenColors(tokens.color.dark, "--color")

let css = `/* Auto-generated from tokens.json — do not edit manually */\n\n`
css += `:root {\n`
for (const [name, value] of lightColors) {
  css += `  ${name}: ${value};\n`
}
// Typography
for (const [key, fonts] of Object.entries(tokens.typography.fontFamily)) {
  css += `  --font-${key}: ${(fonts as string[]).map((f) => (f.includes(" ") ? `"${f}"` : f)).join(", ")};\n`
}
// Spacing
for (const [key, value] of Object.entries(tokens.spacing)) {
  css += `  --spacing-${key}: ${value};\n`
}
// Radius
for (const [key, value] of Object.entries(tokens.radius)) {
  const suffix = key === "DEFAULT" ? "" : `-${key}`
  css += `  --radius${suffix}: ${value};\n`
}
// Shadow
for (const [key, value] of Object.entries(tokens.shadow)) {
  const suffix = key === "DEFAULT" ? "" : `-${key}`
  css += `  --shadow${suffix}: ${value};\n`
}
css += `}\n\n`

css += `.dark {\n`
for (const [name, value] of darkColors) {
  // Map dark colors to the same variable names (without "dark" prefix)
  const lightName = name.replace("--color-", "--color-")
  css += `  ${lightName}: ${value};\n`
}
css += `}\n`

writeFileSync(resolve(__dirname_resolved, "../src/tokens/tokens.css"), css)

// ─── Generate TypeScript constants ───────────────────────────────
let ts = `/* Auto-generated from tokens.json — do not edit manually */\n\n`
ts += `export const tokens = ${JSON.stringify(tokens, null, 2)} as const\n\n`

// Flat color exports for Recharts etc.
ts += `export const courtColors: Record<string, string> = {\n`
for (const [court, color] of Object.entries(tokens.color.court)) {
  ts += `  ${court}: "${color}",\n`
}
ts += `} as const\n\n`

ts += `export const semanticColors = {\n`
for (const [key, color] of Object.entries(tokens.color.semantic)) {
  ts += `  ${key}: "${color}",\n`
}
ts += `} as const\n`

writeFileSync(resolve(__dirname_resolved, "../src/tokens/tokens.ts"), ts)

console.log("✓ tokens.css generated")
console.log("✓ tokens.ts generated")
