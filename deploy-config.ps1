# ============================================================
# RF Scanner — Server Configuration
# Update this file whenever you change servers.
# All deploy scripts dot-source this file automatically.
# ============================================================

# Your server's public IP (get this from Google Cloud after provisioning)
$SERVER_IP   = "YOUR_GCP_IP"

# SSH user — GCP creates this account automatically from the username in
# your SSH public key (e.g. if your key ends "...== andel", username is "andel")
$SSH_USER    = "YOUR_GCP_USERNAME"

$vpsHost     = "${SSH_USER}@${SERVER_IP}"
$remotePath  = "/var/www/rf-scanner"
