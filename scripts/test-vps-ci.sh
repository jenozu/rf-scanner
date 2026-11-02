#!/usr/bin/env bash
# Tests for scripts/vps/{ci-entry,check,deploy}.sh. Needs no Docker and no network:
# a throwaway git "origin" plays GitHub, a clone plays the VPS, and stand-in
# docker / curl / crontab commands record what would have happened.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VPS="$HERE/vps"
WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT
pass=0; fail=0
ok()   { pass=$((pass + 1)); echo "PASS $1"; }
bad()  { fail=$((fail + 1)); echo "FAIL $1"; }
check(){ local name="$1"; shift; if "$@"; then ok "$name"; else bad "$name"; fi; }
no()   { ! "$@"; }

command -v flock >/dev/null || { echo "SKIP: flock not installed"; exit 0; }

# ---------- stand-in commands ----------
BIN="$WORK/bin"; mkdir -p "$BIN"
export FAKE_LOG="$WORK/fake.log"; : > "$FAKE_LOG"

cat > "$BIN/docker" <<'EOF'
#!/usr/bin/env bash
echo "docker $*" >> "$FAKE_LOG"
if [ "$1 $2" = "compose ps" ]; then
  echo api; [ -n "${FAKE_NO_NGINX:-}" ] || echo nginx
