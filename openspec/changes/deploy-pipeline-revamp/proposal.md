# Proposal: Deploy Pipeline Revamp

## Intent

Il deploy attuale esegue il version bump direttamente sul VPS via SSH. Questo causa:
1. **Git identity mancante** sul server → il commit di versione fallisce (`unable to auto-detect email address`)
2. **Credenziali GitHub assenti** → il push fallisce (`could not read Username`)
3. **Disallineamento versioni** tra locale, remoto e produzione
4. **Due custom actions separate** (`versioning-action` e `dotnet-versioning-action`) con codice duplicato e bug

L'obiettivo è spostare il versioning nel CI (GitHub Actions runner), unificare le due actions in una sola, e snellire `deploy.sh` perché faccia solo il deploy.

## Scope

### In Scope
- Unificare `versioning-action` e `dotnet-versioning-action` in una sola action
- Aggiornare a Node 22 (LTS attuale)
- Fixare bug: race condition `fs.writeFile` callback, hack `setOutput` manuale
- Adattare i path ai file di DuedGusto (`package.json`, `duedgusto/package.json`, `backend/duedgusto.csproj`)
- Riscrivere `deploy.yml` con: checkout → versioning → commit+push → SSH deploy
- Snellire `deploy.sh`: rimuovere tutta la logica di versioning (solo git pull, build, deploy)
- Protezione anti-loop: `[skip ci]` nel commit message + condizione `if` nel workflow

### Out of Scope
- Aggiunta di test (lint, unit test) nel CI — da fare in un change separato
- Multi-environment deploy (staging/production)
- Notifiche (Slack, Teams, email)
- Containerizzazione del build frontend nel CI

## Approach

**Action unificata `versioning-action`**:
1. Riceve `bump-type` (patch/minor/major) e lista di file target come input
2. Bumpa `package.json` root e frontend con `npm version`
3. Aggiorna `<Version>` nel `.csproj` con lo stesso numero
4. Output: nuova versione
5. Node 22, codice pulito con async/await, `core.setOutput()` nativo

**Workflow `deploy.yml` riscritto**:
1. `checkout` con `persist-credentials: true`
2. `setup-node` v4 con Node 22
3. Step versioning (usa action unificata)
4. Commit + push della versione (con `[skip ci]` e git identity configurata)
5. SSH deploy sul VPS (esegue `deploy.sh` senza versioning)

**`deploy.sh` snellito**:
- Rimuovere righe 36-53 (tutto il blocco versioning)
- Mantiene: backup, git pull, build frontend, copy dist, docker build backend, health check, nginx reload

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `.github/actions/versioning-action/` | Modified | Riscritta: unifica le due actions, Node 22, path DuedGusto |
| `.github/actions/dotnet-versioning-action/` | Removed | Funzionalita assorbita nell'action unificata |
| `.github/workflows/deploy.yml` | Modified | Riscritto: versioning nel CI, SSH solo per deploy |
| `deploy/scripts/deploy.sh` | Modified | Rimosso blocco versioning (righe 36-53) |
| `.github/actions/deploy.yml` | Removed | File di riferimento AMICO4forWEB, non serve |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Loop di deploy (commit versione ri-triggera workflow) | Medium | Condizione `if: !contains(github.event.head_commit.message, '[skip ci]')` + `paths-ignore` gia presente |
| Push fallito per permessi token | Low | Usare `permissions: contents: write` nel workflow + `persist-credentials: true` |
| Deploy parte prima che il push sia completo | Low | Step sequenziali nel workflow (push prima, SSH dopo) |
| `deploy.sh` fa git pull ma la versione non e ancora arrivata | Low | Il push avviene PRIMA dell'SSH nel workflow, git pull prende l'ultimo commit |

## Rollback Plan

1. Il workflow precedente e nel git history — basta fare revert del commit
2. `deploy.sh` precedente e nel git history — stesso revert
3. In caso di emergenza: eseguire `deploy.sh` manualmente via SSH (funziona standalone)
4. Le actions vecchie restano nel git history se serve ripristinarle

## Dependencies

- `GITHUB_TOKEN` con permesso `contents: write` (default per `actions/checkout`)
- Secrets esistenti: `VPS_HOST`, `VPS_USER`, `SSH_PRIVATE_KEY` (gia configurati)
- Node 22 disponibile in `actions/setup-node@v4`

## Success Criteria

- [ ] Push su main triggera il workflow, che bumpa la versione e pusha il commit di versione
- [ ] Il commit di versione NON ri-triggera il workflow (no loop)
- [ ] `deploy.sh` sul server NON fa piu version bump
- [ ] Dopo il deploy, locale + remoto + server hanno la stessa versione
- [ ] Una sola action `versioning-action` gestisce sia `package.json` che `.csproj`
- [ ] `dotnet-versioning-action` e `deploy.yml` di AMICO4forWEB rimossi dal progetto
