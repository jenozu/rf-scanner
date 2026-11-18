#!/usr/bin/env bash
# The VPS updates itself: run every few minutes by cron. No GitHub secrets and no extra SSH key.
#
#   1. fetch main from GitHub (read-only; the repository is public)
#   2. nothing to do if the VPS already has the newest commit on main
#   3. skip commits that only change documentation
#   4. ask GitHub whether the tests ("test" check) passed on that commit:
#        still running -> wait for the next run; failed -> never deploy it
#   5. hand over to scripts/vps/deploy.sh: backup, fast-forward, rebuild, health check, roll back
#   6. a commit whose deploy failed or rolled back is not retried; the next newer commit is.
#      To try the same commit again:  rf-auto-deploy --retry
#
# Install once (see docs/VPS_AUTO_DEPLOY.md):
#   sudo install -m 755 /docker/rf-scanner/scripts/vps/auto-deploy.sh /usr/local/bin/rf-auto-deploy
#   crontab -e   ->   */5 * * * * /usr/local/bin/rf-auto-deploy >> /var/log/rf-auto-deploy.log 2>&1
#
# Quiet when there is nothing to do; every line it does print starts with a UTC time.
# Settings (environment, all optional): RF_DIR (app folder), RF_GITHUB_REPO, RF_GITHUB_API,
# RF_CI_CHECK (name of the required check), RF_STATE_DIR (where it remembers skipped commits).

main() {
  set -uo pipefail
  # cron starts with a bare PATH; add the usual places for git, docker, curl and flock.
  export PATH="${PATH:+$PATH:}/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
  local dir="${RF_DIR:-/docker/rf-scanner}"
  local repo="${RF_GITHUB_REPO:-jenozu/rf-scanner}"
  local api="${RF_GITHUB_API:-https://api.github.com}"
  local check_name="${RF_CI_CHECK:-test}"
  local state="${RF_STATE_DIR:-${HOME:-/root}/.rf-auto-deploy}"

  log() { echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) $*"; }

  mkdir -p "$state" || { log "ERROR cannot create $state"; return 1; }
  # One run at a time: a deploy can take longer than the cron interval.
  exec 8>"$state/lock"
  flock -n 8 || return 0

  if [ "${1:-}" = "--retry" ]; then
    rm -f "$state/failed"
    log "retry requested: a commit that failed before will be tried again"
  fi

  cd "$dir" || { log "ERROR cannot enter $dir"; return 1; }
  git fetch -q origin main || { log "ERROR git fetch failed (network?) - will try again next run"; return 1; }

  local target short
  target="$(git rev-parse origin/main)"
  short="${target:0:7}"

  # Already running this commit (or something newer).
  git merge-base --is-ancestor "$target" HEAD && return 0

  # Failed before: wait for a newer commit, or --retry.
  [ "$(cat "$state/failed" 2>/dev/null)" = "$target" ] && return 0

  # Documentation-only changes need no rebuild; they go live with the next code change.
  local changed
  changed="$(git diff --name-only HEAD "$target")"
  if [ -n "$changed" ] && ! printf '%s\n' "$changed" | grep -qvE '^(docs/|\.taskmaster/)|\.md$'; then
    if [ "$(cat "$state/docs" 2>/dev/null)" != "$target" ]; then
      log "SKIP $short: only documentation changed, nothing to rebuild"
      echo "$target" > "$state/docs"
    fi
    return 0
  fi

  # Did the tests pass on GitHub for exactly this commit?
  local resp
  resp="$(curl -fsS -m 20 -H 'Accept: application/vnd.github+json' \
    "$api/repos/$repo/commits/$target/check-runs?check_name=$check_name&filter=latest" 2>/dev/null)" || {
    log "WAIT $short: could not ask GitHub for the test result - will try again next run"
    return 0
  }
  local total completed succeeded
  total="$(printf '%s' "$resp" | grep -o '"total_count": *[0-9]*' | head -1 | grep -o '[0-9]*$')"
  completed="$(printf '%s' "$resp" | grep -o '"status": *"completed"' | wc -l)"
  succeeded="$(printf '%s' "$resp" | grep -o '"conclusion": *"success"' | wc -l)"
  # No test run yet, or still running: wait quietly.
  if [ -z "$total" ] || [ "$total" -eq 0 ] || [ "$completed" -lt "$total" ]; then
    return 0
  fi
  if [ "$succeeded" -lt "$total" ]; then
    log "NOT DEPLOYING $short: the '$check_name' check did not pass on GitHub"
    echo "$target" > "$state/failed"
    return 0
  fi

  # A deploy started by hand is still running: try again next run (not a failure).
  if ! (exec 9>"${RF_LOCK:-/tmp/rf-deploy.lock}"; flock -n 9); then
    return 0
  fi

  # Tests passed: deploy. deploy.sh takes a backup first and rolls back if unhealthy.
  log "DEPLOYING $short (tests passed on GitHub)"
  local code
  bash "$dir/scripts/vps/deploy.sh" "$target" 2>&1 | while IFS= read -r line; do log "  $line"; done
  code="${PIPESTATUS[0]}"
  if [ "$code" -eq 0 ]; then
    rm -f "$state/failed"
    log "DONE $short is live"
    return 0
  fi
  echo "$target" > "$state/failed"
  log "FAILED $short (exit $code): see the lines above. It will not be retried; the next commit will be. To retry: rf-auto-deploy --retry"
  return 1
}

# Whole script is read before anything runs.
main "$@"
exit $?