fi
exit 0
EOF
cat > "$BIN/curl" <<'EOF'
#!/usr/bin/env bash
if printf '%s ' "$@" | grep -q 'http_code'; then printf '%s' "${FAKE_LOGIN_CODE:-401}"; exit 0; fi
# health: unhealthy whenever the checked-out code contains a file called BAD
if [ -e "${RF_DIR:-.}/BAD" ] || [ -n "${FAKE_UNHEALTHY:-}" ]; then exit 22; fi
echo '{"status":"ok"}'
EOF
cat > "$BIN/crontab" <<'EOF'
#!/usr/bin/env bash
[ -n "${FAKE_NO_CRON:-}" ] && exit 0
echo '15 2 * * * cd /docker/rf-scanner && ./scripts/backup-data.sh --docker'
EOF
chmod +x "$BIN"/*
export PATH="$BIN:$PATH"

# ---------- a fake origin and a fake VPS clone ----------
ORIGIN="$WORK/origin.git"; SEED="$WORK/seed"; APP="$WORK/app"
git init -q --bare -b main "$ORIGIN"
git init -q -b main "$SEED"
git -C "$SEED" config user.email t@t; git -C "$SEED" config user.name t
mkdir -p "$SEED/scripts/vps" "$SEED/server"
cp "$VPS"/*.sh "$SEED/scripts/vps/"
cat > "$SEED/scripts/backup-data.sh" <<'EOF'
#!/usr/bin/env bash
[ -z "${FAKE_BACKUP_FAIL:-}" ] || { echo "backup stub: failing on purpose" >&2; exit 1; }
mkdir -p backups; touch "backups/rf-data-$(date -u +%Y%m%d-%H%M%S)-00.tar.gz"
echo "backup ran $*" >> "$FAKE_LOG"
EOF
echo "JWT_SECRET=0123456789abcdef0123456789abcdef0123" > "$SEED/server/.env"
echo "services: {}" > "$SEED/docker-compose.yml"
echo v1 > "$SEED/version.txt"
git -C "$SEED" add -A; git -C "$SEED" commit -qm v1
git -C "$SEED" remote add origin "$ORIGIN"; git -C "$SEED" push -q origin main
git clone -q "$ORIGIN" "$APP"
git -C "$APP" config user.email t@t; git -C "$APP" config user.name t

export RF_DIR="$APP" RF_LOCK="$WORK/lock" RF_HEALTH_WAIT=3 RF_HEALTH_SLEEP=1
head_of() { git -C "$APP" rev-parse HEAD; }
new_commit() { # new_commit <file> -> pushes a commit to origin/main, prints its sha
  echo "$1-$RANDOM" >> "$SEED/$1"; git -C "$SEED" add -A; git -C "$SEED" commit -qm "$1"
  git -C "$SEED" push -q origin main; git -C "$SEED" rev-parse HEAD
}

# ===== 1. ci-entry only allows check / deploy <sha> =====
STUB="$WORK/stub"; mkdir -p "$STUB/scripts/vps"
echo 'echo CHECK-RAN' > "$STUB/scripts/vps/check.sh"
echo 'echo "DEPLOY-RAN $1"' > "$STUB/scripts/vps/deploy.sh"
entry() { SSH_ORIGINAL_COMMAND="$1" RF_CI_DIR="$STUB" bash "$VPS/ci-entry.sh" 2>&1; }
SHA40=$(printf 'a%.0s' $(seq 1 40))
check "entry: 'check' runs the check script"        bash -c "[ \"\$(SSH_ORIGINAL_COMMAND=check RF_CI_DIR='$STUB' bash '$VPS/ci-entry.sh')\" = CHECK-RAN ]"
check "entry: 'deploy <sha>' passes the sha on"      bash -c "[ \"\$(SSH_ORIGINAL_COMMAND='deploy $SHA40' RF_CI_DIR='$STUB' bash '$VPS/ci-entry.sh')\" = 'DEPLOY-RAN $SHA40' ]"
check "entry: empty command refused"                 no bash -c "SSH_ORIGINAL_COMMAND='' RF_CI_DIR='$STUB' bash '$VPS/ci-entry.sh'"
check "entry: a shell is refused"                    no bash -c "SSH_ORIGINAL_COMMAND='bash' RF_CI_DIR='$STUB' bash '$VPS/ci-entry.sh'"
check "entry: 'ls; rm -rf /' is refused"             no bash -c "SSH_ORIGINAL_COMMAND='ls; rm -rf /' RF_CI_DIR='$STUB' bash '$VPS/ci-entry.sh'"
check "entry: 'check; ls' is refused"                no bash -c "SSH_ORIGINAL_COMMAND='check; ls' RF_CI_DIR='$STUB' bash '$VPS/ci-entry.sh'"
check "entry: short sha refused"                     no bash -c "SSH_ORIGINAL_COMMAND='deploy abc123' RF_CI_DIR='$STUB' bash '$VPS/ci-entry.sh'"
check "entry: sha with trailing command refused"     no bash -c "SSH_ORIGINAL_COMMAND='deploy $SHA40; ls' RF_CI_DIR='$STUB' bash '$VPS/ci-entry.sh'"
check "entry: option-looking sha refused"            no bash -c "SSH_ORIGINAL_COMMAND='deploy --force' RF_CI_DIR='$STUB' bash '$VPS/ci-entry.sh'"

# ===== 2. deploy: happy path =====
before=$(head_of); : > "$FAKE_LOG"
GOOD=$(new_commit version.txt)
out=$(bash "$VPS/deploy.sh" "$GOOD" 2>&1); code=$?
check "deploy: good commit exits 0"                  test "$code" -eq 0
check "deploy: reports DEPLOY OK"                    bash -c "echo '$out' | grep -q 'DEPLOY OK'"
check "deploy: VPS is now at the new commit"         test "$(head_of)" = "$GOOD"
check "deploy: backup ran before the rebuild"        bash -c "grep -n 'backup ran' '$FAKE_LOG' | head -1 | cut -d: -f1 > '$WORK/b'; grep -n 'compose up' '$FAKE_LOG' | head -1 | cut -d: -f1 > '$WORK/u'; [ \$(cat '$WORK/b') -lt \$(cat '$WORK/u') ]"
check "deploy: rebuilt with compose up --build"      grep -q 'compose up -d --build' "$FAKE_LOG"

# ===== 3. deploy: already deployed =====
: > "$FAKE_LOG"
out=$(bash "$VPS/deploy.sh" "$GOOD" 2>&1); code=$?
check "deploy: same commit again is skipped, exit 0" bash -c "[ $code -eq 0 ] && echo '$out' | grep -q SKIPPED"
check "deploy: skipped run makes no backup/rebuild"  test ! -s "$FAKE_LOG"
check "deploy: an OLDER commit is skipped too"       bash -c "bash '$VPS/deploy.sh' '$before' 2>&1 | grep -q SKIPPED"

# ===== 4. deploy: bad version rolls back =====
prev=$(head_of); : > "$FAKE_LOG"
BADSHA=$(new_commit BAD)
out=$(bash "$VPS/deploy.sh" "$BADSHA" 2>&1); code=$?
check "deploy: unhealthy version exits non-zero"     test "$code" -eq 1
check "deploy: says ROLLED BACK"                     bash -c "echo '$out' | grep -q 'ROLLED BACK'"
check "deploy: VPS is back on the previous commit"   test "$(head_of)" = "$prev"
check "deploy: no BAD file left in the working tree" test ! -e "$APP/BAD"
check "deploy: rebuilt twice (new, then rollback)"   bash -c "[ \$(grep -c 'compose up' '$FAKE_LOG') -eq 2 ]"

# ===== 5. deploy: refusals leave everything untouched =====
# 5a. a commit that is NOT on origin/main
git -C "$SEED" checkout -q -b side; echo x > "$SEED/side.txt"; git -C "$SEED" add -A; git -C "$SEED" commit -qm side
SIDE=$(git -C "$SEED" rev-parse HEAD); git -C "$SEED" push -q origin side; git -C "$SEED" checkout -q main
prev=$(head_of); : > "$FAKE_LOG"
check "deploy: commit not on main is refused"        no bash "$VPS/deploy.sh" "$SIDE"
check "deploy: ...and nothing changed"               bash -c "[ '$(head_of)' = '$prev' ] && [ ! -s '$FAKE_LOG' ]"

# 5b. a short / invalid id
check "deploy: short id refused"                     no bash "$VPS/deploy.sh" abc123

# 5c. edited tracked file on the VPS
NEXT=$(new_commit version.txt)
echo local-edit >> "$APP/version.txt"
check "deploy: locally edited tracked file refused"  no bash "$VPS/deploy.sh" "$NEXT"
check "deploy: ...and the local edit is untouched"   grep -q local-edit "$APP/version.txt"
git -C "$APP" checkout -q -- version.txt

# 5d. missing JWT_SECRET
cp "$APP/server/.env" "$WORK/env.bak"; sed -i 's/^JWT_SECRET=.*/JWT_SECRET=/' "$APP/server/.env"
git -C "$APP" update-index --assume-unchanged server/.env
check "deploy: missing JWT_SECRET refused"           no bash "$VPS/deploy.sh" "$NEXT"
cp "$WORK/env.bak" "$APP/server/.env"

