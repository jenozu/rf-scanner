#!/usr/bin/env bash
# Read-only health report for the VPS. Run by rf-ci-entry ("check") or by hand:
#   cd /docker/rf-scanner && bash scripts/vps/check.sh
# Prints PASS / WARN / FAIL lines and exits 1 if anything FAILED. Changes nothing
# (it only runs `git fetch` to learn how far behind main the VPS is).
# Secret values are never printed: only whether they are present and long enough.
#
# Test hooks: RF_DIR (folder to check), RF_BASE_URL (default http://127.0.0.1:8082).

main() {
  set -uo pipefail
  cd "${RF_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}" || { echo "FAIL  cannot enter the app folder"; return 1; }
  local base="${RF_BASE_URL:-http://127.0.0.1:8082}"
  local fails=0

  pass() { echo "PASS  $*"; }
  warn() { echo "WARN  $*"; }
  info() { echo "INFO  $*"; }
  fail() { echo "FAIL  $*"; fails=$((fails + 1)); }

  # 1. containers
  local running s
  running="$(docker compose ps --status running --services 2>/dev/null | sort | tr '\n' ' ')"
  for s in api nginx; do
    case " $running" in
      *" $s "*) pass "container '$s' is running" ;;
      *) fail "container '$s' is not running" ;;
    esac
  done

  # 2. the API answers through nginx
  if curl -fsS -m 10 "$base/api/health" 2>/dev/null | grep -q '"status":"ok"'; then
    pass "API health endpoint answers"
  else
    fail "API health endpoint did not answer ok at $base/api/health"
  fi

  # 3. JWT_SECRET present and long enough (value never printed)
  local secret
  secret="$(grep -m1 '^JWT_SECRET=' server/.env 2>/dev/null | cut -d= -f2- | tr -d "\"' \r")"
  if [ -z "$secret" ]; then
    fail "JWT_SECRET is missing in server/.env"
  elif [ "${#secret}" -lt 32 ]; then
    fail "JWT_SECRET is set but shorter than 32 characters"
  else
    pass "JWT_SECRET is set (${#secret} characters)"
  fi

  # 4. the old default admin login must not work (one failed attempt at most)
  local code
  code="$(curl -s -o /dev/null -w '%{http_code}' -m 10 -H 'Content-Type: application/json' \
    -d '{"username":"admin","password":"admin123"}' "$base/api/auth/login" 2>/dev/null || true)"
  case "$code" in
    200) fail "default login admin / admin123 WORKS: change the admin password now" ;;
    400|401) pass "default login admin / admin123 is rejected" ;;
    429) warn "login is rate-limited right now, default-password check skipped" ;;
    *) warn "default-password check got HTTP '${code:-none}'" ;;
  esac

  # 5. nightly backup cron entry
  if crontab -l 2>/dev/null | grep -v '^[[:space:]]*#' | grep -q 'backup-data.sh'; then
    pass "backup cron entry exists"
  else
    fail "no backup cron entry (see docs/BACKUP_AND_RESTORE.md)"
  fi

  # 6. a recent backup file (26 hours = 1560 minutes)
  if find backups -maxdepth 1 -name 'rf-data-*.tar.gz' -mmin -1560 2>/dev/null | grep -q .; then
    pass "a backup from the last 26 hours exists"
  else
    fail "no backup newer than 26 hours in ./backups"
  fi

  # 7. disk space
  local use
  use="$(df -P . | awk 'NR==2 {gsub("%","",$5); print $5}')"
  if [ -z "$use" ]; then
    warn "could not read disk usage"
  elif [ "$use" -ge 90 ]; then
    fail "disk is ${use}% full"
  elif [ "$use" -ge 80 ]; then
    warn "disk is ${use}% full"
  else
    pass "disk is ${use}% full"
  fi

  # 8. recent API errors (count only, never the lines: they could hold data)
  local errs
  errs="$(docker compose logs --tail=200 api 2>&1 | grep -ci 'error\|unhandled\|econn' || true)"
  if [ "${errs:-0}" -gt 0 ]; then warn "$errs error-like lines in the last 200 API log lines"; else pass "no error-like lines in the last 200 API log lines"; fi

  # 9. which version is running
  local sha behind
  sha="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
  git fetch -q origin main 2>/dev/null || true
  behind="$(git rev-list --count HEAD..origin/main 2>/dev/null || echo '?')"
  info "running commit $sha, $behind commit(s) behind origin/main"

  if [ "$fails" -gt 0 ]; then
    echo "RESULT  $fails check(s) FAILED"
    return 1
  fi
  echo "RESULT  all required checks passed"
  return 0
}

# Everything is inside main() and called once, so bash has read the whole file before it
# runs: a `git pull` that replaces this file mid-run cannot corrupt the running copy.
main "$@"
exit $?
