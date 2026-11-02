#!/usr/bin/env bash
# The ONLY thing the GitHub Actions SSH key may run on the VPS.
#
# Install once (see docs/GITHUB_ACTIONS_VPS_GUIDE.md), then lock the key to it in
# ~/.ssh/authorized_keys with:  command="/usr/local/bin/rf-ci-entry",restrict ssh-ed25519 AAAA...
#
# The key can send exactly two requests; anything else is refused:
#   check            read-only health report
#   deploy <sha>     back up, fast-forward to that commit (must be on origin/main), rebuild, verify, roll back on failure
#
# This file is copied to /usr/local/bin and rarely changes. It does not contain deploy
# logic itself: it hands over to scripts/vps/*.sh in the repo, so those update with each deploy.
set -euo pipefail

RF_DIR="${RF_CI_DIR:-/docker/rf-scanner}"   # folder that holds docker-compose.yml on the VPS
cmd="${SSH_ORIGINAL_COMMAND:-}"

case "$cmd" in
  check)
    exec bash "$RF_DIR/scripts/vps/check.sh"
    ;;
  deploy\ *)
    sha="${cmd#deploy }"
    if [[ ! "$sha" =~ ^[0-9a-f]{40}$ ]]; then
      echo "rf-ci-entry: deploy needs a full 40-character commit id" >&2
      exit 2
    fi
    exec bash "$RF_DIR/scripts/vps/deploy.sh" "$sha"
    ;;
  *)
    echo "rf-ci-entry: command not allowed (use: check | deploy <sha>)" >&2
    exit 2
    ;;
esac
