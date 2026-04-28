# Uploading Judge Photos to R2

How to add new judge portrait photos to production via the temporary
upload endpoint. Use this when the local Cloudflare account differs
from the deployed Worker's account (R2 buckets are scoped per-account
and bucket names are NOT globally unique).

## When to use

- Adding a new photo for a judge already in `judge_bios.json`
- Replacing an existing photo with a higher-quality version
- Bootstrapping the R2 bucket after rotating Cloudflare accounts

If you're already in the same account as the deployed Worker, you can
skip this and just use `npx wrangler r2 object put` directly.

## How to know you need this path

Run the sentinel test:

```bash
# Worker writes a sentinel via R2 binding (need temp debug endpoint or wrangler dev)
# Then check from CLI:
npx wrangler r2 object get "immi-case-judge-photos/__worker-sentinel.txt" --file /tmp/s
```

If the CLI returns `0 bytes` / not-found but the Worker just wrote it,
you're in different accounts. Use the runbook below.

## Steps

### 1. Generate one-shot upload token

```bash
TOKEN=$(openssl rand -hex 32)
echo "$TOKEN" > /tmp/r2_upload_token        # save for curl
```

### 2. Set token as Worker secret

```bash
echo "$TOKEN" | npx wrangler secret put R2_UPLOAD_TOKEN
```

This adds `env.R2_UPLOAD_TOKEN` to the deployed Worker.

### 3. Add temporary PUT endpoint to `workers/proxy.js`

Insert this block in the main router AFTER the existing GET judge-photo
block (search for `// ── Judge photo R2 serve ──`):

```js
// TEMP one-shot upload — REMOVE after photos uploaded
if (path.startsWith("/api/v1/judge-photo/") && method === "PUT") {
  const auth = request.headers.get("Authorization") || "";
  if (!env.R2_UPLOAD_TOKEN || auth !== "Bearer " + env.R2_UPLOAD_TOKEN) {
    return jsonErr("unauthorized", 401);
  }
  if (!env.JUDGE_PHOTOS) return jsonErr("R2 binding missing", 500);
  const filename = path.slice("/api/v1/judge-photo/".length);
  if (!JUDGE_PHOTO_NAME_RE.test(filename)) return jsonErr("invalid filename", 400);
  const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();
  if (!JUDGE_PHOTO_EXTS.has(ext)) return jsonErr("invalid extension", 400);
  await env.JUDGE_PHOTOS.put(filename, request.body, {
    httpMetadata: { contentType: request.headers.get("Content-Type") || "image/jpeg" },
  });
  return Response.json({ ok: true, filename });
}
```

### 4. Deploy

```bash
npx wrangler deploy
```

### 5. PUT each photo

```bash
TOKEN=$(cat /tmp/r2_upload_token | tr -d '\n')
for f in arthur-glass.jpg nicole-burns.jpg karen-mcnamara.jpg; do
  curl -X PUT "https://immi.trackit.today/api/v1/judge-photo/$f" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: image/jpeg" \
    --data-binary "@downloaded_cases/judge_photos/$f"
  echo
done
```

Expected: `{"ok":true,"filename":"<file>"}` HTTP 200.

### 6. Verify GET

```bash
for f in arthur-glass nicole-burns karen-mcnamara; do
  curl -sI "https://immi.trackit.today/api/v1/judge-photo/$f.jpg" | head -3
done
```

Expected: `HTTP/2 200`, `content-type: image/jpeg`.

### 7. Cleanup (CRITICAL — security)

Remove the PUT block from `workers/proxy.js` (revert step 3 — leave only
the GET handler). Then:

```bash
npx wrangler deploy                                  # ship clean version
echo "y" | npx wrangler secret delete R2_UPLOAD_TOKEN
rm -f /tmp/r2_upload_token
```

Verify the PUT endpoint is gone:

```bash
curl -X PUT "https://immi.trackit.today/api/v1/judge-photo/test.jpg" \
  -H "Authorization: Bearer fake" -d "x"
# expect HTTP 500 (Flask fall-through, not 200/401)
```

### 8. Sync `judge_bios.json` → Supabase

If you added a new judge or photo_url, push the JSON change to Supabase:

```bash
python3 sync_judge_bios_supabase.py
```

Frontend will pick up `bio.photo_url` automatically via `JudgeHero.tsx`.

## Why this exists (root cause memo)

R2 bucket names are unique **per Cloudflare account**, not globally. The
local CLI account and the deployed Worker account were two different
accounts — both had a bucket named `immi-case-judge-photos` (auto-created
by `[[r2_buckets]]` binding on first deploy). CLI uploads landed in
account A's bucket; Worker reads went to account B's bucket. Result:
files appeared "uploaded" but Worker `.get()` always returned null.

The Worker-side PUT bypasses this because it writes via the runtime R2
binding which always points at the Worker's own account.

Long-term fix: align local CLI to the same Cloudflare account as CI's
deploy token. Until then, this runbook is the migration path.
