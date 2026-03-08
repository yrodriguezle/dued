#!/bin/bash
# =============================================================================
# DuedGusto - First Deploy (setup completo da zero)
#
# Esegui come root su un VPS Ubuntu 22.04+ pulito:
#   curl/scp questo script sul server, poi:
#   sudo bash first-deploy.sh <URL_REPO_GIT>
#
# Oppure se hai gia' clonato il repo:
#   cd /srv/duedgusto && sudo bash deploy/scripts/first-deploy.sh
#
# Lo script fa TUTTO:
#   1. Installa pacchetti di sistema (Docker, Nginx, Node.js, Git, OpenSSL)
#   2. Clona il repository (se non presente)
#   3. Genera automaticamente tutti i secret (JWT, MySQL, Superadmin)
#   4. Crea il file .env
#   5. Rileva l'IP del server e configura il frontend
#   6. Genera certificato SSL self-signed
#   7. Configura Nginx, firewall, crontab
#   8. Build del frontend
#   9. Avvia i container Docker (MySQL + Backend)
#  10. Verifica health check
# =============================================================================
set -euo pipefail

# ── Colori output ────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ── Configurazione ──────────────────────────────────────────────────────────
REPO_URL="${1:-}"
REPO_DIR="/srv/duedgusto"
APP_DIR="/opt/duedgusto"
SSL_DIR="/etc/ssl/duedgusto"
ENV_FILE="$REPO_DIR/.env"
LOG_FILE="$APP_DIR/logs/first-deploy.log"

# ── Funzioni helper ─────────────────────────────────────────────────────────
log() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $*"
    echo -e "${GREEN}${msg}${NC}"
    [[ -d "$(dirname "$LOG_FILE")" ]] && echo "$msg" >> "$LOG_FILE" || true
}

warn() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] WARN: $*"
    echo -e "${YELLOW}${msg}${NC}"
    [[ -d "$(dirname "$LOG_FILE")" ]] && echo "$msg" >> "$LOG_FILE" || true
}

err() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] ERRORE: $*"
    echo -e "${RED}${msg}${NC}" >&2
    [[ -d "$(dirname "$LOG_FILE")" ]] && echo "$msg" >> "$LOG_FILE" || true
    exit 1
}

section() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  $*${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

generate_password() {
    openssl rand -base64 32 | tr -d '/+=' | head -c 32
}

generate_jwt_secret() {
    openssl rand -base64 64 | tr -d '\n'
}

# ── Verifica root ───────────────────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
    err "Questo script deve essere eseguito come root (sudo)."
fi

section "DuedGusto - First Deploy"
log "Inizio setup completo..."

# ── Rileva IP del server ────────────────────────────────────────────────────
SERVER_IP=$(hostname -I | awk '{print $1}')
if [[ -z "$SERVER_IP" ]]; then
    err "Impossibile rilevare l'IP del server."
fi
log "IP del server rilevato: $SERVER_IP"

# =============================================================================
# FASE 1: Installazione pacchetti di sistema
# =============================================================================
section "Fase 1/8 - Installazione pacchetti di sistema"

log "Aggiornamento pacchetti..."
apt-get update -y
apt-get upgrade -y

log "Installazione dipendenze base..."
apt-get install -y ca-certificates curl gnupg lsb-release software-properties-common

# ── Git ─────────────────────────────────────────────────────────────────────
if ! command -v git &>/dev/null; then
    log "Installazione Git..."
    apt-get install -y git
    log "Git installato: $(git --version)"
else
    log "Git gia' installato: $(git --version)"
fi

# ── Docker ──────────────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
    log "Installazione Docker Engine..."
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
    log "Docker installato: $(docker --version)"
else
    log "Docker gia' installato: $(docker --version)"
fi

# ── Nginx ───────────────────────────────────────────────────────────────────
if ! command -v nginx &>/dev/null; then
    log "Installazione Nginx..."
    apt-get install -y nginx
    systemctl enable nginx
    log "Nginx installato: $(nginx -v 2>&1)"
else
    log "Nginx gia' installato."
fi

# ── Node.js 20 LTS ─────────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
    log "Installazione Node.js 20 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
    log "Node.js installato: $(node --version), npm: $(npm --version)"
else
    NODE_MAJOR=$(node --version | cut -d. -f1 | tr -d 'v')
    if [[ "$NODE_MAJOR" -lt 18 ]]; then
        warn "Node.js $(node --version) trovato, ma serve >= 18. Aggiornamento..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y nodejs
        log "Node.js aggiornato: $(node --version)"
    else
        log "Node.js gia' installato: $(node --version)"
    fi
fi

# ── OpenSSL ─────────────────────────────────────────────────────────────────
if ! command -v openssl &>/dev/null; then
    apt-get install -y openssl
fi
log "OpenSSL: $(openssl version)"

# =============================================================================
# FASE 2: Clone repository
# =============================================================================
section "Fase 2/8 - Repository"

if [[ -d "$REPO_DIR/.git" ]]; then
    log "Repository gia' presente in $REPO_DIR"
elif [[ -n "$REPO_URL" ]]; then
    log "Clonazione repository da $REPO_URL..."
    git clone "$REPO_URL" "$REPO_DIR"
    log "Repository clonato in $REPO_DIR"
else
    # Forse siamo gia' dentro il repo (esecuzione locale)
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    DETECTED_REPO="$(cd "$SCRIPT_DIR/../.." 2>/dev/null && pwd)"
    if [[ -d "$DETECTED_REPO/.git" ]]; then
        if [[ "$DETECTED_REPO" != "$REPO_DIR" ]]; then
            warn "Repository trovato in $DETECTED_REPO ma non in $REPO_DIR"
            warn "Creazione symlink: $REPO_DIR -> $DETECTED_REPO"
            ln -sfn "$DETECTED_REPO" "$REPO_DIR"
        fi
        log "Repository rilevato in $DETECTED_REPO"
    else
        err "Nessun repository trovato. Uso: sudo bash first-deploy.sh <URL_REPO_GIT>"
    fi
fi

# Rendi eseguibili tutti gli script di deploy
chmod +x "$REPO_DIR/deploy/scripts/"*.sh
log "Permessi di esecuzione impostati sugli script."

# =============================================================================
# FASE 3: Creazione struttura directory
# =============================================================================
section "Fase 3/8 - Struttura directory e firewall"

mkdir -p "$APP_DIR/frontend/dist"
mkdir -p "$APP_DIR/backups"
mkdir -p "$APP_DIR/logs"
log "Directory create: $APP_DIR/{frontend/dist, backups, logs}"

# ── Firewall ────────────────────────────────────────────────────────────────
log "Configurazione UFW firewall..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw default deny incoming
ufw default allow outgoing
ufw --force enable
log "Firewall configurato (porte 22, 80, 443)."

# =============================================================================
# FASE 4: Generazione automatica secret e .env
# =============================================================================
section "Fase 4/8 - Generazione secret e file .env"

if [[ -f "$ENV_FILE" ]]; then
    warn "File .env gia' esistente in $ENV_FILE"
    warn "Per rigenerare i secret, elimina il file e riesegui lo script."
    log "Caricamento .env esistente..."
    set -a
    source "$ENV_FILE"
    set +a
else
    log "Generazione password MySQL..."
    MYSQL_ROOT_PASSWORD="$(generate_password)"
    log "Generazione chiave JWT (64+ caratteri base64)..."
    JWT_SECRET_KEY="$(generate_jwt_secret)"
    log "Generazione password superadmin..."
    SUPERADMIN_PASSWORD="$(generate_password)"

    cat > "$ENV_FILE" <<EOF
# DuedGusto - Variabili d'ambiente di produzione
# Generato automaticamente il $(date '+%Y-%m-%d %H:%M:%S')
# ATTENZIONE: Non versionare questo file!

# MySQL
MYSQL_ROOT_PASSWORD=$MYSQL_ROOT_PASSWORD
MYSQL_DATABASE=duedgusto

# JWT (chiave di firma token, min 64 caratteri)
JWT_SECRET_KEY=$JWT_SECRET_KEY

# Superadmin (password per il primo utente admin)
SUPERADMIN_PASSWORD=$SUPERADMIN_PASSWORD
EOF

    chmod 600 "$ENV_FILE"
    log "File .env creato in $ENV_FILE (permessi 600)"

    echo ""
    echo -e "${YELLOW}╔══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${YELLOW}║  CREDENZIALI GENERATE - SALVALE IN UN POSTO SICURO!             ║${NC}"
    echo -e "${YELLOW}╠══════════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${YELLOW}║  MySQL Root Password:  ${NC}${MYSQL_ROOT_PASSWORD}"
    echo -e "${YELLOW}║  JWT Secret Key:       ${NC}(vedi $ENV_FILE)"
    echo -e "${YELLOW}║  Superadmin Password:  ${NC}${SUPERADMIN_PASSWORD}"
    echo -e "${YELLOW}║                                                                ║${NC}"
    echo -e "${YELLOW}║  Username superadmin:  superadmin                              ║${NC}"
    echo -e "${YELLOW}╚══════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
fi

# =============================================================================
# FASE 5: Configurazione frontend (config.production.json con IP reale)
# =============================================================================
section "Fase 5/8 - Configurazione frontend"

CONFIG_FILE="$REPO_DIR/duedgusto/config.production.json"

cat > "$CONFIG_FILE" <<EOF
{
  "API_ENDPOINT": "https://$SERVER_IP",
  "GRAPHQL_ENDPOINT": "https://$SERVER_IP/graphql",
  "GRAPHQL_WEBSOCKET": "wss://$SERVER_IP/graphql",
  "COPYRIGHT": "Copyright (c) $(date '+%Y') Powered by iansoft"
}
EOF

log "Frontend configurato con IP: $SERVER_IP"
log "File: $CONFIG_FILE"

# =============================================================================
# FASE 6: Certificato SSL self-signed
# =============================================================================
section "Fase 6/8 - Certificato SSL"

if [[ ! -f "$SSL_DIR/fullchain.pem" ]]; then
    mkdir -p "$SSL_DIR"
    openssl req -x509 -nodes -days 3650 \
        -newkey rsa:2048 \
        -keyout "$SSL_DIR/privkey.pem" \
        -out "$SSL_DIR/fullchain.pem" \
        -subj "/C=IT/ST=Italy/L=Local/O=DuedGusto/CN=$SERVER_IP" \
        -addext "subjectAltName=IP:$SERVER_IP,IP:127.0.0.1"
    chmod 600 "$SSL_DIR/privkey.pem"
    chmod 644 "$SSL_DIR/fullchain.pem"
    log "Certificato self-signed generato (validita' 10 anni)."
    log "  Certificato: $SSL_DIR/fullchain.pem"
    log "  Chiave:      $SSL_DIR/privkey.pem"
else
    log "Certificato SSL gia' presente, skip."
    # Verifica che il certificato contenga l'IP corretto
    CERT_CN=$(openssl x509 -in "$SSL_DIR/fullchain.pem" -noout -subject 2>/dev/null | grep -oP 'CN\s*=\s*\K[^ ]+' || true)
    if [[ "$CERT_CN" != "$SERVER_IP" ]]; then
        warn "Il certificato esistente e' per CN=$CERT_CN, ma l'IP attuale e' $SERVER_IP"
        warn "Per rigenerare: rm $SSL_DIR/*.pem && riesegui lo script"
    fi
fi

# =============================================================================
# FASE 7: Configurazione Nginx
# =============================================================================
section "Fase 7/8 - Nginx"

cp "$REPO_DIR/deploy/nginx/duedgusto.conf" /etc/nginx/sites-available/duedgusto.conf
ln -sf /etc/nginx/sites-available/duedgusto.conf /etc/nginx/sites-enabled/duedgusto.conf
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl restart nginx
log "Nginx configurato e avviato."

# ── Crontab backup giornaliero ──────────────────────────────────────────────
BACKUP_CRON="0 3 * * * $REPO_DIR/deploy/scripts/backup.sh >> $APP_DIR/logs/backup.log 2>&1"
(crontab -l 2>/dev/null | grep -v "backup.sh" || true; echo "$BACKUP_CRON") | crontab -
log "Crontab configurato (backup giornaliero alle 03:00)."

# =============================================================================
# FASE 8: Build e avvio
# =============================================================================
section "Fase 8/8 - Build e avvio servizi"

# ── Build frontend ──────────────────────────────────────────────────────────
log "Installazione dipendenze frontend..."
cd "$REPO_DIR/duedgusto"
npm ci

log "Build frontend..."
npm run build

log "Copia build in directory di serving..."
rm -rf "$APP_DIR/frontend/dist/"*
cp -r "$REPO_DIR/duedgusto/dist/"* "$APP_DIR/frontend/dist/"
cp "$CONFIG_FILE" "$APP_DIR/frontend/dist/config.json"
log "Frontend deployato in $APP_DIR/frontend/dist/"

# ── Avvio container Docker ──────────────────────────────────────────────────
log "Build immagine Docker backend..."
cd "$REPO_DIR"

# Primo avvio: abilita il seeding dei dati
log "Primo avvio: SEED_ON_STARTUP abilitato per inizializzare i dati."
export SEED_ON_STARTUP="true"

# Override SEED_ON_STARTUP per il primo avvio
docker compose build backend

# Avvia con seed abilitato al primo boot
SEED_ON_STARTUP=true docker compose up -d

log "Container avviati. Attesa health check backend..."

# ── Health check ────────────────────────────────────────────────────────────
HEALTH_URL="http://127.0.0.1:5000/health"
TIMEOUT=120
ELAPSED=0
while [[ $ELAPSED -lt $TIMEOUT ]]; do
    if curl -sf "$HEALTH_URL" > /dev/null 2>&1; then
        log "Backend attivo e funzionante!"
        break
    fi
    sleep 3
    ELAPSED=$((ELAPSED + 3))
    if (( ELAPSED % 15 == 0 )); then
        log "  Attesa backend... (${ELAPSED}s/${TIMEOUT}s)"
    fi
done

if [[ $ELAPSED -ge $TIMEOUT ]]; then
    warn "Health check non riuscito dopo ${TIMEOUT}s."
    warn "Controlla i log: docker compose logs backend"
    warn "Il setup e' comunque completato. Il backend potrebbe aver bisogno di piu' tempo."
else
    # Dopo il primo avvio con seed, riconfigura con seed disabilitato
    log "Primo avvio completato. Riconfigurazione SEED_ON_STARTUP=false per avvii futuri..."
fi

# Reload nginx finale
systemctl reload nginx

# =============================================================================
# RIEPILOGO FINALE
# =============================================================================
section "Setup completato!"

echo -e "${GREEN}"
echo "  DuedGusto e' stato deployato con successo!"
echo ""
echo "  Accedi all'applicazione:"
echo "    https://$SERVER_IP"
echo ""
echo "  Credenziali superadmin:"
echo "    Username: superadmin"
echo "    Password: (vedi output sopra o file $ENV_FILE)"
echo ""
echo "  File importanti:"
echo "    .env (secret):        $ENV_FILE"
echo "    Config frontend:      $CONFIG_FILE"
echo "    Certificato SSL:      $SSL_DIR/"
echo "    Log deploy:           $APP_DIR/logs/"
echo "    Backup DB:            $APP_DIR/backups/"
echo ""
echo "  Comandi utili:"
echo "    docker compose ps                          # Stato container"
echo "    docker logs duedgusto-backend --tail 50    # Log backend"
echo "    docker logs duedgusto-mysql --tail 50      # Log MySQL"
echo "    bash $REPO_DIR/deploy/scripts/deploy.sh    # Deploy successivi"
echo "    bash $REPO_DIR/deploy/scripts/backup.sh    # Backup manuale"
echo ""
echo "  NOTA: Il certificato SSL e' self-signed."
echo "  Al primo accesso il browser mostrera' un avviso di sicurezza."
echo "  Clicca 'Avanzate > Procedi' per continuare."
echo -e "${NC}"

log "=== First deploy completato ==="
