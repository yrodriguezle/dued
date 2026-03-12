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

log "=== Inizio deploy DuedGusto ==="

# Backup pre-deploy (skip se i container non esistono ancora)
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "duedgusto-mysql"; then
    log "Esecuzione backup pre-deploy..."
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

log "Reload Nginx..."
sudo systemctl reload nginx

log "=== Deploy completato con successo ==="
