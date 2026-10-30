#!/usr/bin/env bash
# Back up the RF Scanner server data (users, orders, bins, counts, logs ...) into a
# timestamped .tar.gz, and keep only the newest backups.
#
#   scripts/backup-data.sh --docker                 # production: data is in the api container's volume
#   scripts/backup-data.sh --dir /path/to/data      # a plain data folder (DATA_DIR)
#
# Options:  --out DIR      where backups go            (default: BACKUP_DIR or ./backups)
#           --keep N       how many backups to keep    (default: KEEP or 14)
#           --service NAME docker compose service      (default: api)
#
# Run it from the folder that holds docker-compose.yml when using --docker.
# Backups are written to a ".partial" file first and renamed only after the archive
# has been checked, so a failed run never leaves a broken backup that looks real.
set -euo pipefail

CONTAINER_DATA_DIR="/app/server/data"
MODE=""; DATA_PATH=""; SERVICE="api"
OUT_DIR="${BACKUP_DIR:-./backups}"
KEEP="${KEEP:-14}"

die() { echo "backup-data: $*" >&2; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    --docker)  MODE="docker" ;;
    --dir)     MODE="dir"; [ $# -ge 2 ] || die "--dir needs a path"; DATA_PATH="$2"; shift ;;
    --out)     [ $# -ge 2 ] || die "--out needs a folder"; OUT_DIR="$2"; shift ;;
    --keep)    [ $# -ge 2 ] || die "--keep needs a number"; KEEP="$2"; shift ;;
    --service) [ $# -ge 2 ] || die "--service needs a name"; SERVICE="$2"; shift ;;
    -h|--help) sed -n '2,16p' "$0"; exit 0 ;;
    *) die "unknown option: $1 (try --help)" ;;
  esac
  shift
done

[ -n "$MODE" ] || die "choose --docker or --dir PATH (try --help)"
case "$KEEP" in ''|*[!0-9]*) die "--keep must be a whole number" ;; esac
[ "$KEEP" -ge 1 ] || die "--keep must be at least 1"
if [ "$MODE" = "dir" ]; then [ -d "$DATA_PATH" ] || die "data folder not found: $DATA_PATH"; fi

mkdir -p "$OUT_DIR"

# rf-data-YYYYmmdd-HHMMSS-NN.tar.gz: the 2-digit counter keeps runs in the same second in order.
stamp="$(date +%Y%m%d-%H%M%S)"
n=0; final=""
while [ "$n" -le 99 ]; do
  candidate="$OUT_DIR/rf-data-$stamp-$(printf '%02d' "$n").tar.gz"
  if [ ! -e "$candidate" ]; then final="$candidate"; break; fi
  n=$((n + 1))
done
[ -n "$final" ] || die "too many backups in the same second"
partial="$final.partial"
trap 'rm -f "$partial"' EXIT

if [ "$MODE" = "dir" ]; then
  tar -czf "$partial" -C "$DATA_PATH" .
else
  # The files are written atomically by the app, so each file in the archive is whole.
  docker compose run --rm -T --no-deps --entrypoint tar "$SERVICE" -czf - -C "$CONTAINER_DATA_DIR" . > "$partial"
fi

# Check the archive: readable, and holds at least one file.
entries="$(tar -tzf "$partial" | grep -vc '/$' || true)"
[ "${entries:-0}" -ge 1 ] || die "the backup is empty or unreadable; nothing was kept"

mv "$partial" "$final"
trap - EXIT

# Keep only the newest $KEEP backups (names sort oldest to newest).
total="$(ls -1 "$OUT_DIR" | grep -c '^rf-data-.*\.tar\.gz$' || true)"
if [ "$total" -gt "$KEEP" ]; then
  ls -1 "$OUT_DIR" | grep '^rf-data-.*\.tar\.gz$' | sort | head -n "$((total - KEEP))" | while read -r old; do
    rm -f "$OUT_DIR/$old"
  done
  total="$KEEP"
fi

size="$(du -h "$final" | cut -f1)"
echo "Backup written: $final ($size, $entries files). Backups kept: $total."
