# Setup CI/CD -- DuedGusto su VPS Ubuntu

Guida passo-passo per configurare il VPS e il deploy automatico via GitHub Actions.

---

## Panoramica

Ad ogni push su `main`, GitHub Actions:
1. Verifica che backend (.NET) e frontend (React) compilino
2. Si connette al VPS via SSH
3. Esegue `deploy/scripts/deploy.sh` che aggiorna tutto automaticamente

```
Push su main → GitHub Actions build → SSH nel VPS → deploy.sh
```

---

## Fase 1 -- Preparazione del VPS

### 1.1 Accesso SSH

```bash
ssh root@<IP_VPS>
```

### 1.2 Installazione Node.js 20 LTS

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt-get install -y nodejs
node --version   # v20.x.x
npm --version
```

### 1.3 Installazione .NET 8.0 SDK

Necessario per la build del backend sul VPS.

```bash
# Aggiungere il repository Microsoft
apt-get install -y wget
wget https://packages.microsoft.com/config/ubuntu/$(lsb_release -rs)/packages-microsoft-prod.deb -O packages-microsoft-prod.deb
dpkg -i packages-microsoft-prod.deb
rm packages-microsoft-prod.deb

apt-get update
apt-get install -y dotnet-sdk-8.0

dotnet --version   # 8.0.x
```

### 1.4 Clonare il repository

```bash
git clone <URL_REPO> /opt/duedgusto
cd /opt/duedgusto
```

### 1.5 Eseguire lo script di setup

```bash
sudo bash deploy/scripts/setup-vps.sh
```

Questo script installa e configura automaticamente:
- Docker Engine + Docker Compose
- Nginx (con configurazione reverse proxy)
- Certificato SSL self-signed (validita 10 anni)
- Firewall UFW (porte 22, 80, 443)
- Backup giornaliero automatico alle 03:00

---

## Fase 2 -- Configurazione Ambiente

### 2.1 Creare il file .env

```bash
nano /opt/duedgusto/.env
```

Contenuto:

```env
MYSQL_ROOT_PASSWORD=<password_sicura_mysql>
MYSQL_DATABASE=duedgusto
JWT_SECRET_KEY=<chiave_jwt_64_caratteri>
SUPERADMIN_PASSWORD=<password_superadmin>
```

### 2.2 Generare la chiave JWT

```bash
openssl rand -base64 64
```

Copiare l'output nel campo `JWT_SECRET_KEY`.

### 2.3 Proteggere il file .env

```bash
chmod 600 /opt/duedgusto/.env
```

### 2.4 Configurare il frontend con l'IP del VPS

Modificare `duedgusto/config.production.json` sostituendo `<IP_VPS>` con l'IP reale del server:

```bash
nano /opt/duedgusto/duedgusto/config.production.json
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

## Fase 3 -- Primo deploy manuale

Prima di attivare la CI/CD, verificare che il deploy funzioni manualmente.

```bash
cd /opt/duedgusto
bash deploy/scripts/deploy.sh
```

Lo script esegue in ordine:
1. Backup del database (se esiste)
2. `git pull origin main`
3. Build frontend (`npm ci && npm run build`)
4. Copia della build in `/opt/duedgusto/frontend/dist/`
5. Build immagine Docker del backend
6. Avvio/riavvio container (MySQL + backend)
7. Health check su `http://127.0.0.1:5000/health`
8. Reload Nginx

### Verifiche post-deploy

```bash
# Container attivi
docker compose ps

# Backend risponde
curl -sf http://127.0.0.1:5000/health

# Frontend raggiungibile via HTTPS (-k per self-signed)
curl -sfk https://<IP_VPS>

# Log del deploy
tail -20 /opt/duedgusto/logs/deploy.log
```

---

## Fase 4 -- Configurazione chiave SSH per GitHub Actions

### 4.1 Generare una coppia di chiavi dedicata

Sul VPS:

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_deploy -N ""
```

### 4.2 Autorizzare la chiave pubblica

```bash
cat ~/.ssh/github_deploy.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

