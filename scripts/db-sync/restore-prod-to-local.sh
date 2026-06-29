#!/usr/bin/env bash
#
# Backup DB prod (MySQL in Docker, via SSH) -> restore in locale.
# Config tramite .env nella stessa cartella. Vedi .env.example.
#
# Uso:
#   ./restore-prod-to-local.sh            # dump + restore
#   ./restore-prod-to-local.sh --dump     # solo dump (scarica .sql.gz, no restore)
#   ./restore-prod-to-local.sh --no-drop  # restore senza DROP/CREATE DB
#
set -euo pipefail

# --- Path ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"
DUMP_DIR="$SCRIPT_DIR/dumps"

# --- Colori log ---
c_g='\033[0;32m'; c_y='\033[0;33m'; c_r='\033[0;31m'; c_0='\033[0m'
info()  { echo -e "${c_g}[INFO]${c_0} $*"; }
warn()  { echo -e "${c_y}[WARN]${c_0} $*"; }
err()   { echo -e "${c_r}[ERR ]${c_0} $*" >&2; }
die()   { err "$*"; exit 1; }

# --- Flags ---
DO_RESTORE=true
DO_DROP=true
for arg in "$@"; do
  case "$arg" in
    --dump)    DO_RESTORE=false ;;
    --no-drop) DO_DROP=false ;;
    -h|--help) grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) die "Flag sconosciuto: $arg" ;;
  esac
done

# --- Carica .env ---
[ -f "$ENV_FILE" ] || die ".env mancante. Copia .env.example -> .env e compila."
set -a; . "$ENV_FILE"; set +a

# --- Defaults ---
SSH_PORT="${SSH_PORT:-22}"
LOCAL_MODE="${LOCAL_MODE:-native}"

# --- Validazione minima ---
: "${SSH_HOST:?SSH_HOST mancante in .env}"
: "${SSH_USER:?SSH_USER mancante in .env}"
: "${REMOTE_MYSQL_CONTAINER:?REMOTE_MYSQL_CONTAINER mancante in .env}"
: "${PROD_DB_NAME:?PROD_DB_NAME mancante in .env}"
: "${PROD_DB_USER:?PROD_DB_USER mancante in .env}"
: "${PROD_DB_PASSWORD:?PROD_DB_PASSWORD mancante in .env}"

# --- Build comando SSH ---
SSH_OPTS=(-p "$SSH_PORT" -o ConnectTimeout=15)
[ -n "${SSH_KEY:-}" ] && SSH_OPTS+=(-i "$SSH_KEY")
SSH_TARGET="$SSH_USER@$SSH_HOST"

mkdir -p "$DUMP_DIR"
STAMP="$(date +%Y%m%d_%H%M%S)"
DUMP_FILE="$DUMP_DIR/${PROD_DB_NAME}_prod_${STAMP}.sql.gz"

# ============================================================
# 1. DUMP da prod (mysqldump dentro container, via SSH)
# ============================================================
info "Dump da prod $SSH_TARGET (container $REMOTE_MYSQL_CONTAINER)..."

# Password passata al container via env MYSQL_PWD (non in process list).
# Comando eseguito sul server remoto.
REMOTE_CMD=$(cat <<EOF
docker exec -e MYSQL_PWD='${PROD_DB_PASSWORD}' '${REMOTE_MYSQL_CONTAINER}' \
  mysqldump -u'${PROD_DB_USER}' \
  --single-transaction --routines --triggers --events \
  --no-tablespaces '${PROD_DB_NAME}'
EOF
)

ssh "${SSH_OPTS[@]}" "$SSH_TARGET" "$REMOTE_CMD" | gzip > "$DUMP_FILE"

# Verifica dump non vuoto
[ -s "$DUMP_FILE" ] || die "Dump vuoto o fallito: $DUMP_FILE"
DUMP_SIZE=$(du -h "$DUMP_FILE" | cut -f1)
info "Dump OK: $DUMP_FILE ($DUMP_SIZE)"

if [ "$DO_RESTORE" = false ]; then
  info "Solo dump richiesto. Fine."
  exit 0
fi

# ============================================================
# 2. RESTORE in locale
# ============================================================
DROP_SQL="DROP DATABASE IF EXISTS \`${LOCAL_DB_NAME:-$PROD_DB_NAME}\`; CREATE DATABASE \`${LOCAL_DB_NAME:-$PROD_DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

if [ "$LOCAL_MODE" = "native" ]; then
  : "${LOCAL_DB_USER:?LOCAL_DB_USER mancante}"
  : "${LOCAL_DB_PASSWORD:?LOCAL_DB_PASSWORD mancante}"
  LDB="${LOCAL_DB_NAME:-$PROD_DB_NAME}"
  LHOST="${LOCAL_DB_HOST:-localhost}"
  LPORT="${LOCAL_DB_PORT:-3306}"
  export MYSQL_PWD="$LOCAL_DB_PASSWORD"

  warn "Restore su LOCALE nativo: $LHOST:$LPORT db '$LDB'"
  if [ "$DO_DROP" = true ]; then
    warn "DROP + CREATE database '$LDB' (dati locali esistenti PERSI)."
    mysql -h "$LHOST" -P "$LPORT" -u "$LOCAL_DB_USER" -e "$DROP_SQL"
  fi
  info "Import in corso..."
  gunzip < "$DUMP_FILE" | mysql -h "$LHOST" -P "$LPORT" -u "$LOCAL_DB_USER" "$LDB"
  unset MYSQL_PWD

elif [ "$LOCAL_MODE" = "docker" ]; then
  : "${LOCAL_MYSQL_CONTAINER:?LOCAL_MYSQL_CONTAINER mancante}"
  : "${LOCAL_DOCKER_DB_PASSWORD:?LOCAL_DOCKER_DB_PASSWORD mancante}"
  LDB="${LOCAL_DB_NAME:-$PROD_DB_NAME}"
  LUSER="${LOCAL_DB_USER:-root}"

  # Verifica container attivo
  docker ps --format '{{.Names}}' | grep -qx "$LOCAL_MYSQL_CONTAINER" \
    || die "Container locale '$LOCAL_MYSQL_CONTAINER' non attivo. Avvia: docker compose up -d mysql"

  warn "Restore su LOCALE Docker: container '$LOCAL_MYSQL_CONTAINER' db '$LDB'"
  if [ "$DO_DROP" = true ]; then
    warn "DROP + CREATE database '$LDB' (dati locali esistenti PERSI)."
    docker exec -e MYSQL_PWD="$LOCAL_DOCKER_DB_PASSWORD" "$LOCAL_MYSQL_CONTAINER" \
      mysql -u"$LUSER" -e "$DROP_SQL"
  fi
  info "Import in corso..."
  gunzip < "$DUMP_FILE" | docker exec -i -e MYSQL_PWD="$LOCAL_DOCKER_DB_PASSWORD" \
    "$LOCAL_MYSQL_CONTAINER" mysql -u"$LUSER" "$LDB"

else
  die "LOCAL_MODE non valido: '$LOCAL_MODE' (usa native | docker)"
fi

info "Restore COMPLETATO. DB locale allineato a prod."
info "Avvia backend per applicare eventuali migrazioni: cd backend && dotnet run"
