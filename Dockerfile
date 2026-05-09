FROM python:3.12-slim
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# React frontend bundle is built locally (or by CI) and committed to
# immi_case_downloader/static/react/. This image is python:3.12-slim
# (no Node.js / npm), so we cannot build inside the container.
#
# Convention: run `cd frontend && npx vite build` on the dev machine
# BEFORE pushing changes that touch frontend/. The resulting assets +
# index.html under immi_case_downloader/static/react/ are baked into
# the image via the COPY above.
#
# History: a previous `RUN cd frontend && npm ci && npm run build 2>/dev/null || true`
# step was here. It silently failed every deploy (npm not in slim image)
# and the `|| true` masked the failure — the container shipped with
# stale committed assets, surfacing as "180s timeout" production bugs
# even after the source code was fixed. Do not re-add a build step
# without first installing Node.js in the base image.

EXPOSE 8080
ENV APP_ENV=production
ENV PYTHONUNBUFFERED=1

# Cloudflare Containers block DNS at network level (UDP 53 is filtered) — resolv.conf fixes
# are useless. /etc/hosts takes precedence over DNS and CAN be written at runtime.
# Write pre-resolved Supabase anycast IPs at container startup so httpx can connect.
CMD ["/bin/sh", "-c", "printf '104.18.38.10 urntbuqczarkuoaosjxd.supabase.co\\n172.64.149.246 urntbuqczarkuoaosjxd.supabase.co\\n' >> /etc/hosts 2>/dev/null; exec python web.py --host 0.0.0.0 --port 8080 --backend supabase"]
