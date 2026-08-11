#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
APP_DIR="/opt/duedgusto"
LOG_FILE="$APP_DIR/logs/deploy.log"

log() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $*"
    echo "$msg"
    echo "$msg" >> "$LOG_FILE"
}

# A differenza di setup-vps.sh e first-deploy.sh, questo script gira come utente NON
# privilegiato: le poche operazioni che toccano root (permessi dei media, configurazione di
# nginx) passano da qui. "-n" perche' senza TTY un prompt di password bloccherebbe il job
# della pipeline fino al timeout invece di fallire subito.
SUDO=""
if [[ $EUID -ne 0 ]]; then
    SUDO="sudo -n"
fi

log "=== Inizio deploy DuedGusto ==="

# Backup pre-deploy (skip se i container non esistono ancora)
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "duedgusto-mysql"; then
    log "Esecuzione backup pre-deploy..."
    chmod +x "$SCRIPT_DIR/backup.sh"
    "$SCRIPT_DIR/backup.sh" || log "WARN: backup fallito, continuo comunque"
else
    log "Container MySQL non trovato, skip backup (primo deploy?)."
fi

# Git pull (skip se HEAD non ha un upstream configurato)
cd "$REPO_DIR"
if git rev-parse --abbrev-ref --symbolic-full-name @{u} &>/dev/null; then
    log "Pull ultime modifiche da git..."
    git stash --include-untracked -q 2>/dev/null || true
    git pull origin main
else
    log "Nessun upstream configurato, skip git pull."
fi

# Usa la versione dal CI se disponibile, altrimenti leggi dal package.json
VERSION="${DEPLOY_VERSION:-$(node -p "require('$REPO_DIR/package.json').version")}"
log "Versione deploy: $VERSION"

log "Build frontend..."
cd "$REPO_DIR/duedgusto"
npm ci
npm run build

log "Copia frontend nella directory di serving..."
# ATTENZIONE: questo rm -rf cancella tutto il contenuto di frontend/dist.
# I media vivono in $APP_DIR/media, FUORI da qui, ed è deliberato: metterli
# sotto dist significherebbe perderli tutti al deploy successivo, con il
# database pieno di riferimenti a file inesistenti e nessun errore visibile.
rm -rf "$APP_DIR/frontend/dist/"*
cp -r "$REPO_DIR/duedgusto/dist/"* "$APP_DIR/frontend/dist/"

# Genera config.json con l'IP reale del server
SERVER_IP=$(hostname -I | awk '{print $1}')
cat > "$APP_DIR/frontend/dist/config.json" <<EOF
{
  "APP_VERSION": "$VERSION",
  "API_ENDPOINT": "https://$SERVER_IP",
  "GRAPHQL_ENDPOINT": "https://$SERVER_IP/graphql",
  "GRAPHQL_WEBSOCKET": "wss://$SERVER_IP/graphql",
  "COPYRIGHT": "Copyright (c) $(date '+%Y') Powered by iansoft"
}
EOF
log "Config generato con IP: $SERVER_IP"

# Media della vetrina: la directory deve esistere e appartenere all'utente del container
# PRIMA dell'avvio, altrimenti il bind mount la crea root e il primo upload fallisce con un
# UnauthorizedAccessException — in produzione, e solo lì.
#
# Cambiare proprietario verso un altro UID richiede CAP_CHOWN, che questo script non ha:
# un chown diretto esce con "Operation not permitted" e "set -e" ferma il deploy a metà —
# frontend già sostituito, container ancora vecchi. Si tocca solo quando serve davvero: a
# regime la directory è già assegnata, e il caso normale non richiede né privilegi né un
# -R su migliaia di media a ogni deploy.
log "Preparazione directory dei media..."
MEDIA_DIR="$APP_DIR/media"
MEDIA_UID=10001   # UID e GID di appuser, fissati in backend/Dockerfile
MEDIA_GID=10001

