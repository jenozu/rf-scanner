# ============================================================
# RF Scanner — Server Configuration
# Update this file whenever you change servers.
# All deploy scripts dot-source this file automatically.
# ============================================================

# Your server's public IP (Google Cloud VM "rf-scanner", zone us-east1-c)
# NOTE: GCP assigns a new IP every time the VM stops/restarts unless you
# reserve a static external IP. If SSH ever stops connecting, check the
# VM's current IP in the GCP Console and update this value.
$SERVER_IP   = "34.24.171.56"

# SSH user — GCP creates this account automatically from the username in
# your SSH public key
$SSH_USER    = "andel"

$vpsHost     = "${SSH_USER}@${SERVER_IP}"
$remotePath  = "/var/www/rf-scanner"
