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

# ── Media della vetrina ──────────────────────────────────────────────────────
# Mirror incrementale, NON un archivio a rotazione, e le due politiche divergono perché i
# due dati sono diversi: ogni dump SQL è uno snapshot completo e ridondante, tenerne 30 è
# ragionevole; i media sono contenuto UNICO e immutabile, e ruotarli significa cancellare
# l'unica copia esistente.
#
# Niente --delete: i file non vengono mai sovrascritti (una modifica produce una chiave
# nuova), quindi il mirror accumula la storia completa e un media eliminato per errore
# resta recuperabile. Senza questa scelta il backup smetterebbe di essere un backup e
# diventerebbe una fotocopia dell'errore più recente.
#
# L'if è obbligatorio: con "set -e" un rsync fallito fuori da una condizione aborterebbe
# lo script DOPO un dump del database perfettamente riuscito.
#
# ⚠️ RISCHIO RESIDUO DICHIARATO: il mirror sta sullo STESSO disco dell'originale. Protegge
# dalla cancellazione accidentale e da un ripristino del database, NON dalla perdita del
# disco o del VPS. Vale già oggi per i dump SQL qui accanto; una copia off-site è fuori
# scope, ma va detta invece che lasciata intendere.
#
# RIPRISTINO (da provare una volta, non da improvvisare il giorno del guasto):
#   gunzip -c "$BACKUP_DIR/duedgusto_<timestamp>.sql.gz" \
#     | docker exec -i duedgusto-mysql mysql -u root -p"$MYSQL_ROOT_PASSWORD" duedgusto
#   rsync -a "$BACKUP_DIR/media/" /opt/duedgusto/media/
#   chown -R 10001:10001 /opt/duedgusto/media && chmod -R 755 /opt/duedgusto/media
MEDIA_DIR="/opt/duedgusto/media"
MEDIA_BACKUP="$BACKUP_DIR/media"

if [[ -d "$MEDIA_DIR" ]]; then
    log "Sincronizzazione media..."
    mkdir -p "$MEDIA_BACKUP"
    if rsync -a "$MEDIA_DIR/" "$MEDIA_BACKUP/"; then
        log "Media sincronizzati: $(du -sh "$MEDIA_BACKUP" | cut -f1) in $MEDIA_BACKUP"
    else
        log "ATTENZIONE: sincronizzazione dei media non riuscita. Il dump del database è comunque valido."
    fi
else
    log "Nessuna directory media da sincronizzare ($MEDIA_DIR non esiste)."
fi

# La rotazione riguarda i SOLI dump SQL: il -name qui sotto è ciò che tiene il mirror dei
# media fuori dalla cancellazione per anzianità.
log "Rotazione backup (eliminazione file oltre $RETENTION_DAYS giorni)..."
find "$BACKUP_DIR" -name "duedgusto_*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete

REMAINING=$(find "$BACKUP_DIR" -name "duedgusto_*.sql.gz" -type f | wc -l)
log "Backup completato. $REMAINING backup presenti."
