#!/usr/bin/env bash
# Deploy one specific commit on the VPS. Run by rf-ci-entry ("deploy <sha>") or by hand:
#   cd /docker/rf-scanner && bash scripts/vps/deploy.sh <40-char-sha>
#
# Order of events, stopping at the first problem:
#   1. one deploy at a time; refuse if tracked files were edited on the VPS
#   2. refuse unless JWT_SECRET is set, and unless the sha is on origin/main
#   3. nothing to do if the VPS already has that commit (or a newer one)
#   4. back up the data (Docker volume + ./data). No backup, no deploy.
#   5. fast-forward to the sha (never rewrites history), rebuild, wait for the health check
#   6. if the new version does not come up healthy, put the previous commit back and rebuild
# It never deletes data, never touches the rf_data volume, and never runs docker prune.
#
# Test hooks: RF_DIR (folder), RF_LOCK (lock file), RF_BASE_URL, RF_HEALTH_WAIT (seconds, default 90).

main() {
  set -uo pipefail
  local target="${1:-}"
  local base="${RF_BASE_URL:-http://127.0.0.1:8082}"
  local wait_s="${RF_HEALTH_WAIT:-90}"

  die() { echo "DEPLOY REFUSED: $*" >&2; return 1; }

  [[ "$target" =~ ^[0-9a-f]{40}$ ]] || { die "need a full 40-character commit id"; return 1; }
  cd "${RF_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}" || { die "cannot enter the app folder"; return 1; }

  # 1. one deploy at a time
  exec 9>"${RF_LOCK:-/tmp/rf-deploy.lock}"
  flock -n 9 || { die "another deploy is already running"; return 1; }

  if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
    die "tracked files were changed on the VPS (run 'git status' there); not deploying over them"; return 1
  fi

  # 2. preconditions
  local secret
  secret="$(grep -m1 '^JWT_SECRET=' server/.env 2>/dev/null | cut -d= -f2- | tr -d "\"' \r")"
  [ "${#secret}" -ge 32 ] || { die "JWT_SECRET is missing or shorter than 32 characters in server/.env"; return 1; }

  git fetch -q origin main || { die "git fetch failed"; return 1; }
  git cat-file -e "$target^{commit}" 2>/dev/null || { die "commit $target is not known after fetching"; return 1; }
  git merge-base --is-ancestor "$target" origin/main || { die "commit $target is not on origin/main"; return 1; }

  # 3. already there?
  if git merge-base --is-ancestor "$target" HEAD; then
    echo "DEPLOY SKIPPED: the VPS already has $target or something newer ($(git rev-parse --short HEAD))"
    return 0
  fi

  local prev
  prev="$(git rev-parse HEAD)"

  # 4. backup first
  echo "== backup"
  bash ./scripts/backup-data.sh --docker || { die "backup failed; nothing was changed"; return 1; }
  if [ -d ./data ]; then
    bash ./scripts/backup-data.sh --dir ./data --out ./backups-host || { die "host ./data backup failed; nothing was changed"; return 1; }
  fi

  # 5. update, rebuild, verify
  echo "== update $(git rev-parse --short "$prev") -> $(git rev-parse --short "$target")"
  git merge --ff-only "$target" || { die "could not fast-forward to $target; nothing was changed"; return 1; }

  if build_and_wait "$base" "$wait_s"; then
    echo "DEPLOY OK: now running $(git rev-parse --short HEAD)"
    return 0
  fi

  # 6. roll back
  echo "== new version is not healthy; rolling back to $(git rev-parse --short "$prev")" >&2
  git reset --hard "$prev" >&2 || { echo "ROLLBACK FAILED: could not reset the code; fix by hand" >&2; return 3; }
  if build_and_wait "$base" "$wait_s"; then
    echo "ROLLED BACK: the previous version is running again ($(git rev-parse --short HEAD)). The new version was NOT deployed." >&2
    return 1
  fi
  echo "ROLLBACK FAILED: the previous version is not healthy either. Data backups are in ./backups. Fix by hand." >&2
  return 3
}

build_and_wait() {
  local base="$1" wait_s="$2" i
  docker compose up -d --build || return 1
  for ((i = 0; i < wait_s; i += 3)); do
    if curl -fsS -m 5 "$base/api/health" 2>/dev/null | grep -q '"status":"ok"'; then
      return 0
    fi
    sleep "${RF_HEALTH_SLEEP:-3}"
  done
  return 1
}

# Whole script is read before anything runs, so the `git merge` above cannot change it mid-run.
main "$@"
exit $?
