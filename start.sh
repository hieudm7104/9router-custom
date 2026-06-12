#!/bin/sh
set -e

# Read PORT from .env (fallback 20128) so the published port always matches the app.
PORT=$(grep -E '^PORT=' .env 2>/dev/null | cut -d= -f2 | tr -d '[:space:]')
PORT=${PORT:-20128}

docker stop 9router 2>/dev/null || true
docker rm 9router 2>/dev/null || true
docker build --build-arg APP_PORT="$PORT" -t 9router .
docker run -d --name 9router \
  --restart unless-stopped \
  -p "$PORT:$PORT" \
  --env-file .env \
  -v 9router-data:/app/data \
  9router
