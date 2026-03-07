# Guida al Deployment -- DuedGusto

Configurazione di un VPS Ubuntu per ospitare DuedGusto in produzione.

---

## Indice

1. [Prerequisiti](#1-prerequisiti)
2. [Setup VPS](#2-setup-vps)
3. [Configurazione Ambiente](#3-configurazione-ambiente)
4. [Certificato SSL](#4-certificato-ssl)
5. [Primo Deploy](#5-primo-deploy)
6. [CI/CD](#6-cicd)
7. [Operazioni](#7-operazioni)
8. [Struttura VPS](#8-struttura-vps)
9. [Variabili d'Ambiente](#9-variabili-dambiente)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Prerequisiti

| Requisito | Minimo |
|-----------|--------|
| OS | Ubuntu 22.04 LTS |
| RAM | 2 GB |
| Disco | 20 GB |
| CPU | 1 vCPU |

Non serve un dominio. L'app e accessibile via IP con certificato SSL self-signed.

---

## 2. Setup VPS

### 2.1 Accesso SSH

```bash
ssh root@<IP_VPS>
```

### 2.2 Installazione Node.js 20 LTS

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt-get install -y nodejs
```

### 2.3 Clonare il repository

Il repository va in `/srv/duedgusto` (codice sorgente e build). La directory `/opt/duedgusto` (runtime) viene creata dallo script di setup.

```bash
git clone <URL_REPO> /srv/duedgusto
```

### 2.4 Eseguire lo script di setup

```bash
cd /srv/duedgusto
sudo bash deploy/scripts/setup-vps.sh
```

Lo script:
- Installa Docker Engine, Nginx, OpenSSL
- Configura firewall UFW (porte 22, 80, 443)
- Genera certificato SSL self-signed (10 anni)
- Crea `/opt/duedgusto/` con sottodirectory `frontend/dist`, `backups`, `logs`
- Configura Nginx come reverse proxy
- Imposta backup automatico giornaliero alle 03:00

---

## 3. Configurazione Ambiente

### 3.1 Creare il file .env

```bash
nano /srv/duedgusto/.env
```

```env
MYSQL_ROOT_PASSWORD=<password_sicura_mysql>
MYSQL_DATABASE=duedgusto
JWT_SECRET_KEY=<chiave_jwt_64_caratteri>
SUPERADMIN_PASSWORD=<password_superadmin>
```

```bash
chmod 600 /srv/duedgusto/.env
```

### 3.2 Generare JWT_SECRET_KEY

```bash
openssl rand -base64 64
```

### 3.3 Configurare il frontend

Modificare `duedgusto/config.production.json` con l'IP reale del VPS:

```bash
nano /srv/duedgusto/duedgusto/config.production.json
```

```json
{
  "API_ENDPOINT": "https://<IP_VPS>",
  "GRAPHQL_ENDPOINT": "https://<IP_VPS>/graphql",
  "GRAPHQL_WEBSOCKET": "wss://<IP_VPS>/graphql",
  "COPYRIGHT": "Copyright © 2025 Powered by iansoft"
}
```

---

## 4. Certificato SSL

### 4.1 Self-signed (automatico)

Generato dallo script di setup in `/etc/ssl/duedgusto/`. Validita 10 anni, include l'IP del server come SAN.

### 4.2 Rigenerare (es. cambio IP)

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

### 4.3 Browser

I certificati self-signed causano un avviso nel browser. Cliccare **Avanzate > Procedi** al primo accesso.

### 4.4 Migrazione futura a Let's Encrypt

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d <DOMINIO>
```

Aggiornare poi `deploy/nginx/duedgusto.conf` con i percorsi Let's Encrypt e il `server_name`.

---

## 5. Primo Deploy

```bash
cd /srv/duedgusto
bash deploy/scripts/deploy.sh
```

Il deploy esegue:
1. Backup pre-deploy del database
2. `git pull origin main`
3. Build frontend (`npm ci && npm run build`)
4. Copia build in `/opt/duedgusto/frontend/dist/`
5. Build immagine Docker backend
6. Avvio container (MySQL + backend)
7. Health check su `http://127.0.0.1:5000/health`
8. Reload Nginx

### Verifiche

```bash
docker compose ps
curl -sf http://127.0.0.1:5000/health
curl -sfk https://<IP_VPS>
```

---

## 6. CI/CD

Vedi [SETUP-CICD.md](./SETUP-CICD.md) per la guida completa.

Il workflow `.github/workflows/deploy.yml` si connette al VPS via SSH ed esegue `deploy.sh`.

Secrets necessari su GitHub:

| Secret | Valore |
|--------|--------|
| `VPS_HOST` | IP del VPS |
| `VPS_USER` | Utente SSH |
| `SSH_PRIVATE_KEY` | Chiave privata SSH |

---

## 7. Operazioni

### Backup

```bash
# Manuale
bash /srv/duedgusto/deploy/scripts/backup.sh

# Automatico: ogni giorno alle 03:00 (crontab)
# Salvati in /opt/duedgusto/backups/ con rotazione a 30 giorni
```

### Restore

```bash
docker compose stop backend
gunzip -c /opt/duedgusto/backups/duedgusto_YYYYMMDD_HHMMSS.sql.gz | \
    docker exec -i duedgusto-mysql mysql -u root -p"$MYSQL_ROOT_PASSWORD" duedgusto
docker compose start backend
```

### Log

```bash
docker logs duedgusto-backend --tail 100 -f    # Backend
docker logs duedgusto-mysql --tail 100 -f      # MySQL
tail -f /var/log/nginx/duedgusto-error.log     # Nginx
tail -f /opt/duedgusto/logs/deploy.log         # Deploy
tail -f /opt/duedgusto/logs/backup.log         # Backup
```

### Restart

```bash
cd /srv/duedgusto
docker compose restart           # Tutti i container
docker compose restart backend   # Solo backend
sudo systemctl restart nginx     # Nginx
```

### Rollback

```bash
cd /srv/duedgusto
git log --oneline -10
git checkout <COMMIT_HASH>

# Ricostruire
docker compose build backend
docker compose up -d
cd duedgusto && npm ci && npm run build
rm -rf /opt/duedgusto/frontend/dist/*
cp -r dist/* /opt/duedgusto/frontend/dist/
sudo systemctl reload nginx
```

---

## 8. Struttura VPS

```
/srv/duedgusto/                  # Repository git (codice sorgente)
├── backend/                     # Backend .NET + Dockerfile
├── duedgusto/                   # Frontend React
├── deploy/
│   ├── nginx/duedgusto.conf     # Configurazione Nginx
│   └── scripts/
│       ├── setup-vps.sh         # Setup iniziale
│       ├── deploy.sh            # Script di deploy
│       └── backup.sh            # Backup database
├── docker-compose.yml           # Orchestrazione container
└── .env                         # Variabili d'ambiente (NON versionato)

/opt/duedgusto/                  # Solo file runtime (NO codice sorgente)
├── frontend/
│   └── dist/                    # Build frontend servita da Nginx
├── backups/
│   └── duedgusto_*.sql.gz       # Backup database compressi
└── logs/
    ├── deploy.log
    └── backup.log

/etc/ssl/duedgusto/              # Certificati SSL
├── fullchain.pem
└── privkey.pem
```

---

## 9. Variabili d'Ambiente

Definite in `/srv/duedgusto/.env`:

| Variabile | Obbligatoria | Descrizione |
|-----------|:------------:|-------------|
| `MYSQL_ROOT_PASSWORD` | Si | Password root MySQL |
| `MYSQL_DATABASE` | No | Nome database (default: `duedgusto`) |
| `JWT_SECRET_KEY` | Si | Chiave firma JWT (min 64 char, generare con `openssl rand -base64 64`) |
| `SUPERADMIN_PASSWORD` | Si | Password superadmin al primo avvio |

---

## 10. Troubleshooting

### 502 Bad Gateway

```bash
docker compose ps
docker logs duedgusto-backend --tail 50
curl -sf http://127.0.0.1:5000/health
docker compose restart backend
```

### Certificato SSL scaduto o IP cambiato

```bash
openssl x509 -in /etc/ssl/duedgusto/fullchain.pem -noout -dates
# Rigenerare: vedi sezione 4.2
```

### Container non parte

```bash
docker logs duedgusto-mysql --tail 100
docker logs duedgusto-backend --tail 100
df -h
cat /srv/duedgusto/.env
docker compose down && docker compose up -d --build
```

### Health check fallisce

```bash
docker logs duedgusto-backend --tail 100
docker inspect duedgusto-mysql --format='{{.State.Health.Status}}'
docker compose down && docker compose up -d
```

### Frontend non si aggiorna

```bash
ls -la /opt/duedgusto/frontend/dist/
cat /opt/duedgusto/frontend/dist/config.json
sudo systemctl reload nginx
# Hard refresh nel browser: Ctrl+Shift+R
```

### Permessi negati sugli script

```bash
chmod +x /srv/duedgusto/deploy/scripts/*.sh
```
