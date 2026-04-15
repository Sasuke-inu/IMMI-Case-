/**
 * Cloudflare Worker: IMMI Case API + Flask Container Proxy
 *
 * Read path (fast, no cold start):
 *   GET /api/v1/cases            → Hyperdrive → Supabase PostgreSQL
 *   GET /api/v1/cases/count      → Hyperdrive → Supabase PostgreSQL
 *   GET /api/v1/cases/:id        → Hyperdrive → Supabase PostgreSQL
 *   GET /api/v1/stats            → Hyperdrive → Supabase PostgreSQL (parallel aggregates)
 *   GET /api/v1/filter-options   → Hyperdrive → Supabase PostgreSQL (DISTINCT values)
 *
 * Write / complex path (Flask Container):
 *   POST/PUT/DELETE /api/v1/*    → Flask Container (write operations)
 *   GET /api/v1/analytics/*      → Flask Container (numpy-heavy aggregations)
 *   GET /api/v1/search           → Flask Container (semantic/LLM search)
 *   GET /api/v1/csrf-token       → Flask Container (CSRF token generation)
 *   GET /api/v1/legislations/*   → Flask Container
 *   /app/*                       → Flask Container (React SPA)
 *
 * Fallback: if a native handler throws, the request is automatically
 * retried via Flask Container so the user never sees an error.
 */

import { DurableObject } from "cloudflare:workers";
import postgres from "postgres";

// ── Table / column constants ──────────────────────────────────────────────────

const TABLE = "immigration_cases";

// Columns returned by the cases list endpoint (matches Flask CASE_LIST_COLUMNS)
const CASE_LIST_COLS = [
  "case_id", "citation", "title", "court_code", "date", "year",
  "judges", "outcome", "visa_type", "source", "tags", "case_nature",
  "visa_subclass", "visa_class_code", "applicant_name", "respondent",
  "country_of_origin", "visa_subclass_number", "hearing_date",
  "is_represented", "representative",
];

// Validated sort columns — prevents SQL injection via untrusted sort_by param
const SORT_COL_MAP = {
  date: "year",                          // date is varchar; sort by year int for reliability
  title: "title",
  court: "court_code",
  outcome: "outcome",
  visa_subclass_number: "visa_subclass_number",
  applicant_name: "applicant_name",
  hearing_date: "hearing_date",
  case_id: "case_id",
  citation: "citation",
};

const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 200;
const HEX_ID_RE = /^[0-9a-f]{12}$/;

// ── Database client (module-level, reused across requests per isolate) ────────

/** @type {import("postgres").Sql | null} */
let _sqlClient = null;

/**
 * Return (or lazily create) the postgres client backed by Hyperdrive.
 * Hyperdrive manages the actual PostgreSQL connection pool; the Worker
 * only needs one client per isolate.
 */
