/**
 * Playwright global teardown: clean up the isolated test data directory.
 * This ensures no test artifacts persist between full test runs.
 */
import fs from "node:fs"

const TEST_DATA_DIR = "/tmp/immi_e2e_test_data"

export default async function globalTeardown() {
  if (fs.existsSync(TEST_DATA_DIR)) {
    fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true })
    console.log(`[e2e teardown] Cleaned up ${TEST_DATA_DIR}`)
  }
}
