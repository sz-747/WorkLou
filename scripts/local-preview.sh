#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# A separate, persistent, loopback-only database for this checkout's demo.
if [[ -z "${WORKLOU_PG_BIN:-}" ]]; then
  if command -v pg_ctl >/dev/null; then
    WORKLOU_PG_BIN="$(dirname "$(command -v pg_ctl)")"
  elif command -v brew >/dev/null; then
    WORKLOU_PG_BIN="$(brew --prefix postgresql@16)/bin"
  else
    echo 'Install PostgreSQL 16, or set WORKLOU_PG_BIN to its bin directory.' >&2
    exit 1
  fi
fi
if [[ ! -x "$WORKLOU_PG_BIN/pg_ctl" ]]; then
  echo 'PostgreSQL 16 is required. On macOS: brew install postgresql@16' >&2
  exit 1
fi

local_dir="$PWD/.local"
db_port="${WORKLOU_DB_PORT:-55433}"
mkdir -p "$local_dir"
if [[ ! -f "$local_dir/postgres/PG_VERSION" ]]; then
  "$WORKLOU_PG_BIN/initdb" -D "$local_dir/postgres" -U worklou --encoding=UTF8 --no-locale --auth-local=trust --auth-host=trust
fi
if ! "$WORKLOU_PG_BIN/pg_ctl" -D "$local_dir/postgres" status >/dev/null 2>&1; then
  "$WORKLOU_PG_BIN/pg_ctl" -D "$local_dir/postgres" -l "$local_dir/postgres.log" \
    -o "-h 127.0.0.1 -p $db_port -k /tmp" start
fi
if [[ "$("$WORKLOU_PG_BIN/psql" -h 127.0.0.1 -p "$db_port" -U worklou -d postgres -Atc "SELECT 1 FROM pg_database WHERE datname = 'worklou_preview'")" != "1" ]]; then
  "$WORKLOU_PG_BIN/createdb" -h 127.0.0.1 -p "$db_port" -U worklou worklou_preview
fi
export DATABASE_URL="postgres://worklou@127.0.0.1:$db_port/worklou_preview"
if [[ ! -d node_modules ]]; then npm ci --no-audit --no-fund; fi
npm run db:push
npm run db:seed
if [[ "${1:-}" == "--setup-only" ]]; then exit 0; fi
echo "Local preview: http://localhost:${WORKLOU_PORT:-3000}/today"
exec ./node_modules/.bin/next dev -H 127.0.0.1 -p "${WORKLOU_PORT:-3000}"
