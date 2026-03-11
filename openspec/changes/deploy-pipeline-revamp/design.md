# Design: Deploy Pipeline Revamp

## Technical Approach

Spostare il versioning dal VPS al CI runner unificando le due GitHub Actions (`versioning-action` e `dotnet-versioning-action`) in una sola action Node 22. Il workflow `deploy.yml` viene riscritto per eseguire checkout, versioning, commit+push nel runner, e poi SSH solo per il deploy. Lo script `deploy.sh` perde tutto il blocco versioning (righe 36-56) e legge la versione in sola lettura dal `package.json` dopo il `git pull`.

Riferimento: proposal.md sezione "Approach", specs/ci-cd/spec.md tutti i 9 requirement.

## Architecture Decisions

### Decision: Unificare le action in una sola invece di creare una terza action

**Choice**: Riscrivere `versioning-action` per gestire sia `package.json` (root + duedgusto/) che `backend/duedgusto.csproj`, eliminando `dotnet-versioning-action`.
**Alternatives considered**: (a) Creare una terza action wrapper che chiama le due esistenti; (b) Inline scripting nel workflow YAML senza action custom.
**Rationale**: Una sola action riduce la duplicazione e la superficie di manutenzione. L'inline scripting è fragile e non riutilizzabile. Il wrapper aggiungerebbe complessità senza valore.

### Decision: Usare `npm version` per i package.json e regex replace per il csproj

**Choice**: `npm version <type> --no-git-tag-version` per root e duedgusto `package.json`, poi leggere la versione risultante e applicarla al `.csproj` via `fs.promises.readFile` + `String.replace` + `fs.promises.writeFile`.
**Alternatives considered**: (a) Calcolo manuale della versione (come fa `deploy.sh` attualmente); (b) Usare `semver` npm package per il bump.
**Rationale**: `npm version` è lo standard npm, gestisce correttamente edge case semver. Per il `.csproj` non c'è tooling equivalente, ma un semplice regex replace su `<Version>X.Y.Z</Version>` è sufficiente e già usato nel progetto. L'action attuale di dotnet-versioning appende `.0` alla versione (bug: produce `X.Y.0` come 4-part version) — il nuovo codice non deve farlo.

### Decision: Calcolo versione nella action, non nel workflow

**Choice**: La action riceve `bump-type` come input, esegue internamente `npm version`, e restituisce la nuova versione come output.
**Alternatives considered**: Calcolare la versione nel workflow YAML con step bash, poi passarla alla action.
**Rationale**: Incapsulare la logica nella action la rende testabile indipendentemente e riutilizzabile. Il workflow resta declarativo.

### Decision: Protezione anti-loop con doppio meccanismo

**Choice**: `paths-ignore` nel trigger push (per `package.json`, `duedgusto/package.json`, `backend/duedgusto.csproj`) + `[skip ci]` nel commit message + condizione `if` sul job.
**Alternatives considered**: (a) Solo `[skip ci]`; (b) Solo `paths-ignore`; (c) Usare un branch separato per i commit di versione.
**Rationale**: `paths-ignore` da solo non basta se il commit di versione viene accorpato con altri file. `[skip ci]` da solo non è garantito per tutti i trigger. Il doppio meccanismo (già presente nel workflow attuale) è la best practice GitHub. La condizione `if` aggiunge un terzo livello di sicurezza a costo zero.

### Decision: `@vercel/ncc` per il bundle dell'action

**Choice**: Continuare a usare `@vercel/ncc` per produrre `dist/index.js`, come fa l'action attuale.
**Alternatives considered**: (a) esbuild; (b) non bundlare e installare node_modules nel CI.
**Rationale**: `ncc` è lo standard de facto per GitHub Actions JavaScript. Il progetto lo usa già. Non c'è motivo di cambiare.

### Decision: Eliminare il workaround `setOutput` manuale

**Choice**: Usare `core.setOutput()` nativo da `@actions/core`.
**Alternatives considered**: Mantenere l'hack `fs.appendFileSync(GITHUB_OUTPUT, ...)`.
**Rationale**: L'hack era necessario con versioni vecchie di `@actions/core`. Le versioni attuali (>= 1.10) supportano `GITHUB_OUTPUT` nativamente. L'hack attuale ha anche un bug: manca il newline finale, quindi concatenazioni successive di output corrompono i valori.

## Data Flow

