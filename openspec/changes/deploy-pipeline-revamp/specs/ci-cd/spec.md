# CI/CD Pipeline Specification

## Purpose

Specifica il comportamento della pipeline di Continuous Integration e Continuous Deployment per il progetto DuedGusto: versioning automatico, protezione anti-loop, e deploy su VPS via SSH.

---

## Requirements

### Requirement: Unified Versioning Action

Il sistema DEVE fornire una singola GitHub Action (`versioning-action`) che gestisce il bump di versione per tutti i file versionati del progetto (root `package.json`, `duedgusto/package.json`, `backend/duedgusto.csproj`).

L'action DEVE girare su Node 22.
L'action DEVE accettare un input `bump-type` con valori `patch`, `minor`, o `major`.
L'action DEVE produrre un output `version` con la nuova versione nel formato `MAJOR.MINOR.PATCH`.
L'action DEVE usare `@actions/core` nativo per `core.setOutput()` — NON DEVE usare hack manuali su `GITHUB_OUTPUT`.
L'action DEVE usare `async/await` e `fs.promises` — NON DEVE usare callback `fs.writeFile`.

#### Scenario: Bump patch della versione

- GIVEN il file `package.json` root contiene `"version": "1.2.3"`
- AND il file `duedgusto/package.json` contiene `"version": "1.2.3"`
- AND il file `backend/duedgusto.csproj` contiene `<Version>1.2.3</Version>`
- WHEN l'action viene eseguita con `bump-type: patch`
- THEN tutti e tre i file DEVONO contenere la versione `1.2.4`
- AND l'output `version` DEVE essere `1.2.4`

#### Scenario: Bump minor della versione

- GIVEN il file `package.json` root contiene `"version": "1.2.3"`
- WHEN l'action viene eseguita con `bump-type: minor`
- THEN tutti e tre i file DEVONO contenere la versione `1.3.0`
- AND l'output `version` DEVE essere `1.3.0`

#### Scenario: Bump major della versione

- GIVEN il file `package.json` root contiene `"version": "1.2.3"`
- WHEN l'action viene eseguita con `bump-type: major`
- THEN tutti e tre i file DEVONO contenere la versione `2.0.0`
- AND l'output `version` DEVE essere `2.0.0`

#### Scenario: File csproj con formato versione preesistente

- GIVEN il file `backend/duedgusto.csproj` contiene `<Version>1.2.3</Version>`
- WHEN l'action aggiorna la versione a `1.2.4`
- THEN il file DEVE contenere `<Version>1.2.4</Version>`
- AND il resto del contenuto del file csproj NON DEVE essere alterato

#### Scenario: Input bump-type non valido

- GIVEN l'action riceve un `bump-type` diverso da `patch`, `minor`, o `major`
- WHEN l'action viene eseguita
- THEN l'action DEVE fallire con un messaggio di errore chiaro tramite `core.setFailed()`

---

### Requirement: Versioning Eseguito nel CI Runner

Il workflow `deploy.yml` DEVE eseguire il bump di versione nel GitHub Actions runner (CI), NON sul VPS.

Il workflow DEVE fare checkout del codice con `persist-credentials: true`.
Il workflow DEVE configurare Node.js 22 tramite `actions/setup-node@v4`.
Il workflow DEVE invocare l'action unificata `versioning-action` per aggiornare i file di versione.
Il workflow DEVE committare e pushare i file di versione aggiornati PRIMA di eseguire il deploy sul VPS.

#### Scenario: Push su main triggera versioning nel CI

- GIVEN un commit viene pushato sul branch `main` che modifica file applicativi (non solo file di versione)
- WHEN il workflow `deploy.yml` si attiva
- THEN il runner DEVE eseguire checkout del repository
- AND il runner DEVE eseguire il bump di versione tramite l'action unificata
- AND il runner DEVE committare i file di versione aggiornati
- AND il runner DEVE pushare il commit sul branch `main`
- AND solo DOPO il push, il runner DEVE avviare il deploy via SSH

#### Scenario: Dispatch manuale con bump type specifico

- GIVEN un utente triggera il workflow manualmente via `workflow_dispatch`
- AND seleziona `bump_type: minor`
- WHEN il workflow si attiva
- THEN il runner DEVE eseguire il bump di tipo `minor`
- AND il flusso DEVE proseguire come per un push normale

---

### Requirement: Commit di Versione con Identita Git Configurata

Il workflow DEVE configurare l'identita git nel CI runner per il commit di versione.

Il workflow DEVE impostare `user.email` a un indirizzo riconoscibile come automazione (es. `actions@github.com`).
Il workflow DEVE impostare `user.name` a un nome riconoscibile come automazione (es. `GitHub Action`).

#### Scenario: Commit di versione creato con successo

- GIVEN il runner ha eseguito il bump di versione
- WHEN il runner crea il commit di versione
- THEN il commit DEVE avere un autore con email e nome configurati
- AND il commit message DEVE contenere la nuova versione
- AND il commit message DEVE contenere il marker `[skip ci]`

#### Scenario: Push con permessi sufficienti

- GIVEN il workflow ha `permissions: contents: write`
- AND il checkout e stato fatto con `persist-credentials: true`
- WHEN il runner esegue `git push`
- THEN il push DEVE completarsi con successo usando il `GITHUB_TOKEN`

---

### Requirement: Protezione Anti-Loop del Deploy

Il sistema DEVE impedire che il commit di versione ri-triggeri il workflow, evitando un loop infinito di deploy.

Il sistema DEVE usare almeno DUE meccanismi di protezione complementari.

#### Scenario: Commit di versione non ri-triggera il workflow

