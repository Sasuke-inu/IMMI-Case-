/**
 * Type definitions for the AustLII scraper Worker.
 */

/** A single scraping job pushed to the Queue */
export interface ScrapeJob {
  case_id: string;
  url: string;
  citation: string;
  court_code: string;
  title: string;
}

/** Successful scrape result stored in R2 */
export interface ScrapeResult {
  case_id: string;
  url: string;
  citation: string;
  court_code: string;
  title: string;
  success: true;
  full_text: string;
  judges: string;
  date: string;
  catchwords: string;
  outcome: string;
  visa_type: string;
  legislation: string;
  scraped_at: string;
}

/** Failed scrape result stored in R2 errors/ prefix */
export interface ScrapeError {
  case_id: string;
  url: string;
  citation: string;
  court_code: string;
  title: string;
  success: false;
  error: string;
  error_code: number;
  scraped_at: string;
}

/** Environment bindings for the Worker */
export interface Env {
  SCRAPE_QUEUE: Queue<ScrapeJob>;
  CASE_RESULTS: R2Bucket;
  AUTH_TOKEN: string;
}

/** Batch enqueue request body */
export interface EnqueueRequest {
  jobs: ScrapeJob[];
}

/** Batch enqueue response */
export interface EnqueueResponse {
  queued: number;
  skipped: number;
  errors: string[];
}
