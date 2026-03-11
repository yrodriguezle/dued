# Tasks: Deploy Pipeline Revamp

## Phase 1: Riscrittura Versioning Action Unificata

- [x] 1.1 Aggiornare `.github/actions/versioning-action/action.yml`: rinominare `name` e `description` da "AMICO4forWEB" a "DuedGusto", rinominare input da `versionType` a `bump-type`, cambiare `using` da `node20` a `node22`, aggiungere output `version` con description aggiornata
- [x] 1.2 Riscrivere `.github/actions/versioning-action/src/index.js`: rimuovere `getPackageJson()`, `setOutput()` hack, `getWantedVersionType()` (logica 999). Sostituire con: validazione `bump-type` (patch/minor/major) con `core.setFailed()`, bump root `package.json` via `npm version <type> --no-git-tag-version`, bump `duedgusto/package.json` via `npm version <type> --no-git-tag-version --prefix ./duedgusto`, lettura nuova versione da root `package.json` con `fs.promises.readFile`, aggiornamento `backend/duedgusto.csproj` via regex replace su `<Version>...</Version>` con `fs.promises.readFile` + `fs.promises.writeFile`, output via `core.setOutput('version', newVersion)` nativo. Usare `import fs from 'fs/promises'` al posto di `fs` sync
- [x] 1.3 Pulire `.github/actions/versioning-action/src/utils.js`: rimuovere il wrapper `new Promise()` ridondante attorno a `commandExec` (la funzione interna e gia async), semplificare in async/await diretto. Opzionale, non bloccante
- [x] 1.4 Aggiornare `.github/actions/versioning-action/package.json`: rimuovere `husky` da `devDependencies` e lo script `prepare`, rimuovere la sezione `husky.hooks`. Verificare che `@actions/core` >= 1.10 e `@vercel/ncc` siano compatibili con Node 22
- [x] 1.5 Reinstallare dipendenze e rigenerare bundle: eseguire `cd .github/actions/versioning-action && npm install && npm run package` per produrre `dist/index.js` aggiornato. Verificare che il file `dist/index.js` sia stato generato senza errori

## Phase 2: Riscrittura Workflow deploy.yml

- [x] 2.1 Riscrivere `.github/workflows/deploy.yml`: aggiungere `permissions: contents: write` a livello top. Aggiungere condizione `if: "!contains(github.event.head_commit.message, '[skip ci]')"` al job `deploy`. Mantenere `concurrency`, `timeout-minutes: 15`, `workflow_dispatch`, `paths-ignore` esistenti
- [x] 2.2 Aggiungere step `Checkout` con `actions/checkout@v4` e `persist-credentials: true` come primo step del job
- [x] 2.3 Aggiungere step `Setup Node.js` con `actions/setup-node@v4` e `node-version: '22'`
- [x] 2.4 Aggiungere step `Bump version` con `id: version`, `uses: ./.github/actions/versioning-action`, input `bump-type: ${{ github.event.inputs.bump_type || 'patch' }}`
- [x] 2.5 Aggiungere step `Commit and push version`: configurare git identity (`actions@github.com` / `GitHub Action`), `git add package.json duedgusto/package.json backend/duedgusto.csproj`, commit con message `chore: v${{ steps.version.outputs.version }} [skip ci]`, `git push`
- [x] 2.6 Modificare step `Deploy via SSH` esistente: rimuovere il passaggio di `${{ github.event.inputs.bump_type || 'patch' }}` come argomento a `deploy.sh`. Lo script SSH deve solo: `cd /srv/duedgusto`, `git stash`, `git pull origin main`, `bash deploy/scripts/deploy.sh` (senza argomenti)

## Phase 3: Snellimento deploy.sh

- [x] 3.1 Rimuovere la variabile `BUMP_TYPE="${1:-patch}"` (riga 8 di `deploy/scripts/deploy.sh`)
- [x] 3.2 Rimuovere il blocco versioning completo (righe 36-57): calcolo versione, `npm version`, `sed` su csproj, `git add`, `git commit`, `git push`, log versione. Tutto da riga `# Auto-increment version` fino a `log "Versione aggiornata..."`
- [x] 3.3 Aggiungere lettura versione readonly dopo il blocco git pull (dopo riga 34): `VERSION=$(node -p "require('$REPO_DIR/package.json').version")` e `log "Versione corrente: $VERSION"`
- [x] 3.4 Sostituire tutti i riferimenti a `$NEW_VERSION` con `$VERSION` nel resto dello script: in `config.json` campo `APP_VERSION` (riga 72), nel tag Docker `duedgusto-backend:$NEW_VERSION` (riga 84)

## Phase 4: Rimozione File Legacy AMICO4forWEB

- [x] 4.1 Eliminare l'intera directory `.github/actions/dotnet-versioning-action/` dal repository (include `action.yml`, `src/`, `dist/`, `node_modules/`, `package.json`)
- [x] 4.2 Eliminare il file `.github/actions/deploy.yml` (workflow di riferimento AMICO4forWEB, non usato da DuedGusto)

## Phase 5: Verifica Manuale

- [ ] 5.1 Verifica locale: controllare che `npm run package` in `.github/actions/versioning-action/` produca `dist/index.js` senza errori
- [ ] 5.2 Verifica workflow: pushare un commit su `main` e controllare nella tab Actions di GitHub che il workflow completi tutti gli step (checkout, setup-node, bump version, commit+push, SSH deploy)
- [ ] 5.3 Verifica anti-loop: dopo il run del workflow, controllare che il commit `[skip ci]` di versione NON abbia triggerato un nuovo run nella tab Actions
- [ ] 5.4 Verifica deploy.sh: connettersi via SSH al VPS, eseguire `bash deploy/scripts/deploy.sh` senza argomenti e verificare che completi senza errore
- [ ] 5.5 Verifica coerenza versioni: confrontare la versione in `package.json` root, `duedgusto/package.json`, `backend/duedgusto.csproj`, `config.json` sul server, e tag Docker — devono essere tutte uguali
- [ ] 5.6 Verifica `workflow_dispatch`: triggerare manualmente il workflow dalla tab Actions con `bump_type: minor` e verificare che il bump sia di tipo minor
