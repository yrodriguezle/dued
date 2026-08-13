# Verify Report: IVA digitata sulle fatture acquisto

**Change**: fattura-iva-digitata
**Data verifica**: 2026-08-13
**Esito**: conforme, con uno scostamento non bloccante dichiarato in fondo.

## Comandi eseguiti

| Comando | Esito |
|---------|-------|
| `cd backend && dotnet build` | 0 errori, 0 warning |
| `cd backend && dotnet test` | 695/695 verdi |
| `cd duedgusto && npm run ts:check` | pulito |
| `cd duedgusto && npm run lint` | pulito |
| `cd duedgusto && npm run test` | 781/781 verdi in 98 file |

## Matrice Success Criteria

| Criterio (proposal) | Evidenza |
|---------------------|----------|
| Fattura con `importoIva` → importo esatto e `IvaCalcolata = false` | `FatturaIvaDigitataTests.MutateAsync_ConImportoIva_UsaLIvaDigitataEIgnoraLAliquota` (204,42 / 23,08 / 227,50, flag false) |
| Fattura senza `importoIva` identica al pre-change, flag `true` | `MutateAsync_SenzaImportoIva_CalcolaDallAliquotaComePrima` (300 → 66 / 366) |
| Rimettendo la spunta gli importi tornano dall'aliquota | `MutateAsync_RimettendoLaSpunta_TornaACalcolareDallAliquota` (flag true, IVA 44,97) |
| Prelievo DDT su IVA digitata: IVA invariata, imponibile mosso | `AssociaDdt_SuFatturaConIvaDigitata_CongelaLIvaEMuoveLImponibile` (300 / 23,08 / 276,92) |
| Prelievo DDT su monoaliquota invariato | `AssociaDdt_SuFatturaMonoaliquota_RiscorporaComePrima` (244 → 200 / 44, scenario della spec base) |
| IVA digitata pari a un'aliquota di legge resta congelata | `AssociaDdt_ConIvaDigitataPariAUnAliquotaDiLegge_CongelaComunque` (100 + 22 → 278 / 22) |
| DDT (dis)associati entrano/escono dalla somma nello stesso ricalcolo | `AssociaDdt_SuFatturaMonoaliquota_RiscorporaComePrima` e `DisassociaDdt_SuFatturaConIvaDigitata_CongelaLIva` |
| Storico tutto `IvaCalcolata = true` senza backfill | DDL della migrazione: `tinyint(1) NOT NULL DEFAULT 1`, nessuna istruzione sui dati |
| Build e test verdi su entrambi i moduli | tabella comandi sopra |

## Il bug preesistente trovato in corsa

`AssociaDdt_SuFatturaMonoaliquota_RiscorporaComePrima` è fallito alla prima esecuzione attendendo
244,00 € e trovando 0,00 €. Causa: `AssociaDdtAsync` assegnava `FatturaId` in memoria e chiamava
subito il ricalcolo, che rilegge i DDT con `Repository.FindAsync` — cioè
`_dbSet.Where(predicate).ToListAsync()`, una query al provider e non una lettura del change tracker.
I DDT appena collegati non erano ancora persistiti. Simmetricamente, in disassociazione i DDT
staccati continuavano a essere sommati.

Corretto con `SaveChangesAsync` prima del ricalcolo, dentro la transazione già aperta da
`ExecuteInTransactionAsync`: nessun cambio di atomicità. Non è stato cercato — è emerso perché la
decisione sul congelamento non poteva funzionare su un totale calcolato da un insieme di DDT stantio.

Nessun ricalcolo retroattivo d'ufficio sulle fatture esistenti: il primo prelievo o rimozione
successivo le riallinea.

## Scostamento dichiarato

**Migrazione non applicata su copia di dati reali.** Per le change precedenti che toccavano i dati
(es. `iva-multialiquota-fase3`) la verifica includeva dump/restore su un database di copia e
riscontro degli invarianti pre/post. Qui non è stato fatto: il DDL è una singola `AddColumn` con
default costante, non tocca alcuna riga esistente e non ha SQL interpretativo: la classe di rischio
che quella procedura copre (backfill che riscrive dati) non si presenta.

Il riscontro utile resta la query di controllo post-deploy indicata nel design:
`SELECT COUNT(*) FROM FattureAcquisto WHERE IvaCalcolata <> 1` atteso `0` subito dopo il rilascio.

## Nota per chi archivierà `ciclo-ddt-fattura`

Quella change è ancora **attiva** e il suo requirement "Calcolo automatico totale da DDT" descrive il
ricalcolo come incondizionato (`imponibile = totale / (1 + aliquotaIva / 100)`). Questa change lo
rende condizionale a `IvaCalcolata`. Al momento della sua archiviazione il requirement va recepito
nella variante corrente, non riscritto nella forma originale.
