# Specs: deploy-pipeline-revamp

## Domains

- [ci-cd](specs/ci-cd/spec.md) — Pipeline CI/CD: versioning, deploy, protezione anti-loop

## Summary

| Domain | Type | Requirements | Scenarios |
|--------|------|-------------|-----------|
| ci-cd | New | 9 | 18 |

## Requirements Index

1. **Unified Versioning Action** — Una sola action Node 22 per bumping package.json + csproj
2. **Versioning Eseguito nel CI Runner** — Bump nel GitHub Actions runner, non sul VPS
3. **Commit di Versione con Identita Git Configurata** — Git identity configurata per commit automatico
4. **Protezione Anti-Loop del Deploy** — `[skip ci]` + `paths-ignore` per evitare loop
5. **Deploy Script Senza Versioning** — `deploy.sh` fa solo build e deploy
6. **Deploy Script Non Richiede Argomento Bump Type** — Nessun parametro necessario
7. **Sequenza di Step nel Workflow** — Push completato prima del deploy SSH
8. **Concurrency Control** — Un solo deploy alla volta
9. **Rimozione File AMICO4forWEB** — Eliminazione file legacy
10. **Timeout del Workflow** — Protezione da esecuzioni bloccate
