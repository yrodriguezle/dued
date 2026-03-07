# Setup CI/CD -- DuedGusto su VPS Ubuntu

Guida passo-passo per configurare il VPS e il deploy automatico via GitHub Actions.

---

## Panoramica

```
Push su main → GitHub Actions build → SSH nel VPS → deploy.sh
```

Il workflow verifica la compilazione, poi si connette al VPS ed esegue il deploy automaticamente.

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
node --version
```

### 1.3 Clonare il repository

```bash
git clone <URL_REPO> /srv/duedgusto
```

### 1.4 Eseguire lo script di setup

```bash
cd /srv/duedgusto
sudo bash deploy/scripts/setup-vps.sh
```

Installa Docker, Nginx, genera certificato SSL self-signed, crea `/opt/duedgusto/` (runtime).

---

## Fase 2 -- Configurazione Ambiente

### 2.1 Creare il file .env

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

### 2.2 Generare la chiave JWT

```bash
openssl rand -base64 64
```

### 2.3 Configurare il frontend con l'IP del VPS

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

## Fase 3 -- Primo deploy manuale

```bash
cd /srv/duedgusto
bash deploy/scripts/deploy.sh
```

### Verifiche

```bash
docker compose ps
curl -sf http://127.0.0.1:5000/health
curl -sfk https://<IP_VPS>
tail -20 /opt/duedgusto/logs/deploy.log
```

---

## Fase 4 -- Chiave SSH per GitHub Actions

### 4.1 Generare la coppia di chiavi

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_deploy -N ""
```

### 4.2 Autorizzare la chiave pubblica

```bash
cat ~/.ssh/github_deploy.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

### 4.3 Copiare la chiave privata

```bash
cat ~/.ssh/github_deploy
```

Copiare **tutto** l'output (incluse le righe BEGIN/END).

---

## Fase 5 -- GitHub Actions Secrets

Su GitHub: **Settings > Secrets and variables > Actions > New repository secret**

| Secret | Valore | Esempio |
|--------|--------|---------|
| `VPS_HOST` | IP pubblico del VPS | `203.0.113.10` |
| `VPS_USER` | Utente SSH | `root` |
| `SSH_PRIVATE_KEY` | Contenuto di `~/.ssh/github_deploy` | `-----BEGIN OPENSSH PRIVATE KEY-----...` |

---

## Fase 6 -- Test CI/CD

### 6.1 Attivare il workflow

Nel file `.github/workflows/deploy.yml`, decommentare il trigger push:

```yaml
on:
  push:
    branches: [main]
```

### 6.2 Trigger

```bash
git add . && git commit -m "ci: attiva CI/CD" && git push origin main
```

### 6.3 Monitorare

- Tab **Actions** su GitHub per lo stato dei job
- Sul VPS: `tail -f /opt/duedgusto/logs/deploy.log`

### 6.4 Verificare

```bash
docker compose ps
curl -sfk https://<IP_VPS>
```

---

## Troubleshooting

### SSH connection refused

```bash
systemctl status sshd
ufw status
cat ~/.ssh/authorized_keys
```

### Permission denied

- Verificare che `SSH_PRIVATE_KEY` sia copiato per intero
- Test manuale: `ssh -i <chiave_privata> <VPS_USER>@<VPS_HOST>`

### Health check fallito

```bash
docker logs duedgusto-backend --tail 50
docker inspect duedgusto-mysql --format='{{.State.Health.Status}}'
cat /srv/duedgusto/.env
```

### Frontend errori di connessione

```bash
cat /opt/duedgusto/frontend/dist/config.json
```

### Browser "connessione non sicura"

Normale con certificati self-signed. Cliccare **Avanzate > Procedi**.

---

## Comandi utili

| Operazione | Comando |
|------------|---------|
| Deploy manuale | `cd /srv/duedgusto && bash deploy/scripts/deploy.sh` |
| Stato container | `cd /srv/duedgusto && docker compose ps` |
| Log backend | `docker logs duedgusto-backend --tail 100 -f` |
| Log deploy | `tail -f /opt/duedgusto/logs/deploy.log` |
| Backup manuale | `bash /srv/duedgusto/deploy/scripts/backup.sh` |
| Restart tutto | `cd /srv/duedgusto && docker compose restart` |
| Reload Nginx | `sudo systemctl reload nginx` |
