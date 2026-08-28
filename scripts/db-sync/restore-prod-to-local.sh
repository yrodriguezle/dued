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
# Autenticazione SSH:
#   SSH_KEY + SSH_PASSPHRASE -> chiave protetta, sbloccata via SSH_ASKPASS (non interattivo)
#   SSH_KEY senza passphrase -> ssh con chiave
#   SSH_PASSWORD             -> sshpass (va installato)
#
# Con una chiave il fallback a password/keyboard-interactive e' DISATTIVATO di proposito:
# senza, una chiave che non si sblocca fa provare a ssh la password, e i tentativi
# falliti fanno bannare l'IP da fail2ban sul server.
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

# --- Askpass: sblocca una chiave con passphrase senza prompt ---
# Lo script temporaneo NON contiene il segreto: legge SSH_PASSPHRASE dall'ambiente.
# Si passa da ssh-agent e non da SSH_ASKPASS dato direttamente a ssh: ssh offre la
# chiave, il server la accetta, ma poi non decifra la chiave privata e chiude con
# "No more authentication methods to try" senza alcun messaggio. ssh-add invece
# l'askpass lo usa, e ssh trova la chiave gia' sbloccata nell'agent.
ASKPASS_FILE=""
AGENT_STARTED=false
cleanup_ssh() {
  if [ "$AGENT_STARTED" = true ]; then ssh-agent -k >/dev/null 2>&1 || true; fi
  if [ -n "$ASKPASS_FILE" ]; then rm -f "$ASKPASS_FILE"; fi
}
trap cleanup_ssh EXIT

# --- Build comando SSH ---
SSH_OPTS=(-p "$SSH_PORT" -o ConnectTimeout=15)
if [ -n "${SSH_KEY:-}" ]; then
  # Path Windows ("C:\Users\...") -> forma unix. Nel .env DEVE stare fra apici,
  # altrimenti il source di bash si mangia i backslash e il path arriva qui
  # gia' distrutto ("C:Usersyalian.ssh...") senza modo di recuperarlo.
  case "$SSH_KEY" in
    [A-Za-z]:[\\/]*)
      command -v cygpath >/dev/null 2>&1 && SSH_KEY="$(cygpath -u "$SSH_KEY")" ;;
  esac
  [ -f "$SSH_KEY" ] || die "Chiave SSH non trovata: '$SSH_KEY' (nel .env va fra apici se e' un path Windows)."
  # Fallire subito se la chiave non si sblocca, invece di bruciare tentativi
  # a password che fanno scattare fail2ban lato server.
  SSH_OPTS+=(-i "$SSH_KEY"
             -o IdentitiesOnly=yes
             -o PasswordAuthentication=no
             -o KbdInteractiveAuthentication=no
             -o NumberOfPasswordPrompts=0)
  if [ -n "${SSH_PASSPHRASE:-}" ]; then
    ASKPASS_FILE="$(mktemp)"
    cat > "$ASKPASS_FILE" <<'ASKPASS'
#!/bin/sh
printf '%s\n' "$SSH_PASSPHRASE"
ASKPASS
    chmod 700 "$ASKPASS_FILE"
    export SSH_PASSPHRASE
    export SSH_ASKPASS="$ASKPASS_FILE"
    export SSH_ASKPASS_REQUIRE=force
    export DISPLAY="${DISPLAY:-:0}"   # serve alle versioni che ignorano SSH_ASKPASS_REQUIRE

    eval "$(ssh-agent -s)" >/dev/null
    AGENT_STARTED=true
    ssh-add "$SSH_KEY" >/dev/null 2>&1 \
      || die "Sblocco della chiave fallito: SSH_PASSPHRASE è sbagliata?"
    info "Chiave sbloccata nell'agent."
  fi
fi
SSH_TARGET="$SSH_USER@$SSH_HOST"

# Auth SSH: se SSH_KEY è impostata si usa la chiave. Altrimenti password via sshpass:
# fallback da .env (SSH_PASSWORD); se assente, chiedila al prompt.
SSH_CMD=(ssh)
if [ -z "${SSH_KEY:-}" ]; then
  if [ -z "${SSH_PASSWORD:-}" ]; then
    read -rsp "Password SSH ($SSH_TARGET): " SSH_PASSWORD
    echo
    [ -n "$SSH_PASSWORD" ] || die "Password SSH vuota."
  fi
  command -v sshpass >/dev/null 2>&1 || die "sshpass non installato (brew install sshpass / apt install sshpass)."
  SSH_CMD=(sshpass -p "$SSH_PASSWORD" ssh -o PubkeyAuthentication=no)
fi

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

if ! "${SSH_CMD[@]}" "${SSH_OPTS[@]}" "$SSH_TARGET" "$REMOTE_CMD" | gzip > "$DUMP_FILE"; then
  rm -f "$DUMP_FILE"   # niente .sql.gz da 0 byte in giro: sembrerebbe un dump valido
  if [ -n "${SSH_KEY:-}" ] && [ -z "${SSH_PASSPHRASE:-}" ]; then
    warn "Se la chiave ha una passphrase, valorizza SSH_PASSPHRASE nel .env."
  fi
  die "Dump fallito."
fi

# Verifica dump non vuoto
[ -s "$DUMP_FILE" ] || { rm -f "$DUMP_FILE"; die "Dump vuoto: $DUMP_FILE"; }
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
