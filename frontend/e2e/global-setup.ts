/**
 * Playwright global setup: seed the isolated test data directory
 * with a minimal CSV so the server starts with some cases to browse.
 */
import fs from "node:fs"
import path from "node:path"

const TEST_DATA_DIR = "/tmp/immi_e2e_test_data"
const CASE_TEXTS_DIR = path.join(TEST_DATA_DIR, "case_texts")
const CSV_PATH = path.join(TEST_DATA_DIR, "immigration_cases.csv")

const SEED_CSV = `case_id,citation,title,court,court_code,date,year,url,judges,catchwords,outcome,visa_type,legislation,text_snippet,full_text_path,source,user_notes,tags,case_nature,legal_concepts
aabbccdd1122,[2024] AATA 100,Smith (Migration) [2024] AATA 100,Administrative Appeals Tribunal,AATA,15 January 2024,2024,https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/cth/AATA/2024/100,Senior Member Jones,MIGRATION - visa cancellation - character test,Affirmed,Subclass 866 Protection,Migration Act 1958 (Cth) s 501,The Tribunal affirms the decision under review.,,AustLII,,seed-data,Protection visa refusal,character test
aabbccdd3344,[2025] FCA 50,Minister for Immigration v Lee [2025] FCA 50,Federal Court of Australia,FCA,20 February 2025,2025,https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/cth/FCA/2025/50,Justice Brown,MIGRATION - judicial review - procedural fairness,Dismissed,Subclass 500 Student,Migration Act 1958 (Cth) s 476,The application for judicial review is dismissed.,,AustLII,,seed-data,Judicial review,procedural fairness
aabbccdd5566,[2025] ARTA 200,1234567 (Refugee) [2025] ARTA 200,Administrative Review Tribunal,ARTA,10 March 2025,2025,https://www.austlii.edu.au/cgi-bin/viewdoc/au/cases/cth/ARTA/2025/200,Member Williams,MIGRATION - protection visa - well-founded fear,Set aside and substituted,Subclass 866 Protection,Migration Act 1958 (Cth) s 36,The Tribunal sets aside the decision and substitutes.,,AustLII,,seed-data,Protection visa,well-founded fear
`

export default async function globalSetup() {
  // Create isolated test data directory
  fs.mkdirSync(CASE_TEXTS_DIR, { recursive: true })

  // Only seed if CSV doesn't exist (avoid overwriting between reruns)
  if (!fs.existsSync(CSV_PATH)) {
    fs.writeFileSync(CSV_PATH, SEED_CSV, "utf-8")
    console.log(`[e2e setup] Seeded test data at ${CSV_PATH}`)
  }
}
