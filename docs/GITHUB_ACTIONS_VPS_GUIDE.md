# GitHub Actions + your VPS: a guide you can reuse

What you get: when a change is merged and its tests pass, GitHub deploys it to your VPS by
itself. Every morning GitHub also checks the server and opens an issue only if something is wrong.
You do the setup once per project (about 15 minutes). After that you do nothing.

## How it works

```
You merge a pull request into main
        |
        v
CI workflow runs the tests            (.github/workflows/ci.yml)
        |  green
        v
"VPS deploy" workflow logs in to the VPS with a special key   (.github/workflows/vps-deploy.yml)
        |
        v
The key can only run ONE program on the VPS: rf-ci-entry
        |   accepts exactly two requests:  "check"   or   "deploy <commit id>"
        v
deploy: backup -> pull that exact commit -> rebuild -> health check -> (roll back if unhealthy)
```

Separately, the "VPS check" workflow runs every morning and on demand. It only reads.

## What the key can and cannot do

| Can | Cannot |
|---|---|
| Ask for a health report | Open a shell or run any other command |
| Ask to deploy a commit that is already on `main` | Deploy a commit that is not on `main`, or an older one |
| (The deploy script) back up, fast-forward, rebuild, roll back | Delete data, touch the data volume, rewrite git history, prune Docker |

The protection is the forced command in `authorized_keys`, not the Linux user. A user in the
`docker` group is as powerful as root, so do not rely on a "limited user" for safety.

**Anyone who can push to `main` can change what runs on your server.** Protect `main`
(step 7) and keep the repository's collaborators to people you trust.

## One-time setup for this project

Do these in order. Steps 1 to 4 are on the VPS (SSH in as you normally do).

**0. Get the new scripts onto the VPS** (the first deploy, by hand, with a backup first):
```bash
cd /docker/rf-scanner
./scripts/backup-data.sh --docker
./scripts/backup-data.sh --dir ./data --out ./backups-host
git pull --ff-only
docker compose up -d --build
docker compose ps
```

**1. Install the entry program** (a copy outside the repo, so a deploy can never rewrite it mid-run):
```bash
sudo install -m 755 /docker/rf-scanner/scripts/vps/ci-entry.sh /usr/local/bin/rf-ci-entry
```
If your folder is not `/docker/rf-scanner`, edit the `RF_DIR=` line in `/usr/local/bin/rf-ci-entry`.

**2. Make the key** (still on the VPS):
```bash
ssh-keygen -t ed25519 -N "" -C "github-actions" -f /tmp/gh_deploy_key
printf 'command="/usr/local/bin/rf-ci-entry",restrict %s\n' "$(cat /tmp/gh_deploy_key.pub)" >> ~/.ssh/authorized_keys
```
The `command=` part locks this key to the entry program. `restrict` turns off terminals and forwarding.

**3. Copy the private key into GitHub, then destroy it:**
```bash
cat /tmp/gh_deploy_key        # copy ALL of it, including the BEGIN and END lines
```
Paste it as the `VPS_SSH_KEY` secret (step 5). Then: `shred -u /tmp/gh_deploy_key /tmp/gh_deploy_key.pub`

**4. Get the server's fingerprint** so GitHub knows it is talking to your server:
```bash
echo "YOUR_VPS_IP_OR_HOSTNAME $(cut -d' ' -f1,2 /etc/ssh/ssh_host_ed25519_key.pub)"
```
Copy that one line for the `VPS_KNOWN_HOSTS` secret. If SSH listens on a port other than 22,
write it as `[YOUR_HOST]:PORT ssh-ed25519 AAAA...` and also add `VPS_PORT`.

**5. Add the secrets** on GitHub: repository, Settings, Secrets and variables, Actions, New repository secret.

| Secret | Value |
|---|---|
| `VPS_HOST` | the VPS IP or hostname |
| `VPS_USER` | the user you put the key under (for example `root`) |
| `VPS_SSH_KEY` | the private key from step 3 |
| `VPS_KNOWN_HOSTS` | the line from step 4 |
| `VPS_PORT` | only if not 22 |

