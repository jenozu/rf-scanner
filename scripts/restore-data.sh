#!/usr/bin/env bash
# Restore RF Scanner server data from a backup made by backup-data.sh.
#
#   scripts/restore-data.sh BACKUP.tar.gz --dir /path/to/empty/data
#   scripts/restore-data.sh BACKUP.tar.gz --docker              # into the api container's volume
#
# Safety rules:
#   * The target must be empty. If it is not, nothing happens unless you add --force.
#   * With --force, the current contents are first saved as a pre-restore backup
#     (in --out, default ./backups), and the restore then only OVERLAYS files from
#     the archive. Nothing is deleted; files not in the archive stay as they are.
#   * Stop the app first for a clean result:  docker compose stop api
set -euo pipefail

CONTAINER_DATA_DIR="/app/server/data"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ARCHIVE=""; MODE=""; DATA_PATH=""; SERVICE="api"; FORCE=0
OUT_DIR="${BACKUP_DIR:-./backups}"

die() { echo "restore-data: $*" >&2; exit 1; }

[ $# -ge 1 ] || die "give the backup file first (try --help)"
case "$1" in -h|--help) sed -n '2,13p' "$0"; exit 0 ;; esac
ARCHIVE="$1"; shift
while [ $# -gt 0 ]; do
  case "$1" in
    --docker)  MODE="docker" ;;
    --dir)     MODE="dir"; [ $# -ge 2 ] || die "--dir needs a path"; DATA_PATH="$2"; shift ;;
    --service) [ $# -ge 2 ] || die "--service needs a name"; SERVICE="$2"; shift ;;
    --out)     [ $# -ge 2 ] || die "--out needs a folder"; OUT_DIR="$2"; shift ;;
    --force)   FORCE=1 ;;
    -h|--help) sed -n '2,13p' "$0"; exit 0 ;;
    *) die "unknown option: $1 (try --help)" ;;
  esac
  shift
done

[ -n "$MODE" ] || die "choose --docker or --dir PATH"
[ -f "$ARCHIVE" ] || die "backup file not found: $ARCHIVE"
tar -tzf "$ARCHIVE" >/dev/null 2>&1 || die "that file is not a readable backup archive"

if [ "$MODE" = "dir" ]; then
  mkdir -p "$DATA_PATH"
  nonempty="$(ls -A "$DATA_PATH" | head -n 1)"
else
  nonempty="$(docker compose run --rm -T --no-deps --entrypoint sh "$SERVICE" -c "ls -A $CONTAINER_DATA_DIR | head -n 1")"
fi

if [ -n "$nonempty" ]; then
  [ "$FORCE" -eq 1 ] || die "the target already has data. Nothing was changed. Add --force to save it as a pre-restore backup and overlay the archive on top."
  echo "Saving the current data first ..."
  if [ "$MODE" = "dir" ]; then
    "$HERE/backup-data.sh" --dir "$DATA_PATH" --out "$OUT_DIR" --keep 1000
  else
    "$HERE/backup-data.sh" --docker --service "$SERVICE" --out "$OUT_DIR" --keep 1000
  fi
fi

if [ "$MODE" = "dir" ]; then
  tar -xzf "$ARCHIVE" -C "$DATA_PATH"
else
  docker compose run --rm -T --no-deps --entrypoint sh "$SERVICE" -c "tar -xzf - -C $CONTAINER_DATA_DIR" < "$ARCHIVE"
fi

echo "Restored $ARCHIVE. Start the app again:  docker compose start api"