- GIVEN il workflow ha pushato un commit con message contenente `[skip ci]`
- AND il workflow ha `paths-ignore` configurato per `package.json`, `duedgusto/package.json`, e `backend/duedgusto.csproj`
- WHEN GitHub riceve il push del commit di versione
- THEN il workflow NON DEVE essere triggerato nuovamente

#### Scenario: Commit che modifica solo file di versione

- GIVEN un commit modifica esclusivamente `package.json`, `duedgusto/package.json`, e `backend/duedgusto.csproj`
- WHEN GitHub valuta i trigger del workflow
- THEN il workflow NON DEVE attivarsi grazie a `paths-ignore`

#### Scenario: Commit applicativo con file di versione inclusi

- GIVEN un commit modifica sia file applicativi che file di versione
- WHEN GitHub valuta i trigger del workflow
- THEN il workflow DEVE attivarsi (perche ci sono file non ignorati nel commit)

---

### Requirement: Deploy Script Senza Versioning

Lo script `deploy.sh` NON DEVE contenere logica di version bump.

Lo script DEVE mantenere: backup pre-deploy, git pull, build frontend, copia dist, generazione `config.json`, build/restart Docker backend, health check, reload Nginx.
Lo script NON DEVE eseguire `npm version`.
Lo script NON DEVE modificare file `package.json`.
Lo script NON DEVE modificare file `.csproj`.
Lo script NON DEVE eseguire `git commit` o `git push`.
Lo script DEVE ottenere la versione corrente leggendo `package.json` (sola lettura, per popolare `config.json` e il tag Docker).

#### Scenario: Deploy eseguito senza version bump

- GIVEN il workflow ha gia pushato il commit di versione
- AND il VPS esegue `git pull` ottenendo i file aggiornati
- WHEN `deploy.sh` viene eseguito
- THEN lo script DEVE fare git pull per ottenere l'ultimo codice
- AND lo script DEVE buildare il frontend
- AND lo script DEVE deployare frontend e backend
- AND lo script NON DEVE modificare alcun file di versione
- AND lo script NON DEVE eseguire commit o push git

#### Scenario: Config.json generato con versione corretta

- GIVEN `package.json` contiene `"version": "1.2.4"` dopo il git pull
- WHEN `deploy.sh` genera `config.json`
- THEN il campo `APP_VERSION` DEVE essere `"1.2.4"`
- AND la versione DEVE corrispondere a quella nel `package.json`

#### Scenario: Tag Docker con versione corretta

- GIVEN `package.json` contiene `"version": "1.2.4"` dopo il git pull
- WHEN `deploy.sh` builda il container backend
- THEN il container DEVE essere taggato come `duedgusto-backend:1.2.4`

---

### Requirement: Deploy Script Non Richiede Argomento Bump Type

Lo script `deploy.sh` NON DEVE accettare un parametro `bump_type`.
Lo script SHOULD accettare zero argomenti per l'esecuzione standard.

#### Scenario: Esecuzione senza argomenti

- GIVEN `deploy.sh` non riceve argomenti
- WHEN viene eseguito
- THEN DEVE completare il deploy con successo
- AND DEVE leggere la versione da `package.json` senza calcolare bump

---

### Requirement: Sequenza di Step nel Workflow

Il workflow DEVE garantire un ordinamento corretto degli step per evitare race condition.

#### Scenario: Push completo prima del deploy SSH

- GIVEN il runner ha committato i file di versione
- WHEN il runner esegue il push
- THEN il push DEVE completarsi con successo PRIMA che venga avviato lo step di deploy SSH
- AND lo step SSH DEVE essere un step separato e successivo al push

#### Scenario: Git pull sul VPS ottiene la versione aggiornata

- GIVEN il push del commit di versione e completato
- AND lo step SSH si connette al VPS
- WHEN `deploy.sh` esegue `git pull`
- THEN il VPS DEVE ottenere il commit di versione appena pushato
- AND i file di versione sul VPS DEVONO corrispondere a quelli pushati dal CI

---

### Requirement: Concurrency Control

Il workflow DEVE impedire esecuzioni parallele per evitare conflitti di deploy.

#### Scenario: Un solo deploy alla volta

- GIVEN un'esecuzione del workflow e in corso
- WHEN un nuovo push su `main` triggera il workflow
- THEN la nuova esecuzione DEVE cancellare quella in corso (`cancel-in-progress: true`)
- AND il gruppo di concurrency DEVE essere `deploy`

---

### Requirement: Rimozione File AMICO4forWEB

I file di riferimento del progetto AMICO4forWEB DEVONO essere rimossi dal repository.

#### Scenario: Rimozione workflow AMICO4forWEB

- GIVEN il file `.github/actions/deploy.yml` contiene il workflow di AMICO4forWEB
- WHEN il change viene applicato
- THEN il file `.github/actions/deploy.yml` DEVE essere eliminato dal repository

#### Scenario: Rimozione action dotnet-versioning-action

- GIVEN la directory `.github/actions/dotnet-versioning-action/` contiene l'action per i `.csproj` di AMICO4forWEB
- WHEN il change viene applicato
- THEN l'intera directory `.github/actions/dotnet-versioning-action/` DEVE essere eliminata dal repository

---

### Requirement: Timeout del Workflow

Il workflow DEVE avere un timeout ragionevole per evitare esecuzioni bloccate.

#### Scenario: Timeout configurato

- GIVEN il workflow `deploy.yml` e configurato
- WHEN il job supera il tempo massimo
- THEN il job DEVE essere terminato automaticamente
- AND il timeout SHOULD essere di 15 minuti