# 5e. backup fails -> nothing changes
prev=$(head_of)
check "deploy: failed backup refuses the deploy"     no env FAKE_BACKUP_FAIL=1 bash "$VPS/deploy.sh" "$NEXT"
check "deploy: ...and the code is unchanged"         test "$(head_of)" = "$prev"

# 5f. a second deploy while one is running
( exec 8>"$RF_LOCK"; flock -n 8; sleep 3 ) & sleep 1
check "deploy: refused while another deploy runs"    no bash "$VPS/deploy.sh" "$NEXT"
wait

# ===== 6. check =====
mkdir -p "$APP/backups"; touch "$APP/backups/rf-data-fresh.tar.gz"
out=$(bash "$VPS/check.sh" 2>&1); code=$?
check "check: healthy server passes"                 bash -c "[ $code -eq 0 ] && echo '$out' | grep -q 'all required checks passed'"
check "check: never prints the secret"               bash -c "! echo '$out' | grep -q 0123456789abcdef"
check "check: default admin password rejected"       bash -c "echo '$out' | grep -q 'admin123 is rejected'"
check "check: default admin login that works FAILS"  bash -c "FAKE_LOGIN_CODE=200 bash '$VPS/check.sh' 2>&1 | grep -q 'FAIL.*admin123'"
check "check: missing cron FAILS"                    bash -c "FAKE_NO_CRON=1 bash '$VPS/check.sh' 2>&1 | grep -q 'FAIL.*cron'"
check "check: stopped nginx FAILS"                   bash -c "FAKE_NO_NGINX=1 bash '$VPS/check.sh' 2>&1 | grep -q \"FAIL.*'nginx'\""
check "check: unhealthy API FAILS and exits 1"       bash -c "FAKE_UNHEALTHY=1 bash '$VPS/check.sh' >/dev/null 2>&1; [ \$? -eq 1 ]"
check "check: no recent backup FAILS"                bash -c "rm -f '$APP'/backups/*; bash '$VPS/check.sh' 2>&1 | grep -q 'FAIL.*backup newer'"
check "check: is read-only (no compose up)"          bash -c "! grep -q 'compose up' <(FAKE_LOG='$WORK/ro.log' bash '$VPS/check.sh' >/dev/null 2>&1; cat '$WORK/ro.log' 2>/dev/null)"

# ===== 7. syntax of every script =====
for f in "$VPS"/*.sh "$HERE/test-vps-ci.sh"; do check "bash -n $(basename "$f")" bash -n "$f"; done

echo
echo "passed: $pass, failed: $fail"
[ "$fail" -eq 0 ]
