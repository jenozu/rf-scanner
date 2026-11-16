# The VPS updates itself

Every 5 minutes the server checks GitHub for a new merge on `main`. When it finds one whose tests
passed, it deploys it with the same safe script as before: backup first, update, rebuild, health
check, and an automatic roll back if the new version is not healthy. No GitHub secrets and no extra
SSH key are needed: the server only *reads* from GitHub, which works without a login because the
repository is public.

## What it does, each run

1. `git fetch` main. If the server already runs the newest commit, it stops (and prints nothing).
2. If the new commits only change documentation, it skips them; they go live with the next code change.
3. It asks GitHub whether the `test` check passed on that exact commit.
   - Still running, or GitHub not reachable: it waits and tries again next run.
   - Failed: it never deploys that commit, and logs `NOT DEPLOYING`.
4. Passed: it runs `scripts/vps/deploy.sh <commit>`, which backs up the data, fast-forwards, rebuilds,
   checks `/api/health`, and rolls back on failure. It refuses if tracked files were edited on the
   server or `JWT_SECRET` is missing, and never deletes data.
5. A commit whose deploy failed or rolled back is not retried. The next newer commit is.
   To try the same commit again: `rf-auto-deploy --retry`.

## One-time setup (on the VPS, as root)

```bash
cd /docker/rf-scanner

# 1. get the newest scripts (this also does the first update, with a backup and health check)
git fetch origin main
git show origin/main:scripts/vps/deploy.sh > /tmp/rf-deploy.sh
RF_DIR=/docker/rf-scanner bash /tmp/rf-deploy.sh "$(git rev-parse origin/main)"

# 2. install the self-update program (a copy outside the repo, so an update never rewrites it mid-run)
sudo install -m 755 /docker/rf-scanner/scripts/vps/auto-deploy.sh /usr/local/bin/rf-auto-deploy

# 3. run it once by hand: it should print nothing (already up to date)
/usr/local/bin/rf-auto-deploy; echo "exit code: $?"

# 4. run it every 5 minutes
( crontab -l 2>/dev/null; echo '*/5 * * * * /usr/local/bin/rf-auto-deploy >> /var/log/rf-auto-deploy.log 2>&1' ) | crontab -
crontab -l
```

If your project is not in `/docker/rf-scanner`, put `RF_DIR=/your/folder ` in front of
`/usr/local/bin/rf-auto-deploy` in the cron line.

## Day to day

- Merge a pull request. About 5 to 15 minutes later (tests take a few minutes) it is live.
- See what happened: `tail -n 50 /var/log/rf-auto-deploy.log`. Lines are time-stamped (UTC).
  `DONE <commit> is live` means it worked.
- A failed or rolled-back deploy: the log says why (`ROLLED BACK`, `DEPLOY REFUSED: ...`). Fix it in a
  new pull request, or fix the server and run `rf-auto-deploy --retry`.
- Pause automatic updates: `crontab -e` and put `#` in front of the `rf-auto-deploy` line.
- Deploy right now instead of waiting: run `/usr/local/bin/rf-auto-deploy` by hand.

## When `scripts/vps/auto-deploy.sh` itself changes

The installed copy in `/usr/local/bin` does not update itself. If a pull request changes this script,
re-run step 2 above. (`deploy.sh` and `check.sh` are used straight from the repo, so they update with
every deploy.)

## Messages

| Log line | Meaning |
|---|---|
| `DEPLOYING abc1234` ... `DONE abc1234 is live` | Updated. |
| `SKIP abc1234: only documentation changed` | Nothing to rebuild. |
| `WAIT abc1234: could not ask GitHub` | GitHub not reachable; tries again in 5 minutes. |
| `NOT DEPLOYING abc1234: the 'test' check did not pass` | Tests failed on GitHub; fix in a new pull request. |
| `DEPLOY REFUSED: tracked files were changed on the VPS` | Someone edited a file on the server. Run `git status` there, undo it, then `rf-auto-deploy --retry`. |
| `DEPLOY REFUSED: JWT_SECRET ...` | `server/.env` needs a `JWT_SECRET` of 32+ characters. |
| `ROLLED BACK` | The new version did not start healthy; the old one is running again. |
| `ROLLBACK FAILED` | Rare. See `docker compose logs api` and `docs/BACKUP_AND_RESTORE.md`. |
| `ERROR git fetch failed` | The server could not reach GitHub; tries again next run. |