```
                        GitHub Actions Runner (CI)
                        ===========================

  push main ──→ deploy.yml trigger
                    │
                    ▼
              ┌─────────────┐
              │  checkout    │  persist-credentials: true
              │  setup-node  │  Node 22
              └──────┬──────┘
                     │
                     ▼
              ┌──────────────────────┐
              │  versioning-action   │
              │  ┌────────────────┐  │
              │  │ npm version    │──┼──→ package.json (root)
              │  │ (bump-type)    │──┼──→ duedgusto/package.json
              │  │                │  │
              │  │ read new ver   │  │
              │  │ regex replace  │──┼──→ backend/duedgusto.csproj
              │  └───────┬────────┘  │
              │          │           │
              │    output: version   │
              └──────────┬───────────┘
                         │
                         ▼
              ┌───────────────────────────────────┐
              │  git add + commit + push           │
              │  message: "chore: vX.Y.Z [skip ci]"│
              │  author: GitHub Action             │
              └──────────┬────────────────────────┘
                         │
                         ▼
              ┌──────────────────┐
              │  SSH to VPS      │  appleboy/ssh-action
              └──────────┬───────┘
                         │
                         ▼
                    VPS (produzione)
                    ================
              ┌──────────────────────────────┐
              │  deploy.sh (senza versioning) │
              │  1. backup                    │
              │  2. git pull ← prende commit  │
              │  3. legge versione (readonly) │
              │  4. npm ci + build frontend   │
              │  5. copy dist                 │
              │  6. genera config.json        │
              │  7. docker build + tag        │
              │  8. docker compose up         │
              │  9. health check              │
              │  10. nginx reload             │
              └──────────────────────────────┘
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `.github/actions/versioning-action/action.yml` | Modify | Rinominare (name/description), cambiare `using` da `node20` a `node22`, rinominare input da `versionType` a `bump-type` |
| `.github/actions/versioning-action/src/index.js` | Rewrite | Rimuovere path `ClientApp`, aggiungere bump di `package.json` root + `duedgusto/package.json` + `.csproj`. Usare `core.setOutput()` nativo, `fs.promises`, async/await. Rimuovere `getWantedVersionType` (logica 999 non necessaria). Aggiungere validazione input con `core.setFailed()`. |
| `.github/actions/versioning-action/src/utils.js` | Modify | Nessuna modifica strutturale necessaria — `commandExec` è già funzionale. Opzionale: pulizia minor (rimuovere `new Promise` wrapper ridondante). |
| `.github/actions/versioning-action/package.json` | Modify | Aggiornare versione, rimuovere `husky` (non serve nel CI), verificare compatibilità dipendenze con Node 22 |
| `.github/actions/versioning-action/dist/index.js` | Regenerate | Rebuild con `npm run package` (ncc build) dopo le modifiche a src/ |
| `.github/actions/dotnet-versioning-action/` | Delete | Intera directory — funzionalità assorbita nell'action unificata |
| `.github/actions/deploy.yml` | Delete | Workflow AMICO4forWEB legacy, non usato da DuedGusto |
| `.github/workflows/deploy.yml` | Rewrite | Aggiungere step: checkout, setup-node, versioning-action, git config, git commit+push, SSH deploy. Aggiungere `permissions: contents: write`. Mantenere `concurrency`, `timeout-minutes`, `paths-ignore`. Aggiungere condizione `if` anti-loop. |
| `deploy/scripts/deploy.sh` | Modify | Rimuovere righe 8 (`BUMP_TYPE`), 36-56 (intero blocco versioning+push). Aggiungere lettura versione readonly: `VERSION=$(node -p "require('./package.json').version")`. Sostituire `$NEW_VERSION` con `$VERSION` in config.json e docker tag. |

## Interfaces / Contracts

### Action unificata — `action.yml`

```yaml
name: Versioning DuedGusto
description: Bump version in package.json (root + duedgusto/) and backend csproj
inputs:
  bump-type:
    description: 'Version bump type: patch, minor, or major'
    required: true
    default: 'patch'
outputs:
  version:
    description: 'New version number (MAJOR.MINOR.PATCH)'
runs:
  using: 'node22'
  main: 'dist/index.js'
```

### Action `src/index.js` — struttura

```javascript
import * as core from '@actions/core';
import fs from 'fs/promises';
import { commandExec } from './utils.js';

const BUMP_TYPES = ['patch', 'minor', 'major'];

const FILES = {
  rootPackage: './package.json',
  frontendPackage: './duedgusto/package.json',
  backendCsproj: './backend/duedgusto.csproj',
};

async function updateCsproj(filePath, version) {
  const content = await fs.readFile(filePath, 'utf8');
  const updated = content.replace(/<Version>.*<\/Version>/, `<Version>${version}</Version>`);
  await fs.writeFile(filePath, updated, 'utf8');
  core.info(`Updated ${filePath} to ${version}`);
}

