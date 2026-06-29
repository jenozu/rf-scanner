# ============================================================
# RF Scanner — Server Configuration
# Update this file whenever you change servers.
# All deploy scripts dot-source this file automatically.
# ============================================================

# Your server's public IP (Google Cloud VM "rf-scanner", zone us-east1-c)
$SERVER_IP   = "34.73.67.176"

# SSH user — GCP creates this account automatically from the username in
# your SSH public key
$SSH_USER    = "andel_tools"

$vpsHost     = "${SSH_USER}@${SERVER_IP}"
$remotePath  = "/var/www/rf-scanner"