mkdir -p "$MEDIA_DIR"
if [[ "$(stat -c '%u:%g' "$MEDIA_DIR")" != "$MEDIA_UID:$MEDIA_GID" ]]; then
    log "Directory media da riassegnare a $MEDIA_UID:$MEDIA_GID..."
    # 755: nginx (www-data) legge, solo appuser scrive
    if ! $SUDO chown -R "$MEDIA_UID:$MEDIA_GID" "$MEDIA_DIR" || ! $SUDO chmod -R 755 "$MEDIA_DIR"; then
        log "ERRORE: impossibile assegnare $MEDIA_DIR a $MEDIA_UID:$MEDIA_GID."
        log "Senza questo, il container non puo' scrivere i media caricati dalla vetrina."
        log "Controllare che /etc/sudoers.d/duedgusto-deploy sia installato (0440, root:root)."
        log "Oppure eseguire a mano sul server, come root:"
        log "  chown -R $MEDIA_UID:$MEDIA_GID $MEDIA_DIR && chmod -R 755 $MEDIA_DIR"
        exit 1
    fi
    log "Directory media assegnata a $MEDIA_UID:$MEDIA_GID."
fi

log "Build e restart container Docker..."
cd "$REPO_DIR"
docker compose build backend
docker tag duedgusto-backend:latest "duedgusto-backend:$VERSION"
docker compose up -d

log "Attesa health check backend..."
HEALTH_URL="http://127.0.0.1:5000/health"
TIMEOUT=60
ELAPSED=0
while [[ $ELAPSED -lt $TIMEOUT ]]; do
    if curl -sf "$HEALTH_URL" > /dev/null 2>&1; then
        log "Backend attivo e funzionante."
        break
    fi
    sleep 2
    ELAPSED=$((ELAPSED + 2))
done

if [[ $ELAPSED -ge $TIMEOUT ]]; then
    log "ERRORE: health check fallito dopo ${TIMEOUT}s"
    log "Controlla i log: docker compose logs backend"
    exit 1
fi

# La configurazione di nginx vive nel repo, ma fino a qui la installavano solo setup-vps.sh e
# first-deploy.sh, che si eseguono a mano una volta sola: una location nuova (per esempio
# /media/) restava sul server nella versione vecchia e la pipeline diventava verde su una
# produzione rotta — immagini che rispondono con index.html, upload respinti con un 413 nudo.
# Il ripristino in caso di "nginx -t" fallito non è teatro: una conf non valida non impedisce
# solo il reload, lascia il sito irraggiungibile al primo restart di nginx, anche settimane dopo.
log "Sincronizzazione configurazione Nginx..."
NGINX_CONF_SRC="$REPO_DIR/deploy/nginx/duedgusto.conf"
NGINX_CONF_DST="/etc/nginx/sites-available/duedgusto.conf"

# Percorso di backup FISSO, non un mktemp: è uno degli argomenti autorizzati in
# deploy/sudoers.d/duedgusto-deploy, e sudo confronta la riga di comando parola per parola.
NGINX_CONF_BAK="$APP_DIR/backups/nginx-duedgusto.conf.bak"

if cmp -s "$NGINX_CONF_SRC" "$NGINX_CONF_DST"; then
    log "Configurazione Nginx già aggiornata."
else
    log "Configurazione Nginx cambiata, installazione della nuova versione..."
    HAD_CONF=false
    if [[ -f "$NGINX_CONF_DST" ]]; then
        HAD_CONF=true
        cp "$NGINX_CONF_DST" "$NGINX_CONF_BAK"   # 644 root:root: si legge senza privilegi
    fi

    if ! $SUDO cp "$NGINX_CONF_SRC" "$NGINX_CONF_DST"; then
        log "ERRORE: impossibile scrivere $NGINX_CONF_DST."
        log "Controllare che /etc/sudoers.d/duedgusto-deploy sia installato (0440, root:root)."
        log "Oppure eseguire a mano sul server, come root:"
        log "  cp $NGINX_CONF_SRC $NGINX_CONF_DST && nginx -t && systemctl reload nginx"
        exit 1
    fi

    if ! $SUDO nginx -t; then
        log "ERRORE: la nuova configurazione Nginx non passa 'nginx -t'. Ripristino la precedente."
        if [[ "$HAD_CONF" == true ]]; then
            $SUDO cp "$NGINX_CONF_BAK" "$NGINX_CONF_DST"
        else
            $SUDO rm -f "$NGINX_CONF_DST"
        fi
        exit 1
    fi

    log "Configurazione Nginx aggiornata e validata."
fi

log "Reload Nginx..."
$SUDO systemctl reload nginx

log "=== Deploy completato con successo ==="
