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

log "Installazione OpenSSL..."
if ! command -v openssl &>/dev/null; then
    apt-get install -y openssl
    log "OpenSSL installato."
else
    log "OpenSSL gia' installato, skip."
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
log "Generazione certificato SSL self-signed..."
SSL_DIR="/etc/ssl/duedgusto"
if [[ ! -f "$SSL_DIR/fullchain.pem" ]]; then
    mkdir -p "$SSL_DIR"
    openssl req -x509 -nodes -days 3650 \
        -newkey rsa:2048 \
        -keyout "$SSL_DIR/privkey.pem" \
        -out "$SSL_DIR/fullchain.pem" \
        -subj "/C=IT/ST=Italy/L=Local/O=DuedGusto/CN=$(hostname -I | awk '{print $1}')" \
        -addext "subjectAltName=IP:$(hostname -I | awk '{print $1}'),IP:127.0.0.1"
    chmod 600 "$SSL_DIR/privkey.pem"
    chmod 644 "$SSL_DIR/fullchain.pem"
    log "Certificato self-signed generato in $SSL_DIR (validita' 10 anni)."
else
    log "Certificato self-signed gia' presente, skip."
fi

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
log "Certificato SSL self-signed generato in: /etc/ssl/duedgusto/"
log ""
log "Prossimi passi:"
log "  1. Creare il file .env nella root del progetto ($REPO_DIR/.env):"
log "     MYSQL_ROOT_PASSWORD=<password_sicura>"
log "     MYSQL_DATABASE=duedgusto"
log "     JWT_SECRET_KEY=<chiave_jwt>"
log "     SUPERADMIN_PASSWORD=<password_superadmin>"
log ""
log "  2. Aggiornare duedgusto/config.production.json con l'IP del server"
log ""
log "  3. Eseguire il primo deploy:"
log "     $REPO_DIR/deploy/scripts/deploy.sh"