async function run() {
  try {
    const bumpType = core.getInput('bump-type', { required: true });

    if (!BUMP_TYPES.includes(bumpType)) {
      core.setFailed(`Invalid bump-type "${bumpType}". Must be one of: ${BUMP_TYPES.join(', ')}`);
      return;
    }

    // Bump root package.json
    await commandExec(`npm version ${bumpType} --no-git-tag-version`);

    // Bump duedgusto/package.json
    await commandExec(`npm version ${bumpType} --no-git-tag-version --prefix ./duedgusto`);

    // Read new version from root package.json
    const pkg = JSON.parse(await fs.readFile(FILES.rootPackage, 'utf8'));
    const newVersion = pkg.version;
    core.info(`New version: ${newVersion}`);

    // Update csproj
    await updateCsproj(FILES.backendCsproj, newVersion);

    core.setOutput('version', newVersion);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
```

### Workflow `deploy.yml` — struttura

```yaml
name: Deploy DuedGusto

on:
  workflow_dispatch:
    inputs:
      bump_type:
        description: 'Version bump type'
        required: true
        default: 'patch'
        type: choice
        options:
          - patch
          - minor
          - major
  push:
    branches: [main]
    paths-ignore:
      - 'package.json'
      - 'duedgusto/package.json'
      - 'backend/duedgusto.csproj'

permissions:
  contents: write

concurrency:
  group: deploy
  cancel-in-progress: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    if: "!contains(github.event.head_commit.message, '[skip ci]')"
    timeout-minutes: 15
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          persist-credentials: true

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'

      - name: Bump version
        id: version
        uses: ./.github/actions/versioning-action
        with:
          bump-type: ${{ github.event.inputs.bump_type || 'patch' }}

      - name: Commit and push version
        run: |
          git config user.email "actions@github.com"
          git config user.name "GitHub Action"
          git add package.json duedgusto/package.json backend/duedgusto.csproj
          git commit -m "chore: v${{ steps.version.outputs.version }} [skip ci]"
          git push

      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /srv/duedgusto
            git stash --include-untracked -q 2>/dev/null || true
            git pull origin main
            bash deploy/scripts/deploy.sh
```

### `deploy.sh` — blocco versioning rimosso, lettura readonly

```bash
# RIMOSSO: BUMP_TYPE="${1:-patch}"  (riga 8)
# RIMOSSO: righe 36-56 (intero blocco versioning + git commit/push)

# AGGIUNTO dopo git pull (circa riga 35):
VERSION=$(node -p "require('$REPO_DIR/package.json').version")
log "Versione corrente: $VERSION"

# MODIFICATO: tutti i riferimenti a $NEW_VERSION diventano $VERSION
# - config.json: "APP_VERSION": "$VERSION"
# - docker tag: duedgusto-backend:$VERSION
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Manuale | Action unificata bumpa correttamente i 3 file | Eseguire `npm run package`, poi test locale con `act` o push su branch di test |
| Manuale | Workflow completo: push → versioning → commit → deploy | Push un commit su `main` e verificare che il workflow completi tutti gli step |
| Manuale | Anti-loop: commit di versione non ri-triggera | Verificare nella tab Actions che dopo il commit `[skip ci]` non parta un nuovo run |
| Manuale | `deploy.sh` standalone senza argomenti | SSH sul VPS, eseguire `bash deploy/scripts/deploy.sh` e verificare che completi senza errore |
| Manuale | Versione coerente dopo deploy | Confrontare versione in `package.json`, `duedgusto/package.json`, `backend/duedgusto.csproj`, `config.json` sul server, e tag Docker |
| Manuale | `workflow_dispatch` con bump minor/major | Triggerare manualmente dal tab Actions con tipo diverso da patch |

Nota: il progetto non ha test unitari (vedi config.yaml: "Testing: None"). Nessun test automatico viene aggiunto in questo change (out of scope da proposal).

## Migration / Rollout

Nessuna migrazione dati necessaria. Rollout in un singolo commit:

1. **Merge del PR** — il commit stesso triggera il workflow riscritto
2. **Primo run** — il workflow esegue il versioning nel CI per la prima volta
3. **Verifica** — controllare nella tab Actions che il run completi senza loop
4. **Rollback** — se qualcosa va storto, revert del commit ripristina il workflow precedente (tutto è nel git history)

Non servono feature flag, deploy progressivo, o periodi di transizione. Il vecchio `deploy.sh` con versioning e il nuovo senza versioning sono mutuamente esclusivi: il workflow decide quale logica eseguire.

## Open Questions

- [x] Il `GITHUB_TOKEN` default ha permesso `contents: write`? — Sì, con `permissions: contents: write` esplicito nel workflow e `persist-credentials: true` nel checkout.
- [ ] L'action `appleboy/ssh-action@v1` è compatibile con il timeout di 15 minuti del job? — Verificare che il deploy SSH completi entro il timeout (il build frontend con `npm ci` + `npm run build` potrebbe essere lento la prima volta).
- [ ] Il `git stash` nel step SSH è ancora necessario? — Sì, per sicurezza: file locali residui sul VPS (es. `config.json` rigenerato, log) potrebbero bloccare il `git pull`.
