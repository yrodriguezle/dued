#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKUP_DIR="/opt/duedgusto/backups"
RETENTION_DAYS=30

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

if [[ -f "$REPO_DIR/.env" ]]; then
    set -a
    source "$REPO_DIR/.env"
    set +a
else
    log "ERRORE: file .env non trovato in $REPO_DIR"
    exit 1
fi

if [[ -z "${MYSQL_ROOT_PASSWORD:-}" ]]; then
    log "ERRORE: MYSQL_ROOT_PASSWORD non definita nel file .env"
    exit 1
fi

mkdir -p "$BACKUP_DIR"

TIMESTAMP="$(date '+%Y%m%d_%H%M%S')"
BACKUP_FILE="$BACKUP_DIR/duedgusto_${TIMESTAMP}.sql.gz"

log "Inizio backup database..."
docker exec duedgusto-mysql mysqldump \
    -u root \
    -p"$MYSQL_ROOT_PASSWORD" \
    --single-transaction \
    --routines \
    --triggers \
    duedgusto | gzip > "$BACKUP_FILE"

FILESIZE=$(stat -c%s "$BACKUP_FILE" 2>/dev/null || stat -f%z "$BACKUP_FILE" 2>/dev/null)
if [[ "$FILESIZE" -le 0 ]]; then
    log "ERRORE: backup vuoto, rimozione file corrotto"
    rm -f "$BACKUP_FILE"
    exit 1
fi

log "Backup creato: $BACKUP_FILE ($(numfmt --to=iec "$FILESIZE"))"

log "Rotazione backup (eliminazione file oltre $RETENTION_DAYS giorni)..."
find "$BACKUP_DIR" -name "duedgusto_*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete

REMAINING=$(find "$BACKUP_DIR" -name "duedgusto_*.sql.gz" -type f | wc -l)
log "Backup completato. $REMAINING backup presenti."