function getSql(env) {
  if (!_sqlClient) {
    _sqlClient = postgres(env.HYPERDRIVE.connectionString, {
      max: 5,          // max connections per Worker isolate (Hyperdrive pools beyond this)
      idle_timeout: 20, // seconds before idle connections are released back to Hyperdrive
    });
  }
  return _sqlClient;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function safeInt(val, def, min = 0, max = 99999) {
  const n = parseInt(val ?? "", 10);
  return Number.isNaN(n) ? def : Math.max(min, Math.min(max, n));
}

function jsonOk(data, cacheControl = "no-cache") {
  return Response.json(data, { headers: { "Cache-Control": cacheControl } });
}

function jsonErr(msg, status = 400) {
  return Response.json({ error: msg }, { status });
}

// ── WHERE clause builder ──────────────────────────────────────────────────────

/**
 * Build a composable SQL fragment for the cases WHERE clause.
 * All values are parameterized — no SQL injection risk.
 *
 * Returns null if the `tag` filter is active (tag filtering requires
 * array-contains logic; fall back to Flask for that case).
 */
function buildCasesWhere(sql, { court, year, visa_type, source, nature, keyword, tag }) {
  // Tags are stored as pipe-delimited strings in Postgres; complex to filter.
  // Signal Flask fallback by returning null.
  if (tag) return null;

  const parts = [sql`TRUE`];
  if (court)     parts.push(sql`court_code = ${court}`);
  if (year)      parts.push(sql`year = ${year}`);
  if (visa_type) parts.push(sql`visa_type = ${visa_type}`);
  if (source)    parts.push(sql`source = ${source}`);
  if (nature)    parts.push(sql`case_nature ILIKE ${nature}`);
  if (keyword) {
    const like = `%${keyword}%`;
    parts.push(sql`(title ILIKE ${like} OR citation ILIKE ${like})`);
  }
  // Reduce into a single AND-joined fragment
  return parts.reduce((acc, part) => sql`${acc} AND ${part}`);
}

function parseCaseFilters(searchParams) {
  const p = searchParams;
  return {
    court:     (p.get("court")     ?? "").trim(),
    year:      safeInt(p.get("year"), 0, 0, 2200),
    visa_type: (p.get("visa_type") ?? "").trim(),
    keyword:   (p.get("keyword")   ?? "").trim(),
    source:    (p.get("source")    ?? "").trim(),
    tag:       (p.get("tag")       ?? "").trim(),
    nature:    (p.get("nature")    ?? "").trim(),
  };
}

// ── Native GET handlers ───────────────────────────────────────────────────────

/** GET /api/v1/cases — paginated, filtered case list */
async function handleGetCases(url, env) {
  const filters = parseCaseFilters(url.searchParams);
  const sortBy  = url.searchParams.get("sort_by")  ?? "date";
  const sortDir = (url.searchParams.get("sort_dir") ?? "desc").toLowerCase();
  const page     = safeInt(url.searchParams.get("page"),      1,               1,  10000);
  const pageSize = safeInt(url.searchParams.get("page_size"), DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE);

  const sortCol = SORT_COL_MAP[sortBy];
  if (!sortCol) return jsonErr(`Invalid sort_by '${sortBy}'.`);
  if (sortDir !== "asc" && sortDir !== "desc") return jsonErr("sort_dir must be asc or desc.");

  const sql   = getSql(env);
  const where = buildCasesWhere(sql, filters);
  if (!where) return null; // tag filter → Flask

  const offset  = (page - 1) * pageSize;
  const safeDir = sql.unsafe(sortDir === "asc" ? "ASC" : "DESC");

  const [rows, countResult] = await Promise.all([
    sql`
      SELECT ${sql(CASE_LIST_COLS)}
      FROM   ${sql(TABLE)}
      WHERE  ${where}
      ORDER BY ${sql(sortCol)} ${safeDir} NULLS LAST
      LIMIT  ${pageSize}
      OFFSET ${offset}
    `,
    sql`
      SELECT COUNT(*)::int AS total
      FROM   ${sql(TABLE)}
      WHERE  ${where}
    `,
  ]);

  const total      = countResult[0].total;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return jsonOk(
    { cases: rows, total, count_mode: "exact", page, page_size: pageSize, total_pages: totalPages },
    "public, max-age=30, stale-while-revalidate=10",
  );
}

/** GET /api/v1/cases/count — lightweight count-only endpoint */
async function handleGetCasesCount(url, env) {
  const filters = parseCaseFilters(url.searchParams);
  const sql     = getSql(env);
  const where   = buildCasesWhere(sql, filters);
  if (!where) return null; // tag filter → Flask

  const [result] = await sql`
    SELECT COUNT(*)::int AS total FROM ${sql(TABLE)} WHERE ${where}
  `;
  return jsonOk({ total: result.total, count_mode: "exact" });
}

/** GET /api/v1/cases/:id — single case detail */
async function handleGetCase(caseId, env) {
  if (!HEX_ID_RE.test(caseId)) return jsonErr("Invalid case ID");

  const sql    = getSql(env);
  const [row]  = await sql`
    SELECT * FROM ${sql(TABLE)} WHERE case_id = ${caseId}
  `;
  if (!row) return jsonErr("Case not found", 404);

  // full_text (file content) is not stored in Supabase — it lives on the
  // container filesystem (gitignored). Return null so the frontend degrades
  // gracefully; the Flask path also returns null in production containers.
  return jsonOk({ case: row, full_text: null });
}

/** GET /api/v1/stats — dashboard aggregate statistics */
async function handleGetStats(url, env) {
  const p       = url.searchParams;
  const court   = (p.get("court")     ?? "").trim();
  const yearFrom = safeInt(p.get("year_from"), 0, 0, 2200);
  const yearTo   = safeInt(p.get("year_to"),   0, 0, 2200);

  // If any filter is active, the filtered path requires loading all cases
  // in memory (complex Python logic). Defer to Flask.
  const isFiltered =
    court ||
    (yearFrom > 0 && yearFrom > 2000) ||
    (yearTo > 0 && yearTo < new Date().getFullYear());
  if (isFiltered) return null;

  const sql = getSql(env);

  // Run all aggregate queries in parallel for maximum throughput
  const [totals, byCourt, byYear, byNature, byVisa, bySrc, recent] = await Promise.all([
    sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(CASE WHEN full_text_path IS NOT NULL AND full_text_path <> '' THEN 1 END)::int AS with_full_text
      FROM ${sql(TABLE)}
    `,
    sql`
      SELECT court_code, COUNT(*)::int AS cnt
      FROM   ${sql(TABLE)}
      WHERE  court_code IS NOT NULL
      GROUP BY court_code
      ORDER BY cnt DESC
    `,
    sql`
      SELECT year::text AS yr, COUNT(*)::int AS cnt
      FROM   ${sql(TABLE)}
      WHERE  year IS NOT NULL
      GROUP BY year
      ORDER BY year
    `,
    sql`
      SELECT case_nature, COUNT(*)::int AS cnt
      FROM   ${sql(TABLE)}
      WHERE  case_nature IS NOT NULL AND case_nature <> ''
      GROUP BY case_nature
      ORDER BY cnt DESC
      LIMIT 60
    `,
    sql`
      SELECT visa_subclass, COUNT(*)::int AS cnt
      FROM   ${sql(TABLE)}
      WHERE  visa_subclass IS NOT NULL AND visa_subclass <> ''
      GROUP BY visa_subclass
      ORDER BY cnt DESC
      LIMIT 80
    `,
    sql`
      SELECT source, COUNT(*)::int AS cnt
      FROM   ${sql(TABLE)}
      WHERE  source IS NOT NULL
      GROUP BY source
      ORDER BY cnt DESC
    `,
    sql`
      SELECT case_id, title, citation, court_code, date, outcome
      FROM   ${sql(TABLE)}
      WHERE  year IS NOT NULL
      ORDER BY year DESC, case_id DESC
      LIMIT 5
    `,
  ]);

  return jsonOk(
    {
      total_cases:    totals[0].total,
      with_full_text: totals[0].with_full_text,
      courts:         Object.fromEntries(byCourt.map(r => [r.court_code, r.cnt])),
      years:          Object.fromEntries(byYear.map(r  => [r.yr, r.cnt])),
      natures:        Object.fromEntries(byNature.map(r => [r.case_nature, r.cnt])),
      visa_subclasses: Object.fromEntries(byVisa.map(r => [r.visa_subclass, r.cnt])),
      visa_families:  {},  // complex Python grouping logic; frontend tolerates empty {}
      sources:        Object.fromEntries(bySrc.map(r => [r.source, r.cnt])),
      recent_cases:   recent,
    },
    "public, max-age=300, stale-while-revalidate=60",
  );
}

/** GET /api/v1/filter-options — distinct filter values for UI dropdowns */
async function handleGetFilterOptions(env) {
  const sql = getSql(env);

  const [courts, years, natures, visaTypes, sources, outcomes] = await Promise.all([
    sql`SELECT DISTINCT court_code AS v FROM ${sql(TABLE)} WHERE court_code IS NOT NULL ORDER BY v`,
    sql`SELECT DISTINCT year AS v       FROM ${sql(TABLE)} WHERE year IS NOT NULL ORDER BY v DESC`,
    sql`SELECT DISTINCT case_nature AS v FROM ${sql(TABLE)} WHERE case_nature IS NOT NULL AND case_nature <> '' ORDER BY v`,
    sql`SELECT DISTINCT visa_type AS v   FROM ${sql(TABLE)} WHERE visa_type IS NOT NULL AND visa_type <> '' ORDER BY v`,
    sql`SELECT DISTINCT source AS v      FROM ${sql(TABLE)} WHERE source IS NOT NULL ORDER BY v`,
    sql`SELECT DISTINCT outcome AS v     FROM ${sql(TABLE)} WHERE outcome IS NOT NULL AND outcome <> '' ORDER BY v`,
  ]);

  return jsonOk(
    {
      courts:     courts.map(r => r.v),
      years:      years.map(r  => r.v),
      natures:    natures.map(r => r.v),
      visa_types: visaTypes.map(r => r.v),
      sources:    sources.map(r => r.v),
      outcomes:   outcomes.map(r => r.v),
      tags:       [],  // tags require array-unnest; not yet implemented in native path
    },
    "public, max-age=300, stale-while-revalidate=60",
  );
}

// ── Flask Container Durable Object ────────────────────────────────────────────

export class FlaskBackend extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    // Boot the container only if not already running.
    // blockConcurrencyWhile ensures no requests are handled until ready.
    this.ctx.blockConcurrencyWhile(async () => {
      if (!this.ctx.container.running) {
        await this.ctx.container.start({
          env: {
            SECRET_KEY:                env.SECRET_KEY,
            SUPABASE_URL:              env.SUPABASE_URL,
            SUPABASE_ANON_KEY:         env.SUPABASE_ANON_KEY,
            SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
            APP_ENV: "production",
            // NOTE: HYPERDRIVE_DATABASE_URL not injected here —
            // Cloudflare Containers cannot resolve *.hyperdrive.local DNS.
            // Flask uses SupabaseRepository (REST API) instead, which works
            // once the container's socket patch resolves DNS via anycast IPs.
          },
        });
      }
    });
  }

  async fetch(request) {
    const url          = new URL(request.url);
    const containerUrl = `http://container${url.pathname}${url.search}`;

    // Retry until Flask is ready. Cold start: image pull + Python startup ≈ 30-60s.
    const MAX_ATTEMPTS  = 120; // 60 seconds total (120 × 500ms)
    const RETRY_DELAY   = 500;
    let lastError;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        const port = this.ctx.container.getTcpPort(8080);
        return await port.fetch(new Request(containerUrl, request));
      } catch (err) {
        const msg = err?.message ?? "";
        if (msg.includes("not listening") || msg.includes("not running")) {
          lastError = err;
          await new Promise(r => setTimeout(r, RETRY_DELAY));
          continue;
        }
        throw err;
      }
    }
    throw lastError;
  }
}

