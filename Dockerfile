FROM python:3.12-slim
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Build React frontend
RUN cd frontend && npm ci && npm run build 2>/dev/null || true

EXPOSE 8080
ENV APP_ENV=production
ENV PYTHONUNBUFFERED=1

# Cloudflare Containers block DNS at network level (UDP 53 is filtered) — resolv.conf fixes
# are useless. /etc/hosts takes precedence over DNS and CAN be written at runtime.
# Write pre-resolved Supabase anycast IPs at container startup so httpx can connect.
CMD ["/bin/sh", "-c", "printf '104.18.38.10 urntbuqczarkuoaosjxd.supabase.co\\n172.64.149.246 urntbuqczarkuoaosjxd.supabase.co\\n' >> /etc/hosts 2>/dev/null; exec python web.py --host 0.0.0.0 --port 8080 --backend supabase"]
