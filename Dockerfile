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

# Cloudflare Containers have no DNS resolver. /etc/resolv.conf is overridden at runtime
# and /etc/hosts is read-only during Docker build. Fix: at container startup (CMD),
# write the pre-resolved Supabase IPs into /etc/hosts so httpx can connect without DNS.
# IPs are Cloudflare anycast (supabase.co REST API is served through Cloudflare CDN).
CMD ["/bin/sh", "-c", "echo '104.18.38.10 urntbuqczarkuoaosjxd.supabase.co' >> /etc/hosts 2>/dev/null; echo '172.64.149.246 urntbuqczarkuoaosjxd.supabase.co' >> /etc/hosts 2>/dev/null; exec python web.py --host 0.0.0.0 --port 8080 --backend supabase"]
