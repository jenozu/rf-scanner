# Backing up and restoring the warehouse data

The app's data (orders, bins, stock counts, logs, users) lives on the server in one folder.
In production that folder is a Docker volume called `rf_data`, mounted in the `api` container
at `/app/server/data`. These scripts copy that folder into a dated file and bring it back.

You install the schedule on the VPS yourself; nothing here runs on its own.

## What is and is not covered

| Covered by `backup-data.sh --docker` | Not covered (back up separately) |
|---|---|
| Users and their password hashes | The app code (it is in git) |
| Purchase orders, sales orders, waves | `server/.env` (holds `JWT_SECRET`; keep your own copy somewhere safe) |
| Bins and stock quantities | The host folder `./data` next to `docker-compose.yml` (it holds `master_inventory.xlsx` and is **not** the Docker volume) |
| Receiving, picking and counting logs, counting sessions | Traefik / nginx settings |
| Bin locks, activity log, migration backups | |

To include the host `./data` folder as well, run the script a second time against it:

```bash
./scripts/backup-data.sh --dir ./data --out ./backups-host
```

## One-time setup on the VPS

Run these from the folder that contains `docker-compose.yml` (for example `/docker/rf-scanner`).

1. Try it once by hand:
   ```bash
   ./scripts/backup-data.sh --docker
   ls -lh backups/
   ```
   You should see a file like `rf-data-20261030-061500-00.tar.gz` (the time in the name is UTC)
   and a line saying how many files it holds. If the script prints an error, nothing is kept.

2. Schedule it every night. Open the schedule with `crontab -e` and add this line
   (runs at 2:15 am server time and keeps the newest 14 backups):
   ```
   15 2 * * * cd /docker/rf-scanner && ./scripts/backup-data.sh --docker >> /var/log/rf-backup.log 2>&1
   ```
   Check `/var/log/rf-backup.log` the next morning.

3. Copy the backups off the VPS now and then (for example weekly to your own computer).
   A backup on the same disk does not help if the disk is lost. This is not automated.

Keep a different number of backups with `--keep 30`, or another folder with `--out /some/folder`.

## Before anything risky

Take a backup by hand first: before deploying a new version, replacing the master inventory,
or restoring. Deploying the data-cleanup change (task 8) also removes the old tracked data files
from the VPS checkout when you `git pull`, so back up `./data` first:

```bash
./scripts/backup-data.sh --docker
./scripts/backup-data.sh --dir ./data --out ./backups-host
```

## Restoring

1. Stop the app so nobody is saving while you restore:
   ```bash
   docker compose stop api
   ```
2. Pick the backup you want (`ls backups/`, newest is last) and restore it:
   ```bash
   ./scripts/restore-data.sh backups/rf-data-20261030-021500-00.tar.gz --docker --force
   ```
   - `--force` is needed because the volume already has data.
   - The script first saves the current data as its own backup (in `./backups`), so you can undo.
   - It then copies the files from the backup over the current ones. **It never deletes files:**
     a file that exists now but is not in the backup stays as it is.
3. Start the app again and check it:
   ```bash
   docker compose start api
   ```
   Log in and open the Dashboard.

### Restoring into a brand-new empty volume

If the volume is empty, `--force` is not needed:

```bash
./scripts/restore-data.sh backups/rf-data-....tar.gz --docker
```

### Getting just one file back

```bash
mkdir -p /tmp/restore && tar -xzf backups/rf-data-....tar.gz -C /tmp/restore ./rf_bins.json
```
Look at it in `/tmp/restore`, then copy it into place yourself if you want it.

## How it works, in short

- The backup runs `tar` inside a throw-away copy of the `api` container
  (`docker compose run --rm --no-deps ... tar`), so it works whether the app is running or stopped.
- The app writes each data file in one step, so every file in a backup is complete. Files are
  copied one after another, so a backup taken while people are working may hold a receipt in one
  file a moment before it appears in another. For a perfectly consistent copy, stop `api` first.
- The backup goes to a temporary name and is renamed only after the archive has been checked.
  A failed or empty backup is never kept, so an old good backup is never pushed out by a bad one.

## Checking the scripts

```bash
bash scripts/test-backup.sh
```

It tests everything in temporary folders: the archive is created, the 15th run removes the oldest,
a restore reproduces every file, a non-empty target is refused, and failed backups leave nothing
behind. The Docker mode is tested against a stand-in `docker` command, not a real Docker engine,
so the **first real run on the VPS is the real test**: do step 1 above and look at the result.

## If something goes wrong

- `docker: 'compose' is not a docker command`: the VPS has the older `docker-compose`. Install the
  Compose plugin, or tell whoever maintains this to change the two `docker compose` lines in the scripts.
- `no such service: api`: you are not in the folder with `docker-compose.yml`, or the service has
  another name. Use `--service NAME`.
- `the backup is empty or unreadable`: the `api` volume has no files yet (nothing to back up).