// ── Flask proxy helper ────────────────────────────────────────────────────────

async function proxyToFlask(request, env) {
  const id        = env.FlaskBackend.idFromName("flask-v13");
  const container = env.FlaskBackend.get(id);

  // Inject Hyperdrive connection string so Flask can optionally use direct psycopg2.
  // The socket.getaddrinfo patch in the container resolves *.hyperdrive.local DNS.
  if (env.HYPERDRIVE) {
    const headers = new Headers(request.headers);
    headers.set("X-Hyperdrive-Url", env.HYPERDRIVE.connectionString);
    return container.fetch(new Request(request, { headers }));
  }

  return container.fetch(request);
}

// ── Main router ───────────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const url    = new URL(request.url);
    const path   = url.pathname;
    const method = request.method;

    // Edge health check — no container needed
    if (path === "/health") {
      return Response.json({ status: "ok", worker: "immi-case", layer: "edge+hyperdrive" });
    }

    // ── Native Hyperdrive read path ───────────────────────────────────────────
    // Only for GET requests to /api/v1/* when Hyperdrive is available.
    // Handlers return null to signal "fall through to Flask".
    if (method === "GET" && path.startsWith("/api/v1/") && env.HYPERDRIVE) {
      try {
        let res = null;

        if (path === "/api/v1/cases") {
          res = await handleGetCases(url, env);
        } else if (path === "/api/v1/cases/count") {
          res = await handleGetCasesCount(url, env);
        } else if (path === "/api/v1/stats") {
          res = await handleGetStats(url, env);
        } else if (path === "/api/v1/filter-options") {
          res = await handleGetFilterOptions(env);
        } else {
          // Match /api/v1/cases/:id (exactly 12 lowercase hex chars)
          const m = path.match(/^\/api\/v1\/cases\/([0-9a-f]{12})$/);
          if (m) res = await handleGetCase(m[1], env);
        }

        if (res !== null) return res;
        // null → handler signalled "use Flask" (e.g. tag filter active)
      } catch (nativeErr) {
        // If the native handler throws (DB error, Hyperdrive hiccup), fall
        // through to Flask so the user never sees a raw 500.
        console.error("[native] handler error — falling back to Flask:", nativeErr?.message);
      }
    }

    // ── Flask Container proxy path ────────────────────────────────────────────
    // Everything that wasn't handled natively above goes to the Flask
    // container. Flask's SPA catch-all serves index.html for unknown
    // paths, so React Router can handle client-side routes like / and
    // /cases/:id. The legacy /app/* mount still works because Flask
    // serves the SPA from that prefix too (resolveRouterBasename()
    // auto-detects which mount it is running under).
    return proxyToFlask(request, env);
  },
};
