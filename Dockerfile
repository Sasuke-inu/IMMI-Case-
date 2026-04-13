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

# Pre-bake DNS into the image layer so it survives regardless of runtime resolv.conf handling.
# Cloudflare Containers start with no working resolver; 1.1.1.1 lets outbound HTTPS reach Supabase.
# *.hyperdrive.local still can't be resolved via public DNS (that's OK — SupabaseRepository uses REST).
RUN printf 'nameserver 1.1.1.1\nnameserver 8.8.8.8\n' > /etc/resolv.conf

CMD ["python", "web.py", "--host", "0.0.0.0", "--port", "8080", "--backend", "supabase"]
