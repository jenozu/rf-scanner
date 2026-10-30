#!/usr/bin/env bash
# Tests for backup-data.sh and restore-data.sh. Uses temporary folders only.
# Docker mode runs against a stand-in "docker" command (no Docker needed) that checks
# the exact arguments and the stdin/stdout piping the real commands rely on.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP="$HERE/backup-data.sh"; RESTORE="$HERE/restore-data.sh"
WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT
pass=0; fail=0
ok()   { pass=$((pass + 1)); echo "PASS $1"; }
bad()  { fail=$((fail + 1)); echo "FAIL $1"; }
check(){ local name="$1"; shift; if "$@"; then ok "$name"; else bad "$name"; fi; }

# --- a data folder like the server's ---
DATA="$WORK/data"; mkdir -p "$DATA"
echo '[{"id":"u1"}]' > "$DATA/users.json"
echo '[{"BinCode":"A-1"}]' > "$DATA/rf_bins.json"
mkdir -p "$DATA/sub"; echo 'nested' > "$DATA/sub/note.txt"

# 1. a backup is created, readable, and contains the files
OUT="$WORK/out"
"$BACKUP" --dir "$DATA" --out "$OUT" >/dev/null
files=("$OUT"/rf-data-*.tar.gz)
check "creates one .tar.gz backup" test "${#files[@]}" -eq 1
check "archive holds the data files" bash -c "tar -tzf '${files[0]}' | grep -q 'users.json' && tar -tzf '${files[0]}' | grep -q 'sub/note.txt'"
check "no .partial file is left behind" bash -c "! ls '$OUT' | grep -q partial"

# 2. 16 runs with --keep 14 leave exactly 14, and the OLDEST are the ones removed
rm -rf "$OUT"
for i in $(seq 1 16); do
  echo "run $i" > "$DATA/marker.txt"
  "$BACKUP" --dir "$DATA" --out "$OUT" --keep 14 >/dev/null
done
count="$(ls -1 "$OUT" | grep -c '^rf-data-.*\.tar\.gz$')"
check "keeps exactly 14 backups after 16 runs" test "$count" -eq 14
oldest="$(ls -1 "$OUT" | sort | head -n 1)"
newest="$(ls -1 "$OUT" | sort | tail -n 1)"
check "oldest kept backup is run 3 (runs 1-2 pruned)" bash -c "tar -xzOf '$OUT/$oldest' ./marker.txt | grep -q 'run 3'"
check "newest backup is run 16" bash -c "tar -xzOf '$OUT/$newest' ./marker.txt | grep -q 'run 16'"

# 3. restore into an empty folder reproduces the files exactly
rm -f "$DATA/marker.txt"
ONE="$WORK/one"; "$BACKUP" --dir "$DATA" --out "$ONE" >/dev/null
RESTORED="$WORK/restored"
"$RESTORE" "$ONE"/rf-data-*.tar.gz --dir "$RESTORED" >/dev/null
check "restore reproduces every file" diff -r "$DATA" "$RESTORED"

# 4. restore refuses a non-empty target without --force and changes nothing
echo "precious" > "$RESTORED/extra.txt"
"$RESTORE" "$ONE"/rf-data-*.tar.gz --dir "$RESTORED" >/dev/null 2>&1; rc=$?
check "refuses a non-empty target without --force" test "$rc" -ne 0
check "nothing was changed by the refused restore" bash -c "grep -q precious '$RESTORED/extra.txt'"

# 5. --force saves what is there first, overlays, and deletes nothing
echo "locally changed" > "$RESTORED/users.json"
PRE="$WORK/pre"
"$RESTORE" "$ONE"/rf-data-*.tar.gz --dir "$RESTORED" --force --out "$PRE" >/dev/null
check "--force wrote a pre-restore backup" bash -c "ls '$PRE'/rf-data-*.tar.gz >/dev/null 2>&1"
check "pre-restore backup holds the changed file" bash -c "tar -xzOf '$PRE'/rf-data-*.tar.gz ./users.json | grep -q 'locally changed'"
check "users.json is back to the backed-up version" bash -c "grep -q u1 '$RESTORED/users.json'"
check "a file not in the archive was left alone" bash -c "grep -q precious '$RESTORED/extra.txt'"