**6. Try it.** Actions tab, "VPS check", Run workflow. It should go green. Then "VPS deploy", Run workflow
(leave the commit box empty). The log shows `DEPLOY SKIPPED` if the VPS already has the latest commit; that is fine.

**7. Protect `main`.** Settings, Branches, Add rule for `main`: require a pull request and require the `test`
check to pass. This is what makes automatic deploys safe.

Also on the VPS, confirm: `JWT_SECRET` is set in `server/.env` (32+ characters), the admin password
is not `admin123`, and the nightly backup cron from `docs/BACKUP_AND_RESTORE.md` is installed
(`crontab -l`). The morning check tells you if any of these is off.

## Day to day

- Merge a pull request: it deploys itself about 5 minutes later. Documentation-only changes do not deploy.
- Something wrong: you get a GitHub issue labelled `vps-alert`. It links to the run log. It closes by itself
  when the next check passes.
- A bad release: the VPS rolls itself back and the run turns red. The log says `ROLLED BACK`.
  Data is not rolled back; the backup taken just before is in `./backups`.
- Deploy a specific commit or re-run: Actions, "VPS deploy", Run workflow.

## If something fails

| Message | Meaning and fix |
|---|---|
| `Permission denied (publickey)` | Wrong key in `VPS_SSH_KEY`, or the line is missing from `~/.ssh/authorized_keys`. |
| `Host key verification failed` | `VPS_KNOWN_HOSTS` does not match this host or port. Redo step 4. |
| `command not allowed` | The workflow sent something other than `check` or `deploy <sha>`. |
| `DEPLOY REFUSED: tracked files were changed on the VPS` | Someone edited a tracked file on the server. Run `git status` there, commit or undo it. |
| `DEPLOY REFUSED: JWT_SECRET ...` | `server/.env` is missing a 32+ character `JWT_SECRET`. |
| `DEPLOY REFUSED: backup failed` | Nothing was changed. Run `./scripts/backup-data.sh --docker` by hand to see why. |
| `ROLLED BACK` | The new version did not pass the health check. Fix it in a new pull request. |
| `ROLLBACK FAILED` | Rare. Both versions are unhealthy. Look at `docker compose logs api`; restore steps are in `docs/BACKUP_AND_RESTORE.md`. |

## Using this in another project

Copy these, then change the marked parts:

| File | Change |
|---|---|
| `scripts/vps/ci-entry.sh` | `RF_DIR` (the project folder on the VPS). Rename the installed program if you run several projects on one VPS, for example `/usr/local/bin/myapp-ci-entry`, with its own key. |
| `scripts/vps/check.sh` | The service names (`api`, `nginx`), the health URL and port, the secret name (`JWT_SECRET`), and the admin-password test if the app has no such login. |
| `scripts/vps/deploy.sh` | The backup commands, the health URL. Keep the order: backup, fast-forward, rebuild, verify, roll back. |
| `.github/workflows/vps-*.yml` | The name of your CI workflow (`workflows: [CI]`) and the docs-only paths. |
| `scripts/test-vps-ci.sh` | Run it in CI so the safety rules stay tested. |

Rules that keep it safe, in any project:
1. One key per project, locked to one entry program with `command=` and `restrict`.
2. The entry program accepts a fixed list of requests and validates every argument. Never pass the client's text to a shell.
3. Take a backup before every deploy and stop if it fails.
4. Only fast-forward, only to commits already on `main`, never delete or rewrite anything.
5. Verify health after the rebuild and roll back on failure.
6. Never print secrets. Public repositories have public workflow logs and issues, so the scripts
   print counts and PASS/FAIL lines, not values. Keep it that way.
7. Do not use third-party Actions for anything that touches secrets. Plain `ssh` is enough.

Quickest way: tell Claude "set up VPS checks and deploys through GitHub Actions like in rf-scanner"
and point it at this file. It will copy and adapt the files and open the pull request; you do steps 1 to 7.
