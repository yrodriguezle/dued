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

Non serve installare MySQL: gira in un container Docker.

---

## 2. Primo Deploy (automatico)

Il modo piu' semplice per il primo deploy. Un unico script che fa tutto.

### 2.1 Accesso SSH

```bash
ssh root@<IP_VPS>
```

### 2.2 Clonare il repository

```bash
git clone <URL_REPO> /srv/duedgusto
```

### 2.3 Eseguire il first-deploy

```bash
cd /srv/duedgusto
sudo bash deploy/scripts/first-deploy.sh
```

Lo script fa **tutto automaticamente**:
- Installa Git, Docker, Nginx, Node.js 20, OpenSSL
- Configura firewall UFW (porte 22, 80, 443)
- Genera automaticamente tutti i secret:
  - Password MySQL root (32 char random)
  - Chiave JWT (64+ char base64)
  - Password superadmin (32 char random)
- Crea il file `.env` con i secret generati
- Rileva l'IP del server e configura `config.production.json`
- Genera certificato SSL self-signed (10 anni)
- Crea `/opt/duedgusto/` con sottodirectory
- Configura Nginx come reverse proxy
- Build del frontend
- Avvia i container Docker (MySQL + Backend)
- Esegue il seeding dei dati iniziali (menu, prodotti, denominazioni)
- Verifica health check
- Imposta backup automatico giornaliero alle 03:00

Al termine, lo script stampa le credenziali generate. **Salvale in un posto sicuro!**

### 2.4 Verifiche

```bash
docker compose ps
curl -sf http://127.0.0.1:5000/health
curl -sfk https://<IP_VPS>
```

### 2.5 Accesso all'applicazione

Apri `https://<IP_VPS>` nel browser. Il certificato e' self-signed: clicca **Avanzate > Procedi**.

Login con: `superadmin` / `<password stampata dallo script>`

---

## 3. Setup Manuale (alternativa)

Se preferisci controllare ogni passaggio, puoi fare il setup manualmente.

### 3.1 Script di setup VPS

```bash
cd /srv/duedgusto
sudo bash deploy/scripts/setup-vps.sh
```

Installa Docker, Nginx, Node.js 20, Git. Configura firewall, SSL, Nginx, crontab.

### 3.2 Creare il file .env

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

Per generare i secret:

```bash
# Password MySQL e superadmin (32 char)
openssl rand -base64 32 | tr -d '/+=' | head -c 32

# Chiave JWT (64+ char)
openssl rand -base64 64
```

### 3.3 Configurare il frontend

```bash
nano /srv/duedgusto/duedgusto/config.production.json
```

```json
{
  "API_ENDPOINT": "https://<IP_VPS>",
  "GRAPHQL_ENDPOINT": "https://<IP_VPS>/graphql",
  "GRAPHQL_WEBSOCKET": "wss://<IP_VPS>/graphql",
  "COPYRIGHT": "Copyright (c) 2025 Powered by iansoft"
}
```

### 3.4 Primo deploy manuale

