#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
APP_DIR="/opt/duedgusto"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

if [[ $EUID -ne 0 ]]; then
    echo "Errore: questo script deve essere eseguito come root (sudo)."
    exit 1
fi

log "=== Setup VPS DuedGusto ==="

log "Aggiornamento pacchetti di sistema..."
apt-get update -y
apt-get upgrade -y

log "Installazione dipendenze base..."
apt-get install -y ca-certificates curl gnupg lsb-release

log "Installazione Docker Engine..."
if ! command -v docker &>/dev/null; then
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg

    echo \
        "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
        $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
        tee /etc/apt/sources.list.d/docker.list > /dev/null

    apt-get update -y
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    systemctl enable docker
    systemctl start docker
    log "Docker installato."
else
    log "Docker gia' installato, skip."
fi

log "Installazione Nginx..."
if ! command -v nginx &>/dev/null; then
    apt-get install -y nginx
    systemctl enable nginx
    log "Nginx installato."
else
    log "Nginx gia' installato, skip."
fi

log "Installazione Certbot..."
if ! command -v certbot &>/dev/null; then
    apt-get install -y certbot python3-certbot-nginx
    log "Certbot installato."
else
    log "Certbot gia' installato, skip."
fi

log "Configurazione UFW firewall..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw default deny incoming
ufw default allow outgoing
ufw --force enable
log "Firewall configurato."

log "Creazione struttura directory..."
mkdir -p "$APP_DIR/frontend/dist"
mkdir -p "$APP_DIR/backups"
mkdir -p "$APP_DIR/logs"
mkdir -p /var/www/certbot

log "Configurazione Nginx..."
cp "$REPO_DIR/deploy/nginx/duedgusto.conf" /etc/nginx/sites-available/duedgusto.conf
ln -sf /etc/nginx/sites-available/duedgusto.conf /etc/nginx/sites-enabled/duedgusto.conf
rm -f /etc/nginx/sites-enabled/default
nginx -t
log "Nginx configurato."

log "Configurazione backup automatico (crontab)..."
BACKUP_CRON="0 3 * * * $APP_DIR/deploy/scripts/backup.sh >> $APP_DIR/logs/backup.log 2>&1"
(crontab -l 2>/dev/null | grep -v "backup.sh" || true; echo "$BACKUP_CRON") | crontab -
log "Crontab configurato (backup giornaliero alle 03:00)."

log ""
log "=== Setup completato ==="
log ""
log "Prossimi passi:"
log "  1. Ottenere certificato SSL:"
log "     certbot --nginx -d app.duedgusto.com"
log ""
log "  2. Creare il file .env nella root del progetto ($REPO_DIR/.env):"
log "     MYSQL_ROOT_PASSWORD=<password_sicura>"
log "     MYSQL_DATABASE=duedgusto"
log ""
log "  3. Eseguire il primo deploy:"
log "     $REPO_DIR/deploy/scripts/deploy.sh"