### 4.3 Copiare la chiave privata

Stampare la chiave privata (servira nel passo successivo):

```bash
cat ~/.ssh/github_deploy
```

Copiare **tutto** l'output, incluse le righe `-----BEGIN` e `-----END`.

---

## Fase 5 -- Configurazione GitHub Actions Secrets

### 5.1 Accedere alle impostazioni del repository

1. Aprire il repository su GitHub
2. Andare su **Settings** > **Secrets and variables** > **Actions**
3. Cliccare **New repository secret** per ogni secret

### 5.2 Aggiungere i 3 secrets

| Secret | Valore | Esempio |
|--------|--------|---------|
| `VPS_HOST` | IP pubblico del VPS | `203.0.113.10` |
| `VPS_USER` | Utente SSH con cui eseguire il deploy | `root` |
| `SSH_PRIVATE_KEY` | Contenuto intero di `~/.ssh/github_deploy` | `-----BEGIN OPENSSH PRIVATE KEY-----...` |

---

## Fase 6 -- Test della CI/CD

### 6.1 Trigger del workflow

Fare un commit e push su `main`:

```bash
git add .
git commit -m "test: verifica CI/CD"
git push origin main
```

### 6.2 Monitorare l'esecuzione

1. Aprire la tab **Actions** nel repository GitHub
2. Verificare che il job **build** passi (compila backend e frontend)
3. Verificare che il job **deploy** passi (connessione SSH + deploy.sh)

### 6.3 Monitorare sul VPS

```bash
tail -f /opt/duedgusto/logs/deploy.log
```

### 6.4 Verificare il risultato

```bash
docker compose ps
curl -sfk https://<IP_VPS>
```

---

## Troubleshooting

### Il job deploy fallisce con "SSH connection refused"

```bash
# Sul VPS: verificare che SSH sia attivo
systemctl status sshd

# Verificare che la porta 22 sia aperta
ufw status

# Verificare che la chiave pubblica sia nelle authorized_keys
cat ~/.ssh/authorized_keys
```

### Il job deploy fallisce con "Permission denied"

- Verificare che il secret `SSH_PRIVATE_KEY` sia stato copiato per intero (incluse le righe BEGIN/END)
- Verificare che `VPS_USER` sia corretto
- Testare la connessione manualmente da un altro terminale:

```bash
ssh -i <chiave_privata> <VPS_USER>@<VPS_HOST>
```

### Il deploy.sh fallisce con "health check fallito"

```bash
# Controllare i log del backend
docker logs duedgusto-backend --tail 50

# Verificare che MySQL sia partito
docker inspect duedgusto-mysql --format='{{.State.Health.Status}}'

# Verificare il file .env
cat /opt/duedgusto/.env
```

### Il frontend mostra errori di connessione

- Verificare che `config.production.json` contenga l'IP corretto del VPS
- Verificare che il file sia stato copiato come `config.json`:

```bash
cat /opt/duedgusto/frontend/dist/config.json
```

### Il browser mostra "La connessione non e sicura"

Questo e normale con certificati self-signed. Cliccare su **Avanzate** > **Procedi** per accettare il certificato.

---

## Riepilogo comandi utili

| Operazione | Comando |
|------------|---------|
| Deploy manuale | `cd /opt/duedgusto && bash deploy/scripts/deploy.sh` |
| Stato container | `docker compose ps` |
| Log backend | `docker logs duedgusto-backend --tail 100 -f` |
| Log MySQL | `docker logs duedgusto-mysql --tail 100 -f` |
| Log Nginx | `tail -f /var/log/nginx/duedgusto-error.log` |
| Log deploy | `tail -f /opt/duedgusto/logs/deploy.log` |
| Backup manuale | `bash /opt/duedgusto/deploy/scripts/backup.sh` |
| Restart tutto | `cd /opt/duedgusto && docker compose restart` |
| Restart solo backend | `docker compose restart backend` |
| Reload Nginx | `sudo systemctl reload nginx` |
| Rigenerare cert SSL | Vedi sezione 4.2 di DEPLOY.md |
