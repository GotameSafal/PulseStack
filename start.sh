#!/usr/bin/env bash
# ==============================================================================
# PulseStack All-in-One Startup Script
# ==============================================================================
# Starts:
#   1. Docker Infrastructure (Postgres, Redis, ClickHouse)
#   2. Database Migrations (PostgreSQL)
#   3. API Server (port 8000)
#   4. Background Worker (Stream Ingestion + Alerts + Notifications)
#   5. Web Frontend (port 3000)
#
# Press Ctrl+C to cleanly stop all services.
# ==============================================================================

set -e

# Change to the repository root directory
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

echo "=================================================="
echo "          Starting PulseStack Environment         "
echo "=================================================="

# ------------------------------------------------------------------------------
# 1. Ensure Environment Files Exist
# ------------------------------------------------------------------------------
if [ ! -f "$ROOT_DIR/.env" ]; then
  if [ -f "$ROOT_DIR/.env.example" ]; then
    echo "[-] Creating root .env from .env.example..."
    cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
  fi
fi

# Load root .env variables for this session
if [ -f "$ROOT_DIR/.env" ]; then
  set -a
  source "$ROOT_DIR/.env"
  set +a
fi

if [ ! -f "$ROOT_DIR/apps/api/.env" ]; then
  echo "[-] Creating apps/api/.env..."
  cp "$ROOT_DIR/.env" "$ROOT_DIR/apps/api/.env"
fi

if [ ! -f "$ROOT_DIR/apps/web/.env.local" ]; then
  echo "[-] Creating apps/web/.env.local..."
  echo "NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL:-http://localhost:8000}" > "$ROOT_DIR/apps/web/.env.local"
fi

# ------------------------------------------------------------------------------
# 2. Start Docker Containers
# ------------------------------------------------------------------------------
echo ""
echo "[1/4] Starting Docker infrastructure (Postgres, Redis, ClickHouse)..."
docker compose up -d

echo "[*] Waiting for PostgreSQL to be healthy..."
until docker compose exec -T postgres pg_isready -U "${POSTGRES_USER:-pulsestack}" -d "${POSTGRES_DB:-pulsestack}" > /dev/null 2>&1; do
  sleep 1
done

echo "[*] Waiting for Redis to be healthy..."
until docker compose exec -T redis redis-cli -a "${REDIS_PASSWORD:-redis_secret}" ping 2>/dev/null | grep -q PONG; do
  sleep 1
done

echo "[*] Waiting for ClickHouse to be healthy..."
until curl -s "http://localhost:${CLICKHOUSE_HTTP_PORT:-8123}/ping" 2>/dev/null | grep -q "Ok."; do
  sleep 1
done

echo "[✔] All infrastructure containers are healthy."

# ------------------------------------------------------------------------------
# 3. Run Database Migrations
# ------------------------------------------------------------------------------
echo ""
echo "[2/4] Running PostgreSQL database migrations..."
DATABASE_URL="${DATABASE_URL:-postgresql://pulsestack:pulsestack_secret@localhost:5432/pulsestack}" \
pnpm --filter @pulsestack/database db:migrate

# ------------------------------------------------------------------------------
# 4. Start Applications (API, Worker, Web)
# ------------------------------------------------------------------------------
echo ""
echo "[3/4] Launching PulseStack apps..."

# Track child PIDs for graceful shutdown
API_PID=""
WORKER_PID=""
WEB_PID=""

cleanup() {
  echo ""
  echo "=================================================="
  echo "Stopping PulseStack apps..."
  echo "=================================================="

  if [ -n "$API_PID" ] && kill -0 "$API_PID" 2>/dev/null; then
    echo "Stopping API server (PID: $API_PID)..."
    kill "$API_PID" 2>/dev/null || true
  fi

  if [ -n "$WORKER_PID" ] && kill -0 "$WORKER_PID" 2>/dev/null; then
    echo "Stopping Worker (PID: $WORKER_PID)..."
    kill "$WORKER_PID" 2>/dev/null || true
  fi

  if [ -n "$WEB_PID" ] && kill -0 "$WEB_PID" 2>/dev/null; then
    echo "Stopping Web frontend (PID: $WEB_PID)..."
    kill "$WEB_PID" 2>/dev/null || true
  fi

  # Wait briefly for graceful termination
  wait 2>/dev/null || true
  echo "[✔] All apps stopped."
  echo "Note: Docker containers are still running. Run 'docker compose down' if you want to stop them."
  exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# Start API
echo "Starting API on http://localhost:${PORT:-8000}..."
pnpm --filter @pulsestack/api dev &
API_PID=$!

# Start Worker
echo "Starting Worker..."
pnpm --filter @pulsestack/worker dev &
WORKER_PID=$!

# Start Web Frontend
echo "Starting Web on http://localhost:3000..."
pnpm --filter @pulsestack/web dev &
WEB_PID=$!

echo ""
echo "=================================================="
echo "PulseStack is running!"
echo "  - Web Frontend:  http://localhost:3000"
echo "  - API Backend:   http://localhost:${PORT:-8000}"
echo "  - Redis:         localhost:6379"
echo "  - Postgres:      localhost:5432"
echo "  - ClickHouse:    http://localhost:8123"
echo "=================================================="
echo "Press Ctrl+C to stop all application processes."
echo ""

# Wait for child processes
wait
