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

# Le variabili di ambiente del server. docker compose legge .env da solo per interpolare
# ${...} nel compose file, ma la SHELL no: senza questo blocco APP_ORIGINE_PUBBLICA e
# SITO_ORIGINE_PUBBLICA sarebbero vuote qui dentro, e il config.json tornerebbe a cablare l'IP
# senza che nessuno se ne accorga.
if [[ -f "$REPO_DIR/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$REPO_DIR/.env"
    set +a
fi

# 🔴 I CONTROLLI DI CONFIGURAZIONE STANNO IN TESTA, prima che qualunque cosa venga toccata.
#    Piu' in basso sarebbero peggio che inutili: il frontend viene sostituito a meta' script
#    (rm -rf di frontend/dist), quindi un'uscita tardiva lascerebbe la produzione con
#    l'interfaccia NUOVA e i container VECCHI — uno stato che nessuno ha mai provato.
#
# SITO_ORIGINE_PUBBLICA e' un ARGOMENTO DI BUILD, non una variabile di runtime: astro:env
# la inlina nel bundle della vetrina. Il controllo vive qui e non nel Dockerfile perche' il
# messaggio deve nominare il file da correggere sul server — dentro l'immagine si saprebbe
# solo che manca un --build-arg, non dove metterlo.
if [[ -z "${SITO_ORIGINE_PUBBLICA:-}" ]]; then
    echo "ERRORE: SITO_ORIGINE_PUBBLICA non e' definita in $REPO_DIR/.env." >&2
    echo "E' l'origine da cui il BROWSER del visitatore scarica le foto della vetrina:" >&2
    echo "finisce dentro src/srcset delle immagini e dentro og:image, quindi deve essere" >&2
    echo "l'host pubblico del sito con https. Esempio:" >&2
    echo "  SITO_ORIGINE_PUBBLICA=https://duedgusto.it" >&2
    exit 1
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

# Genera config.json con l'origine da cui la SPA chiama l'API.
#
# 🔴 CABLARE QUI L'IP E' CIO' CHE ROMPEREBBE IL GIORNO DEL CUTOVER, con la pipeline verde.
#    Servendo la cassa da https://app.duedgusto.it, un config.json che dicesse
#    "https://217.154.173.33" manderebbe il browser su un ALTRO origin, con un certificato
#    che non nomina l'IP: preflight CORS fallito, cookie del refresh token non inviato,
#    login impossibile. Nessuno degli errori sarebbe visibile nei log del deploy.
#
# Il default resta l'IP, quindi finche' APP_ORIGINE_PUBBLICA non e' definita in .env il
# comportamento e' identico a prima: il cutover diventa una riga di configurazione, non
# una modifica di questo script sotto pressione.
SERVER_IP=$(hostname -I | awk '{print $1}')
APP_ORIGINE="${APP_ORIGINE_PUBBLICA:-https://$SERVER_IP}"
APP_ORIGINE="${APP_ORIGINE%/}"                 # una "/" finale duplicherebbe la barra negli URL
APP_ORIGINE_WS="wss://${APP_ORIGINE#https://}" # stesso host, schema del websocket

cat > "$APP_DIR/frontend/dist/config.json" <<EOF
{
  "APP_VERSION": "$VERSION",
  "API_ENDPOINT": "$APP_ORIGINE",
  "GRAPHQL_ENDPOINT": "$APP_ORIGINE/graphql",
  "GRAPHQL_WEBSOCKET": "$APP_ORIGINE_WS/graphql",
  "COPYRIGHT": "Copyright (c) $(date '+%Y') Powered by iansoft"
}
EOF
if [[ -n "${APP_ORIGINE_PUBBLICA:-}" ]]; then
    log "Config generato con origine dichiarata: $APP_ORIGINE"
else
    log "Config generato con IP: $SERVER_IP (APP_ORIGINE_PUBBLICA non definita in .env)"
fi

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

MEDIA_MODO=755   # nginx (www-data) legge, solo appuser scrive

mkdir -p "$MEDIA_DIR"

# 🔴 PROPRIETARIO E MODO SI CONTROLLANO SEPARATAMENTE, e non e' pedanteria.
#    Fino al 12 agosto 2026 il chmod viveva DENTRO l'if del proprietario, quindi una
#    directory con l'UID giusto e il modo sbagliato non veniva piu' corretta da nessuno.
#    Ed e' successo davvero: l'11 agosto un deploy fallita la chown (sudoers non ancora
#    installato) lascio' /opt/duedgusto/media a 775 — il modo che "mkdir -p" produce con
#    l'umask 002 dell'utente deploy. Qualcuno sistemo' a mano il solo proprietario, e da
#    quel momento ogni deploy successivo salto' il blocco: la produzione e' rimasta a 775
#    per un giorno intero, con lo script convinto di averla assegnata.
if [[ "$(stat -c '%u:%g' "$MEDIA_DIR")" != "$MEDIA_UID:$MEDIA_GID" ]]; then
    log "Directory media da riassegnare a $MEDIA_UID:$MEDIA_GID..."
    if ! $SUDO chown -R "$MEDIA_UID:$MEDIA_GID" "$MEDIA_DIR"; then
        log "ERRORE: impossibile assegnare $MEDIA_DIR a $MEDIA_UID:$MEDIA_GID."
        log "Senza questo, il container non puo' scrivere i media caricati dalla vetrina."
        log "Controllare che /etc/sudoers.d/duedgusto-deploy sia installato (0440, root:root)."
        log "Oppure eseguire a mano sul server, come root:"
        log "  chown -R $MEDIA_UID:$MEDIA_GID $MEDIA_DIR"
        exit 1
    fi
    log "Directory media assegnata a $MEDIA_UID:$MEDIA_GID."
fi

if [[ "$(stat -c '%a' "$MEDIA_DIR")" != "$MEDIA_MODO" ]]; then
    log "Directory media da riportare a $MEDIA_MODO (ora: $(stat -c '%a' "$MEDIA_DIR"))..."
    if ! $SUDO chmod -R "$MEDIA_MODO" "$MEDIA_DIR"; then
        log "ERRORE: impossibile impostare il modo $MEDIA_MODO su $MEDIA_DIR."
        log "Controllare che /etc/sudoers.d/duedgusto-deploy sia installato (0440, root:root)."
        log "Oppure eseguire a mano sul server, come root:"
        log "  chmod -R $MEDIA_MODO $MEDIA_DIR"
        exit 1
    fi
    log "Directory media riportata a $MEDIA_MODO."
fi

log "Build e restart container Docker..."
cd "$REPO_DIR"
docker compose build backend sito
docker tag duedgusto-backend:latest "duedgusto-backend:$VERSION"
docker tag duedgusto-sito:latest "duedgusto-sito:$VERSION" 2>/dev/null || true
docker compose up -d

# Due attese distinte, e non una sola: il sito degrada quando il backend non risponde
# (la home resta 200 con marca, slogan e orari), quindi un sito "vivo" NON dimostra che
# il backend lo sia. Misurarli insieme renderebbe verde un deploy con l'API a terra.
attendi() {
    local nome="$1" url="$2" timeout="${3:-60}" trascorso=0
    log "Attesa health check $nome..."
    while [[ $trascorso -lt $timeout ]]; do
        if curl -sf "$url" > /dev/null 2>&1; then
            log "$nome attivo e funzionante."
            return 0
        fi
        sleep 2
        trascorso=$((trascorso + 2))
    done
    log "ERRORE: health check $nome fallito dopo ${timeout}s"
    log "Controlla i log: docker compose logs ${nome,,}"
    return 1
}

attendi "backend" "http://127.0.0.1:5000/health" 60 || exit 1
attendi "sito"    "http://127.0.0.1:4321/"       60 || exit 1

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
