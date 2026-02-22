/**
 * Court lineage types and metadata for Australian immigration courts/tribunals
 *
 * Defines the structure for court succession over time:
 * - Lower court: FMCA (2000-2013) → FCCA (2013-2021) → FedCFamC2G (2021+)
 * - Tribunal: MRTA+RRTA (2000-2015) → AATA (2015-2024) → ARTA (2024+)
 */

/**
 * Metadata for a single court or tribunal
 */
export interface CourtMetadata {
  /** Court/tribunal code (e.g., "FMCA", "AATA") */
  code: string
  /** Full official name */
  name: string
  /** Year range [start_year, end_year] */
  years: [number, number]
  /** Case counts by year: { "2020": 123, "2021": 456, ... } */
  case_count_by_year: Record<string, number>
}

/**
 * Represents a transition from one court/tribunal to another
 */
export interface LineageTransition {
  /** Source court code */
  from: string
  /** Destination court code */
  to: string
  /** Year of transition */
  year: number
  /** Description of the transition (2-3 sentences) */
  description: string
}

/**
 * A lineage path showing succession of courts/tribunals over time
 */
export interface CourtLineage {
  /** Unique ID for this lineage ("lower-court" or "tribunal") */
  id: string
  /** Display name for this lineage */
  name: string
  /** Courts/tribunals in chronological order */
  courts: CourtMetadata[]
  /** Transitions between courts in this lineage */
  transitions: LineageTransition[]
}

/**
 * Complete API response structure from /api/v1/court-lineage
 */
export interface LineageData {
  /** Array of lineage paths (lower court and tribunal) */
  lineages: CourtLineage[]
  /** Total number of cases across all courts */
  total_cases: number
  /** Overall year range [min_year, max_year] */
  year_range: [number, number]
}

/**
 * Court codes for type safety
 */
export const COURT_CODES = [
  "FMCA",
  "FCCA",
  "FedCFamC2G",
  "MRTA",
  "RRTA",
  "AATA",
  "ARTA",
  "FCA",
  "HCA",
] as const

export type CourtCode = typeof COURT_CODES[number]

/**
 * Lineage IDs for type safety
 */
export const LINEAGE_IDS = ["lower-court", "tribunal"] as const

export type LineageId = typeof LINEAGE_IDS[number]