```bash
cd /srv/duedgusto
bash deploy/scripts/deploy.sh
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

## 5. Deploy Successivi

```bash
cd /srv/duedgusto
bash deploy/scripts/deploy.sh
```

### ⚠️ Modifiche breaking dello schema GraphQL: backend e frontend nello stesso deploy

`deploy.sh` costruisce e mette in linea **backend e frontend insieme**, dallo stesso commit. Va
tenuto cosi' e **non va spezzato in due deploy separati** quando il rilascio contiene una modifica
alla *forma* di un input GraphQL: fra i due, il frontend vecchio invierebbe campi che l'input nuovo
non possiede e il salvataggio verrebbe **rifiutato dalla validazione del documento** — rumoroso,
non silenzioso, ma comunque un'interruzione per chi sta usando quella pagina.

**Rilasci con questo vincolo, ad oggi:**

| Rilascio | Cosa cambia | Rollback |
|----------|-------------|----------|
| Pannello «Sito» per pagine | `mutateImpostazioniVetrina` passa da **30 a 20 campi**: i testi editoriali e la reputazione escono e vanno su `mutatePaginaHome`, `mutatePaginaLocale`, `mutatePaginaAperitivo` | 🔴 **Prima** si riespande l'input a 30 campi, **poi** si fa il revert del frontend |

🔴 **L'ordine del rollback non e' simmetrico a quello del deploy.** I nomi dei campi non cambiano,
quindi il ripristino sembra "additivo all'incontrario" — ma a cambiare e' la **forma** dell'input,
non i nomi: revertendo prima il frontend si lascerebbe in linea una pagina che chiama tre mutation
che non esistono piu'. Vedi la sezione [Rollback](#rollback).

Il deploy esegue:
1. Backup pre-deploy del database (se MySQL e' in esecuzione)
2. `git pull origin main` (se upstream configurato)
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

⚠️ **Se il commit da cui si torna indietro conteneva una modifica breaking dello schema GraphQL**
(vedi la tabella nella [sezione 5](#5-deploy-successivi)), l'ordine conta: il **backend** va
riportato indietro **prima** del frontend, mai dopo. Il `git checkout` sopra li riporta indietro
entrambi insieme, quindi va bene — quello che **non** va fatto e' revertire il solo frontend
"intanto", lasciando in linea il backend nuovo.

⚠️ **Le migrazioni del database non tornano indietro** con il `git checkout`: `MigrateAsync` applica
solo quelle in avanti. Le migrazioni additive (colonne nullable nuove) sono innocue da lasciare — il
codice precedente le ignora. Se invece una colonna nuova e' gia' stata **valorizzata** da qualcuno,
tornare indietro perde quel dato in silenzio: prima del rollback va deciso cosa farne.

#### 🔴 L'unico punto di non ritorno oggi in produzione: i tre slot immagine del sito

Il rilascio «Pannello Sito per pagine» aggiunge tre colonne nullable su `ImpostazioniVetrina` —
`ImmagineEroeHomeId`, `ImmagineRitrattoLocaleId`, `ImmagineEroeAperitivoId` — che sono la **scelta
editoriale** di quale foto sta in cima a `/`, a `/locale` e ad `/aperitivo`. Nascono `NULL`: finche'
lo restano, il rollback e' innocuo e il sito torna a pescare dalla posizione nella galleria.

**Dal momento in cui qualcuno ne valorizza anche una sola, il rollback perde quella scelta**, e la
perde in silenzio: il sito riparte, nessun errore da nessuna parte, e le foto in cima a tre pagine
sono altre. Prima di tornare indietro:

```sql
SELECT ImmagineEroeHomeId, ImmagineRitrattoLocaleId, ImmagineEroeAperitivoId
FROM ImpostazioniVetrina WHERE ImpostazioniVetrinaId = 1;
```

- **Tutte e tre `NULL`** → si procede, non c'e' nulla da salvare.
- **Anche una sola valorizzata** → le immagini scelte vanno **riordinate nella libreria media**
  perche' la posizione riproduca la scelta, **prima** del revert: 1ª = eroe della home, 2ª = ritratto
  del locale. ⚠️ L'eroe di `/aperitivo` **non ha una posizione che lo riproduca** — dopo il rollback
  quella pagina torna a mostrare l'**ultima** foto della galleria, qualunque essa sia.

⚠️ Vale anche al **contrario**, e conviene saperlo prima: prima di questo rilascio `/aperitivo`
mostrava l'ultima foto della galleria; dopo, finche' nessuno sceglie, quella pagina esce **senza
immagine di testata**. E' una differenza voluta e visibile dal primo deploy, non un guasto.

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
| `SEED_LISTINO_2026` | No | Listino di cassa. Default `1` dal compose: **non serve scriverla**. Vale `dryrun` per una prova a vuoto |
| `SEED_VETRINA_LISTINO` | No | Pubblicazione del listino sul sito. Default `1`, stessa logica |

> 🔴 **Il compose passa al container una lista FISSA di variabili.** Una variabile scritta
> nel `.env` del server ma **assente da `docker-compose.yml` non arriva al backend**, e non
> lo segnala nessuno: il codice che la legge trova `null` e si comporta come se fosse spenta.
> È il motivo per cui i due seeder del listino sono rimasti inerti in produzione fino al
> 13 agosto 2026, con il catalogo di cassa vuoto e nessun errore da nessuna parte.
> Ogni variabile nuova va aggiunta **in entrambi i posti**.

### Il listino di cassa

I due seeder sono **armati in permanenza** nel compose, e va bene così: sono idempotenti.
`SeedProdottiListino` crea solo i codici ancora assenti in anagrafica; `SeedVetrinaListino`
tocca solo i prodotti *mai curati* (categoria di vetrina nulla **e** non pubblicati), quindi
spubblicare un piatto dal pannello resta una decisione definitiva e non viene annullata al
riavvio successivo. Dopo la prima esecuzione entrambi sono un'operazione nulla.

Per vedere cosa farebbero senza scrivere niente, nel `.env` del server:

```bash
SEED_LISTINO_2026=dryrun
SEED_VETRINA_LISTINO=dryrun
docker compose up -d backend && docker compose logs -f backend | grep -i listino
```

⚠️ **I loro messaggi sono a livello `Information`**, mentre in Production il livello di
default è `Warning`: senza le due categorie dichiarate in `backend/appsettings.Production.json`
girerebbero **muti**, e non avresti modo di sapere se hanno funzionato. Le due chiavi portano
il **nome qualificato** (`duedgusto.SeedData.SeedProdottiListino`) e non quello nudo come le
voci più vecchie lì accanto: quei seeder creano il logger con `nameof(...)`, questi con
`typeof(...)`, e le categorie si filtrano per prefisso del nome completo. Una chiave col nome
nudo verrebbe accettata dal file e non filtrerebbe nulla.

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