# 6. failures: missing data folder, empty folder, bad archive, bad options
"$BACKUP" --dir "$WORK/nope" --out "$WORK/o1" >/dev/null 2>&1; check "missing data folder fails" test $? -ne 0
check "a failed backup leaves no file" bash -c "! ls '$WORK/o1'/rf-data-* >/dev/null 2>&1"
mkdir -p "$WORK/emptydata"
"$BACKUP" --dir "$WORK/emptydata" --out "$WORK/o2" >/dev/null 2>&1; check "an empty data folder is refused, not backed up" test $? -ne 0
check "…and leaves no file behind" bash -c "! ls '$WORK/o2'/rf-data-* '$WORK/o2'/*.partial >/dev/null 2>&1"
"$BACKUP" --dir "$DATA" --keep 0 --out "$WORK/o3" >/dev/null 2>&1; check "--keep 0 is rejected" test $? -ne 0
"$BACKUP" --dir "$DATA" --keep abc --out "$WORK/o3" >/dev/null 2>&1; check "--keep abc is rejected" test $? -ne 0
"$BACKUP" >/dev/null 2>&1; check "no mode given is rejected" test $? -ne 0
echo "not an archive" > "$WORK/fake.tar.gz"
"$RESTORE" "$WORK/fake.tar.gz" --dir "$WORK/target" >/dev/null 2>&1; check "restore rejects a file that is not an archive" test $? -ne 0
"$RESTORE" "$WORK/missing.tar.gz" --dir "$WORK/target" >/dev/null 2>&1; check "restore rejects a missing file" test $? -ne 0

# 7. docker mode against a stand-in docker command
FAKE_VOLUME="$WORK/volume"; mkdir -p "$FAKE_VOLUME"; cp -r "$DATA"/. "$FAKE_VOLUME"/
SHIM="$WORK/shim"; mkdir -p "$SHIM"
cat > "$SHIM/docker" <<'SH'
#!/usr/bin/env bash
# Stand-in: understands only "docker compose run --rm -T --no-deps --entrypoint X SERVICE args..."
echo "$@" >> "$FAKE_DOCKER_LOG"
[ "$1" = "compose" ] && [ "$2" = "run" ] || { echo "unexpected: $*" >&2; exit 90; }
shift 2
while [ "$1" != "--entrypoint" ]; do shift; done
shift; entry="$1"; service="$2"; shift 2
[ "$service" = "${EXPECT_SERVICE:-api}" ] || { echo "wrong service $service" >&2; exit 91; }
if [ "$entry" = "tar" ]; then
  args=("${@/\/app\/server\/data/$FAKE_VOLUME}")
  exec tar "${args[@]}"
elif [ "$entry" = "sh" ]; then
  [ "$1" = "-c" ] || exit 92
  cmd="${2//\/app\/server\/data/$FAKE_VOLUME}"
  exec sh -c "$cmd"
fi
exit 93
SH
chmod +x "$SHIM/docker"
export FAKE_VOLUME FAKE_DOCKER_LOG="$WORK/docker.log"; : > "$FAKE_DOCKER_LOG"

DOUT="$WORK/dout"
PATH="$SHIM:$PATH" "$BACKUP" --docker --out "$DOUT" >/dev/null
check "docker mode: backup created from the container data" bash -c "tar -tzf '$DOUT'/rf-data-*.tar.gz | grep -q users.json"
check "docker mode: uses compose run --no-deps --entrypoint tar on service api" bash -c "grep -q -- 'compose run --rm -T --no-deps --entrypoint tar api -czf - -C /app/server/data .' '$FAKE_DOCKER_LOG'"
PATH="$SHIM:$PATH" EXPECT_SERVICE=web "$BACKUP" --docker --service web --out "$WORK/dweb" >/dev/null
check "docker mode: --service is honoured" bash -c "ls '$WORK/dweb'/rf-data-*.tar.gz >/dev/null"

# restore into a non-empty "volume" is refused without --force, works with it
PATH="$SHIM:$PATH" "$RESTORE" "$DOUT"/rf-data-*.tar.gz --docker >/dev/null 2>&1; check "docker restore refuses non-empty volume without --force" test $? -ne 0
echo "volume was changed" > "$FAKE_VOLUME/users.json"
PATH="$SHIM:$PATH" "$RESTORE" "$DOUT"/rf-data-*.tar.gz --docker --force --out "$WORK/dpre" >/dev/null
check "docker restore --force: volume back to the backed-up users.json" bash -c "grep -q u1 '$FAKE_VOLUME/users.json'"
check "docker restore --force: pre-restore backup holds the changed file" bash -c "tar -xzOf '$WORK/dpre'/rf-data-*.tar.gz ./users.json | grep -q 'volume was changed'"

# a docker failure leaves no backup behind
cat > "$SHIM/docker" <<'SH'
#!/usr/bin/env bash
echo "Cannot connect to the Docker daemon" >&2; exit 1
SH
PATH="$SHIM:$PATH" "$BACKUP" --docker --out "$WORK/dfail" >/dev/null 2>&1; check "docker failure makes the backup fail" test $? -ne 0
check "docker failure leaves no file behind" bash -c "! ls '$WORK/dfail'/rf-data-* '$WORK/dfail'/*.partial >/dev/null 2>&1"

echo; echo "$pass passed, $fail failed"
[ "$fail" -eq 0 ]
