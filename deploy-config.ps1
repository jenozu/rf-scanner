# ============================================================
# RF Scanner — Server Configuration
# Update this file whenever you change servers.
# All deploy scripts dot-source this file automatically.
# ============================================================

# Your server's public IP (get this from Oracle Cloud after provisioning)
$SERVER_IP   = "YOUR_ORACLE_IP"

# SSH user (Oracle Ubuntu instances use 'ubuntu', not 'root')
$SSH_USER    = "ubuntu"

$vpsHost     = "${SSH_USER}@${SERVER_IP}"
$remotePath  = "/var/www/rf-scanner"
