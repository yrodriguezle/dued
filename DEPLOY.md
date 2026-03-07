# Guida al Deployment -- DuedGusto

Questa guida descrive come configurare un VPS Ubuntu per ospitare DuedGusto in produzione, con deploy automatico via GitHub Actions.

---

## Indice

1. [Prerequisiti](#1-prerequisiti)
2. [Setup Iniziale VPS](#2-setup-iniziale-vps)
3. [Configurazione Ambiente](#3-configurazione-ambiente)
4. [Certificato SSL](#4-certificato-ssl)
5. [Primo Deploy](#5-primo-deploy)
6. [CI/CD con GitHub Actions](#6-cicd-con-github-actions)
7. [Operazioni](#7-operazioni)
8. [Struttura Directory VPS](#8-struttura-directory-vps)
9. [Variabili d'Ambiente](#9-variabili-dambiente)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Prerequisiti

### Requisiti Server

| Requisito | Minimo |
|-----------|--------|
| Sistema operativo | Ubuntu 22.04 LTS o superiore |
| RAM | 2 GB |
| Disco | 20 GB |
| CPU | 1 vCPU |

### Requisiti DNS

- Non e necessario un dominio. L'applicazione e accessibile tramite IP pubblico del VPS.
- I certificati SSL sono self-signed (generati automaticamente dallo script di setup).

### Software installato automaticamente dallo script di setup

- Docker Engine + Docker Compose plugin
- Nginx
- OpenSSL (per certificati self-signed)
- UFW (firewall)

---

## 2. Setup Iniziale VPS

### 2.1 Accesso SSH

Connettersi al VPS come root o utente con privilegi sudo:

```bash
ssh root@<IP_VPS>
```

### 2.2 Installazione Node.js

Node.js e necessario per la build del frontend. Installare Node.js 20 LTS:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt-get install -y nodejs
```

Verificare l'installazione:

```bash
node --version   # v20.x.x
npm --version
```

### 2.3 Clonare il repository

```bash
git clone <URL_REPO> /opt/duedgusto
cd /opt/duedgusto
```

### 2.4 Eseguire lo script di setup

Lo script `setup-vps.sh` deve essere eseguito come root. Esegue le seguenti operazioni:

- Aggiornamento pacchetti di sistema
- Installazione Docker Engine, Nginx e OpenSSL
- Configurazione firewall UFW (porte 22, 80, 443)
- Creazione struttura directory (`/opt/duedgusto/frontend/dist`, `/opt/duedgusto/backups`, `/opt/duedgusto/logs`)
- Copia configurazione Nginx da `deploy/nginx/duedgusto.conf`
- Configurazione backup automatico giornaliero alle 03:00 via crontab

```bash
sudo bash deploy/scripts/setup-vps.sh
```

Al termine, lo script mostra i passi successivi da seguire.

---

## 3. Configurazione Ambiente

### 3.1 Creare il file .env

Creare il file `.env` nella root del progetto (`/opt/duedgusto/.env`):

```bash
nano /opt/duedgusto/.env
```

Contenuto:

```env
MYSQL_ROOT_PASSWORD=<password_sicura_mysql>
MYSQL_DATABASE=duedgusto
JWT_SECRET_KEY=<chiave_jwt_lunga>
SUPERADMIN_PASSWORD=<password_superadmin>
```

### 3.2 Generare JWT_SECRET_KEY

Generare una chiave sicura di almeno 64 caratteri:

```bash
openssl rand -base64 64
```

Copiare l'output nel campo `JWT_SECRET_KEY` del file `.env`.

### 3.3 Impostare la password MySQL

Scegliere una password sicura per `MYSQL_ROOT_PASSWORD`. Questa password viene usata da Docker Compose per inizializzare MySQL e dal backend per connettersi al database.

### 3.4 Impostare la password superadmin

`SUPERADMIN_PASSWORD` e la password dell'utente amministratore iniziale che viene creato al primo avvio del backend.

### 3.5 Configurazione frontend di produzione

Modificare il file `duedgusto/config.production.json` sostituendo `<IP_VPS>` con l'IP pubblico del server:

```json
{
  "API_ENDPOINT": "https://<IP_VPS>",
  "GRAPHQL_ENDPOINT": "https://<IP_VPS>/graphql",
  "GRAPHQL_WEBSOCKET": "wss://<IP_VPS>/graphql",
  "COPYRIGHT": "Copyright © 2025 Powered by iansoft"
}
```

Durante il deploy, questo file viene copiato automaticamente come `config.json` nella directory di serving.

---

## 4. Certificato SSL

### 4.1 Certificato self-signed (generato automaticamente)

Lo script `setup-vps.sh` genera automaticamente un certificato SSL self-signed durante il setup iniziale. Il certificato:
- Viene salvato in `/etc/ssl/duedgusto/`
- Ha validita di 10 anni
- Include l'IP del server come Subject Alternative Name (SAN)
- E pronto all'uso senza bisogno di un dominio

I file generati:
- `/etc/ssl/duedgusto/fullchain.pem` - Certificato
- `/etc/ssl/duedgusto/privkey.pem` - Chiave privata

### 4.2 Rigenerare il certificato (es. cambio IP)

Se l'IP del server cambia, rigenerare il certificato:

```bash
SERVER_IP=$(hostname -I | awk '{print $1}')
sudo openssl req -x509 -nodes -days 3650 \
    -newkey rsa:2048 \
    -keyout /etc/ssl/duedgusto/privkey.pem \
    -out /etc/ssl/duedgusto/fullchain.pem \
    -subj "/C=IT/ST=Italy/L=Local/O=DuedGusto/CN=$SERVER_IP" \
    -addext "subjectAltName=IP:$SERVER_IP,IP:127.0.0.1"
sudo systemctl reload nginx
```

### 4.3 Nota sui browser

I certificati self-signed causano un avviso di sicurezza nel browser. Gli utenti dovranno accettare manualmente il certificato al primo accesso. Questo e normale e atteso in assenza di un dominio con certificato CA.

### 4.4 Migrazione futura a Let's Encrypt

Quando si disporra di un dominio, sara possibile migrare a Let's Encrypt:

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d <DOMINIO>
```

Aggiornare poi `deploy/nginx/duedgusto.conf` con i percorsi dei certificati Let's Encrypt e il `server_name` con il dominio.

---

## 5. Primo Deploy

### 5.1 Eseguire il deploy

```bash
cd /opt/duedgusto
bash deploy/scripts/deploy.sh
```

Lo script di deploy esegue automaticamente queste operazioni, nell'ordine:

1. Backup pre-deploy del database (se il container MySQL e in esecuzione)
2. `git pull origin main` per aggiornare il codice
3. `npm ci` e `npm run build` nella directory `duedgusto/`
4. Copia della build frontend in `/opt/duedgusto/frontend/dist/`
5. Copia di `config.production.json` come `config.json` (se presente)
6. `docker compose build backend` per ricostruire l'immagine Docker del backend
7. `docker compose up -d` per avviare/riavviare i container
8. Health check su `http://127.0.0.1:5000/health` (timeout 60 secondi)
9. `systemctl reload nginx`

### 5.2 Verificare il deploy

Verificare che il backend risponda:

```bash
curl -sf http://127.0.0.1:5000/health
```

Verificare che il frontend sia raggiungibile (usare `-k` per accettare il certificato self-signed):

```bash
curl -sfk https://<IP_VPS>
```

Controllare lo stato dei container:

```bash
docker compose ps
```

### 5.3 Log del deploy

I log del deploy vengono scritti in `/opt/duedgusto/logs/deploy.log`.

---

## 6. CI/CD con GitHub Actions

### 6.1 Come funziona

Il workflow `.github/workflows/deploy.yml` si attiva automaticamente ad ogni push sul branch `main`:

1. **Job `build`**: verifica che backend (.NET) e frontend (Node.js) compilino correttamente
2. **Job `deploy`**: si connette al VPS via SSH ed esegue `deploy/scripts/deploy.sh`

### 6.2 Configurare i secrets su GitHub

Andare su **Settings > Secrets and variables > Actions** del repository e aggiungere:

| Secret | Descrizione |
|--------|-------------|
| `VPS_HOST` | Indirizzo IP o hostname del VPS |
| `VPS_USER` | Username SSH (es. `root` o utente con sudo) |
| `SSH_PRIVATE_KEY` | Chiave SSH privata per l'autenticazione |

### 6.3 Generare una chiave SSH dedicata al deploy

Sul VPS, generare una coppia di chiavi SSH dedicate:

```bash
ssh-keygen -t ed25519 -C "github-deploy" -f ~/.ssh/github_deploy -N ""
```

Aggiungere la chiave pubblica alle authorized_keys:

```bash
cat ~/.ssh/github_deploy.pub >> ~/.ssh/authorized_keys
```

Copiare il contenuto della chiave privata e incollarlo nel secret `SSH_PRIVATE_KEY` su GitHub:

```bash
cat ~/.ssh/github_deploy
```

### 6.4 Testare il flusso

Dopo aver configurato i secrets:

1. Fare un commit e push su `main`
2. Verificare l'esecuzione nella tab **Actions** del repository GitHub
3. Il job `build` deve completarsi con successo prima che `deploy` si avvii
4. Controllare i log del deploy sul VPS: `tail -f /opt/duedgusto/logs/deploy.log`

---

## 7. Operazioni

### 7.1 Backup manuale

Eseguire un backup on-demand del database:

```bash
bash /opt/duedgusto/deploy/scripts/backup.sh
```

I backup vengono salvati in `/opt/duedgusto/backups/` con formato `duedgusto_YYYYMMDD_HHMMSS.sql.gz`.

La rotazione automatica elimina i backup piu vecchi di 30 giorni.

Il backup automatico via crontab viene eseguito ogni giorno alle 03:00.

### 7.2 Restore da backup

Per ripristinare un backup:

```bash
# Fermare il backend per evitare scritture durante il restore
docker compose stop backend

# Decomprimere e importare il backup
gunzip -c /opt/duedgusto/backups/duedgusto_YYYYMMDD_HHMMSS.sql.gz | \
    docker exec -i duedgusto-mysql mysql -u root -p"$MYSQL_ROOT_PASSWORD" duedgusto

# Riavviare il backend
docker compose start backend
```

### 7.3 Visualizzare i log

**Log del backend (.NET):**

```bash
docker logs duedgusto-backend --tail 100 -f
```

**Log di MySQL:**

```bash
docker logs duedgusto-mysql --tail 100 -f
```

**Log di Nginx:**

```bash
# Access log
tail -f /var/log/nginx/duedgusto-access.log

# Error log
tail -f /var/log/nginx/duedgusto-error.log
```

**Log del deploy:**

```bash
tail -f /opt/duedgusto/logs/deploy.log
```

**Log dei backup:**

```bash
tail -f /opt/duedgusto/logs/backup.log
```

### 7.4 Restart dei servizi

**Riavviare tutti i container Docker:**

```bash
cd /opt/duedgusto
docker compose restart
```

**Riavviare solo il backend:**

```bash
docker compose restart backend
```

**Riavviare Nginx:**

```bash
sudo systemctl restart nginx
```

### 7.5 Rollback

Per tornare a una versione precedente del codice:

```bash
cd /opt/duedgusto

# Identificare il commit a cui tornare
git log --oneline -10

# Tornare al commit desiderato
git checkout <COMMIT_HASH>

# Ricostruire e riavviare
docker compose build backend
docker compose up -d

# Ricostruire il frontend
cd duedgusto
npm ci
npm run build
rm -rf /opt/duedgusto/frontend/dist/*
cp -r dist/* /opt/duedgusto/frontend/dist/

# Reload Nginx
sudo systemctl reload nginx
```

Per ripristinare anche il database, combinare con un restore da backup (sezione 7.2).

---

## 8. Struttura Directory VPS

```
/opt/duedgusto/
|-- backend/                  # Codice sorgente backend .NET
|   |-- Dockerfile            # Dockerfile per il backend
|   +-- ...
|-- duedgusto/                # Codice sorgente frontend React
|   +-- ...
|-- deploy/
|   |-- nginx/
|   |   +-- duedgusto.conf    # Configurazione Nginx
|   +-- scripts/
|       |-- setup-vps.sh      # Setup iniziale VPS
|       |-- deploy.sh         # Script di deploy
|       +-- backup.sh         # Script di backup database
|-- docker-compose.yml        # Orchestrazione container
|-- .env                      # Variabili d'ambiente (NON versionato)
|-- frontend/
|   +-- dist/                 # Build frontend servita da Nginx
|-- backups/
|   +-- duedgusto_*.sql.gz    # Backup database compressi
+-- logs/
    |-- deploy.log            # Log dei deploy
    +-- backup.log            # Log dei backup
```

Nota: la directory `/opt/duedgusto/` e sia il clone del repository Git sia la directory dell'applicazione. Le cartelle `frontend/dist/`, `backups/` e `logs/` sono create dallo script di setup e non fanno parte del repository.

---

## 9. Variabili d'Ambiente

Tutte le variabili sono definite nel file `.env` nella root del progetto.

| Variabile | Obbligatoria | Descrizione |
|-----------|:------------:|-------------|
| `MYSQL_ROOT_PASSWORD` | Si | Password dell'utente root di MySQL. Usata sia per inizializzare il container MySQL sia nella connection string del backend. |
| `MYSQL_DATABASE` | No | Nome del database. Default: `duedgusto`. |
| `JWT_SECRET_KEY` | Si | Chiave segreta per la firma dei token JWT. Deve essere una stringa lunga e casuale (almeno 64 caratteri). Generare con `openssl rand -base64 64`. |
| `SUPERADMIN_PASSWORD` | Si | Password dell'utente superadmin creato al primo avvio del backend. |

La connection string del backend viene composta automaticamente da Docker Compose:

```
server=mysql;database=${MYSQL_DATABASE:-duedgusto};user=root;password=${MYSQL_ROOT_PASSWORD}
```

---

## 10. Troubleshooting

### 502 Bad Gateway

**Causa**: Nginx non riesce a raggiungere il backend sulla porta 5000.

**Verifiche e soluzioni:**

```bash
# Verificare che il container backend sia in esecuzione
docker compose ps

# Verificare i log del backend
docker logs duedgusto-backend --tail 50

# Verificare che la porta 5000 sia in ascolto
curl -sf http://127.0.0.1:5000/health

# Riavviare il backend
docker compose restart backend
```

Se il container si riavvia continuamente, controllare i log per errori nella connection string o nella configurazione.

### Certificato SSL scaduto o IP cambiato

**Causa**: Il certificato self-signed e scaduto o l'IP del server e cambiato.

**Soluzioni:**

```bash
# Verificare la scadenza del certificato
openssl x509 -in /etc/ssl/duedgusto/fullchain.pem -noout -dates

# Rigenerare il certificato (vedi sezione 4.2)
SERVER_IP=$(hostname -I | awk '{print $1}')
sudo openssl req -x509 -nodes -days 3650 \
    -newkey rsa:2048 \
    -keyout /etc/ssl/duedgusto/privkey.pem \
    -out /etc/ssl/duedgusto/fullchain.pem \
    -subj "/C=IT/ST=Italy/L=Local/O=DuedGusto/CN=$SERVER_IP" \
    -addext "subjectAltName=IP:$SERVER_IP,IP:127.0.0.1"
sudo systemctl reload nginx
```

### Container non parte

**Cause comuni:**

1. **MySQL non si avvia**: volume corrotto o spazio disco esaurito
2. **Backend non si avvia**: variabili d'ambiente mancanti o connection string errata

```bash
# Controllare lo stato dei container
docker compose ps

# Log dettagliati di un container specifico
docker logs duedgusto-mysql --tail 100
docker logs duedgusto-backend --tail 100

# Verificare spazio disco
df -h

# Verificare che il file .env esista e contenga le variabili necessarie
cat /opt/duedgusto/.env

# Ricostruire i container da zero
docker compose down
docker compose up -d --build
```

### Health check fallisce durante il deploy

**Causa**: Il backend non risponde su `http://127.0.0.1:5000/health` entro 60 secondi.

**Soluzioni:**

```bash
# Verificare i log del backend per errori di avvio
docker logs duedgusto-backend --tail 100

# Cause comuni:
# - MySQL non ancora pronto (verificare con docker compose ps)
# - Migrazione del database fallita
# - JWT_SECRET_KEY o CONNECTION_STRING non configurate

# Verificare che MySQL sia healthy
docker inspect duedgusto-mysql --format='{{.State.Health.Status}}'

# Riavviare tutto da zero
docker compose down
docker compose up -d
```

### Database corrotto o perso

```bash
# Ripristinare dall'ultimo backup
ls -la /opt/duedgusto/backups/

# Seguire la procedura di restore (sezione 7.2)
```

### Permessi negati sugli script

```bash
chmod +x deploy/scripts/deploy.sh
chmod +x deploy/scripts/backup.sh
chmod +x deploy/scripts/setup-vps.sh
```

### Frontend non si aggiorna dopo il deploy

**Causa**: Cache del browser o file non copiati correttamente.

```bash
# Verificare che la build sia presente
ls -la /opt/duedgusto/frontend/dist/

# Verificare che config.json sia presente
cat /opt/duedgusto/frontend/dist/config.json

# Forzare il reload di Nginx
sudo systemctl reload nginx
```

Istruire gli utenti a fare un hard refresh del browser (Ctrl+Shift+R).
