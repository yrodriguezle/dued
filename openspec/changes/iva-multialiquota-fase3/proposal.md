# Proposal: IVA Multialiquota — Fase 3

## Intent

Finding CRITICO #3 dell'audit: oggi l'IVA del registro cassa è calcolata con **un'unica aliquota** (`BusinessSettings.VatRate`, frazione `0.22`) applicata per scorporo sull'intero `TotaleVendite` (`MutateRegistroCassaOrchestrator.CalcolaTotali`, riga ~534). Il modello `Vendita` non porta aliquota né imponibile/imposta; il modello `Prodotto` non ha aliquota. È quindi **strutturalmente impossibile** produrre la liquidazione IVA italiana disaggregata per aliquota (DPR 633/72): un esercizio con prodotti al 22%, 10% e 4% dichiara tutto all'aliquota di default.

La Fase 2 (`coerenza-calcoli-fase2`) ha creato il prerequisito: `backend/Common/IvaCalculator.cs` centralizza scorporo/applicazione IVA con l'aliquota **sempre parametro** (convenzione interna: frazione; conversione esplicita con `AliquotaDaPercentuale`). Questa fase introduce il dato multialiquota end-to-end: aliquota sul prodotto → snapshot sulla vendita → breakdown per aliquota sul registro.

### Finding strutturali emersi dall'esplorazione (vincolano lo scope)

1. **`CalcolaTotali` azzera `VenditeContanti`** (riga 518: `registroCassa.VenditeContanti = 0;`) ad ogni salvataggio del registro, mentre `creaVendita`/`eliminaVendita` lo incrementano/decrementano. Se esistono Vendite e si risalva il registro, il totale itemizzato viene perso e il residuo (`TotaleVendite − Σ Vendite`) diventerebbe **negativo**. Il breakdown richiede di normalizzare questo punto.
2. **Il `TotaleVendite` non è interamente itemizzato**: include canali dichiarati manualmente (`IncassiElettronici`, `IncassoContanteTracciato`, `IncassiFattura`) non legati a Vendite/Prodotti. Il breakdown per aliquota può essere **esatto solo per la parte itemizzata**; il resto è attribuibile solo per stima.
3. **Non esiste alcuna mutation Prodotto** (solo query in `VenditeQueries`; i prodotti nascono da `SeedData/SeedProducts.cs`) e **non esiste un form Prodotti nel frontend**: per gestire l'aliquota serve un punto di amministrazione minimo, oggi assente.
4. `Fornitore.AliquotaIva` e le fatture acquisto usano già la convenzione **percentuale** (`22`): `Prodotto.AliquotaIva` deve adottare la stessa convenzione, con conversione a frazione solo via `IvaCalculator.AliquotaDaPercentuale` nei call site.
5. `ChiusuraMensile.TotaleIvaCalcolato` (NotMapped, runtime) somma `RegistroCassa.ImportoIva`: mantenendo `ImportoIva` = somma del breakdown, la chiusura mensile e il riepilogo annuale (`useQueryYearlySummary`) restano corretti senza modifiche.

## Scope

### In Scope

**A. `Prodotto.AliquotaIva` (backend + migrazione)**
1. Nuova proprietà `Prodotto.AliquotaIva` decimal, **convenzione percentuale** (es. `22.00`, `10.00`, `4.00`), colonna `decimal(5,2) NOT NULL`, default applicativo e DB `22.00` — coerente con `Fornitore.AliquotaIva`.
2. Migrazione EF non distruttiva con **backfill** dei prodotti esistenti: `AliquotaIva = BusinessSettings.VatRate × 100` (VatRate è FRAZIONE `0.22` → `22.00`); fallback `22.00` se la riga settings non esiste. SQL nella migrazione (subquery su `BusinessSettings`), nessuna perdita dati.
3. Validazione aliquote ammesse `{0, 4, 5, 10, 22}` centralizzata (costante unica, es. in `IvaCalculator` o classe affine in `Common/`), applicata alle mutation che accettano un'aliquota prodotto.
4. `SeedData/SeedProducts.cs` aggiornato con aliquote esplicite sui prodotti seed.

**B. Snapshot IVA su `Vendita` (backend + migrazione)**
5. Nuove proprietà su `Vendita`: `AliquotaIva` (percentuale, snapshot dell'aliquota prodotto al momento della vendita), `Imponibile`, `ImportoIva` (`decimal(10,2)`), calcolate in `CreaVenditaAsync`/`AggiornaVenditaAsync` con `IvaCalculator.ScorporaDaLordo(PrezzoTotale, AliquotaDaPercentuale(prodotto.AliquotaIva))` — prezzi IVA inclusa, come da convenzione registro cassa. L'invariante del calculator garantisce `Imponibile + ImportoIva == PrezzoTotale` al centesimo per riga.
6. Migrazione EF con **backfill** delle vendite esistenti: aliquota dal prodotto (già backfillata in A.2), `Imponibile = ROUND(PrezzoTotale / (1 + AliquotaIva/100), 2)`, `ImportoIva = PrezzoTotale − Imponibile`. Nota rounding: MySQL `ROUND` è half-away-from-zero, `IvaCalculator` usa `ToEven`, ma per le aliquote reali (22/10/4/5) un lordo a 2 decimali non produce midpoint (documentato in `IvaCalculator`): i valori coincidono.

**C. Breakdown per aliquota su `RegistroCassa` (backend + migrazione)**
7. **Tabella figlia `RegistroCassaIva`** (raccomandata rispetto alla colonna JSON — vedi Approach): `Id`, `RegistroCassaId` (FK cascade), `Aliquota` decimal(5,2) percentuale, `Imponibile` decimal(10,2), `Imposta` decimal(10,2), `Stimato` bool. Indice su `RegistroCassaId` + unique `(RegistroCassaId, Aliquota, Stimato)`.
8. Calcolo del breakdown centralizzato in un punto unico riusabile (estrazione da/accanto a `CalcolaTotali`), invocato da `MutateRegistroCassaOrchestrator` e dalle mutation Vendite:
   - **parte esatta**: somma per aliquota degli snapshot di riga (`Σ Imponibile`, `Σ ImportoIva` delle Vendite del registro raggruppate per `AliquotaIva`), `Stimato = false`;
   - **residuo**: `TotaleVendite − Σ Vendite.PrezzoTotale`; se > 0, riga aggiuntiva scorporata all'aliquota di default (`VatRate`), `Stimato = true`;
   - `RegistroCassa.ImportoIva` resta e diventa **`Σ Imposta` del breakdown** (retrocompatibilità: chiusura mensile, riepilogo annuale e frontend esistente continuano a funzionare invariati).
9. **Normalizzazione `VenditeContanti`** (necessaria al breakdown, finding 1): in `CalcolaTotali`, `VenditeContanti` viene **ricalcolato dalla somma delle Vendite persistite del registro** invece di essere azzerato. Per i registri senza vendite itemizzate (flusso attuale reale) il valore resta 0 e il comportamento è identico a oggi.
10. Migrazione EF per la tabella + **backfill dei registri esistenti**: una riga per registro con `Aliquota = VatRate×100`, `Imposta = ImportoIva` esistente, `Imponibile = TotaleVendite − ImportoIva`, `Stimato = true` (i dati storici non hanno breakdown reale; il valore aggregato è preservato bit a bit). I registri con Vendite verranno raffinati al primo ricalcolo naturale (risalvataggio) — nessun ricalcolo retroattivo d'ufficio.

**D. Esposizione GraphQL (additiva, nessuna rottura)**
11. `ProdottoType`: campo `aliquotaIva`.
12. `VenditaType`: campi `aliquotaIva`, `imponibile`, `importoIva`.
13. `RegistroCassaType`: campo `breakdownIva` (lista di nuovo `RegistroCassaIvaType` con `aliquota`, `imponibile`, `imposta`, `stimato`), risolto con DataLoader secondo il pattern esistente (`GetSpeseByRegistroId` ecc. in `GraphQL/DataLoaders/`).
14. **Nuova mutation prodotto minima** (oggi inesistente): `mutateProdotto` in `VenditeMutations` (o modulo Prodotti dedicato) per creare/aggiornare un prodotto inclusa `aliquotaIva`, con validazione aliquote ammesse. Necessaria perché senza di essa l'aliquota prodotto sarebbe gestibile solo via SQL.

**E. Frontend minimo**
15. Tipi e fragment aggiornati (`RegistroCassa.d.ts`, `graphql/cashRegister/fragments.tsx`): `breakdownIva` sul registro.
16. Visualizzazione breakdown IVA nel dettaglio registro (`RegistroCassaDetails.tsx`, dove oggi è mostrato `importoIva`): tabellina aliquota / imponibile / imposta, con indicazione "stimato" per la riga residuo.
17. Gestione aliquota prodotto: **pagina/gestione Prodotti completa NON in scope** (non esiste oggi alcuna UI prodotti); la mutation D.14 abilita la gestione via API. L'eventuale pagina amministrativa Prodotti è una decisione aperta per il design (vedi sotto).

### Out of Scope

- **Guard su registri/mesi chiusi** oltre quelli esistenti (deferred per decisione utente, come in Fase 2).
- **Registri IVA formali / liquidazione periodica** (stampe registro corrispettivi, liquidazione IVA): futuro; questa fase crea il dato disaggregato che li rende possibili.
- **Modifiche al flusso di vendita UI** (POS/itemizzazione in cassa): il flusso operativo resta a canali dichiarati; le Vendite itemizzate restano un flusso parallelo.
- **Aliquote configurabili da UI**: il set `{0, 4, 5, 10, 22}` è una costante centralizzata; la configurabilità da BusinessSettings è futura.
- **Breakdown IVA nella chiusura mensile / report di stampa**: `TotaleIvaCalcolato` resta l'aggregato (corretto per costruzione); il dettaglio per aliquota mensile è un'estensione futura banale una volta esistente `RegistroCassaIva`.
- **Ricalcolo retroattivo "esatto"** dei breakdown storici dai dati Vendite: il backfill marca tutto `Stimato = true` preservando gli aggregati; nessuna riscrittura contabile del passato.

### Limite contabile documentato (da esporre anche in UI/spec)

Il breakdown è **esatto solo per la parte itemizzata** (Vendite registrate). Il residuo dei canali dichiarati manualmente (`IncassiElettronici`, `IncassoContanteTracciato`, `IncassiFattura`) è attribuito all'aliquota di default e marcato `Stimato = true`. Finché l'esercizio non itemizza il venduto, la disaggregazione resta una stima sull'aliquota prevalente: il sistema lo dichiara esplicitamente invece di nasconderlo (oggi la stima al 100% single-rate è implicita e non dichiarata).

## Approach

1. **Convenzione dati**: l'aliquota persistita è SEMPRE percentuale (`22.00`), come `Fornitore.AliquotaIva`; la conversione a frazione avviene solo nei call site via `IvaCalculator.AliquotaDaPercentuale`. Tutti i calcoli passano da `IvaCalculator` (nessuna formula inline nuova).
2. **Tabella figlia vs JSON**: si raccomanda la tabella `RegistroCassaIva` perché: (a) aggregazioni SQL/LINQ dirette per i futuri registri IVA mensili (`GROUP BY Aliquota` cross-registro), (b) vincoli e tipi forti (`decimal(10,2)`, FK cascade) contro JSON non tipizzato, (c) coerenza con il pattern figli esistente del registro (`ConteggiMoneta`, `SpeseCassa`) già servito da DataLoader. Il JSON avrebbe meno migrazione ma renderebbe la liquidazione futura una parsificazione applicativa.
3. **Punto di calcolo unico**: la logica "raggruppa vendite per aliquota + residuo stimato" vive in un helper/servizio unico (`Common/` o servizio GestioneCassa) chiamato sia da `CalcolaTotali` (salvataggio registro) sia dalle mutation Vendite (crea/aggiorna/elimina), che oggi già aggiornano i totali del registro inline. Strategia delete+reinsert delle righe figlie nel salvataggio, come già fatto per `ConteggiMoneta`/`SpeseCassa`.
4. **Somma degli scorpori di riga, non scorporo della somma** (parte esatta): si sommano `Imponibile`/`ImportoIva` snapshot delle vendite; garantisce `Σ righe = Σ lordi` al centesimo e coerenza tra dettaglio vendita e breakdown (lo scorporo della somma può divergere di centesimi dalla somma degli scorpori).
5. **Migrazioni in sequenza** (3 migrazioni EF, auto-apply all'avvio come da progetto): A) `AddAliquotaIvaToProdotti` con backfill da `BusinessSettings`; B) `AddSnapshotIvaToVendite` con backfill da aliquota prodotto; C) `AddRegistroCassaIva` con backfill stimato per registro. Ordine vincolato: B dipende dal backfill di A.
6. **Retrocompatibilità GraphQL**: solo campi additivi; `importoIva` su `RegistroCassa`, `totaleIva` del riepilogo mensile e `TotaleIvaCalcolato` della chiusura mensile mantengono semantica e valori (somma del breakdown ≡ valore attuale per registri single-rate senza vendite itemizzate).

Moduli coinvolti: **backend + frontend**. Migrazioni DB: **sì, 3, non distruttive con backfill**.

## Affected Areas

| Area | Impact | Descrizione |
|------|--------|-------------|
| `backend/Models/Prodotto.cs` | Modified | `AliquotaIva` decimal percentuale, default 22 |
| `backend/Models/Vendita.cs` | Modified | Snapshot `AliquotaIva`, `Imponibile`, `ImportoIva` |
| `backend/Models/RegistroCassaIva.cs` | New | Entità breakdown (Aliquota, Imponibile, Imposta, Stimato) |
| `backend/Models/RegistroCassa.cs` | Modified | Navigation `ICollection<RegistroCassaIva>` |
| `backend/DataAccess/AppDbContext.cs` | Modified | DbSet + configurazione `RegistroCassaIva`, colonne nuove (decimal(5,2)/(10,2), default, indici) |
| `backend/Migrations/*` | New | 3 migrazioni con backfill SQL (prodotti, vendite, registri) |
| `backend/Common/` (IvaCalculator o affine) | Modified/New | Costante aliquote ammesse `{0,4,5,10,22}` + eventuale helper breakdown |
| `backend/GraphQL/GestioneCassa/MutateRegistroCassaOrchestrator.cs` | Modified | `CalcolaTotali`: VenditeContanti da Σ Vendite (non più azzerato), ricalcolo breakdown, `ImportoIva = Σ Imposta` |
| `backend/GraphQL/Vendite/VenditeMutations.cs` | Modified | Snapshot IVA su crea/aggiorna; ricalcolo breakdown registro su crea/aggiorna/elimina; nuova `mutateProdotto` |
| `backend/GraphQL/Vendite/Types/ProdottoType.cs` | Modified | Campo `aliquotaIva` |
| `backend/GraphQL/Vendite/Types/VenditaType.cs` | Modified | Campi `aliquotaIva`, `imponibile`, `importoIva` |
| `backend/GraphQL/GestioneCassa/Types/RegistroCassaType.cs` | Modified | Campo `breakdownIva` (lista) |
| `backend/GraphQL/GestioneCassa/Types/RegistroCassaIvaType.cs` | New | Output type breakdown |
| `backend/GraphQL/Vendite/Types/` (input prodotto) | New | Input type per `mutateProdotto` con validazione aliquota |
| `backend/GraphQL/DataLoaders/` | Modified | DataLoader `GetBreakdownIvaByRegistroId` (pattern esistente) |
| `backend/SeedData/SeedProducts.cs` | Modified | Aliquote sui prodotti seed |
| `backend/DuedGusto.Tests/` | Modified/New | Test IvaCalculator/breakdown (unit) + mutation (integration); aggiornamento test esistenti su ImportoIva |
| `duedgusto/src/@types/RegistroCassa.d.ts` | Modified | Tipo `breakdownIva` |
| `duedgusto/src/graphql/cashRegister/fragments.tsx` | Modified | Campo `breakdownIva` nel fragment registro |
| `duedgusto/src/components/pages/registrazioneCassa/RegistroCassaDetails.tsx` | Modified | Tabellina breakdown IVA accanto a `importoIva`, badge "stimato" |
| `duedgusto/src/graphql/cashRegister/__tests__/*` | Modified | Mock aggiornati con `breakdownIva` |

## Decisioni aperte per il design

1. **Residuo negativo** (`TotaleVendite < Σ Vendite.PrezzoTotale`): con la normalizzazione di `VenditeContanti` (C.9) non dovrebbe più verificarsi a regime, ma i dati storici incoerenti esistono. Opzioni: clamp a 0 con warning nei log; riga residuo negativa; errore bloccante. Raccomandazione preliminare: clamp a 0 + log, mai bloccare il salvataggio cassa.
2. **Dove vive il calcolo breakdown**: helper statico in `Common/` (puro, testabile, riceve vendite + totale + aliquota default) vs servizio con accesso DB. Raccomandazione: helper puro + caricamento vendite a carico dei chiamanti.
3. **Pagina amministrativa Prodotti** (frontend): creare una pagina AG Grid minima (richiede anche record Menu nel DB, routing dinamico) oppure rinviare a una change dedicata lasciando la sola mutation API. Impatta lo sforzo frontend in modo significativo.
4. **`aggiornaVendita` e cambio prodotto**: oggi riprende il `Prezzo` corrente del prodotto (non lo snapshot); per coerenza lo snapshot aliquota al cambio prodotto deve riprendere l'aliquota corrente del nuovo prodotto — confermare che anche l'aggiornamento senza cambio prodotto NON ricalcoli l'aliquota snapshot (immutabilità dello storico).
5. **Backfill registri storici con Vendite**: lasciare tutto `Stimato = true` (raccomandato, zero rischio contabile) vs ricostruire la parte esatta dalle vendite backfillate nella migrazione C (più fedele ma più SQL nella migrazione).
6. **Evento subscription**: estendere `RegistroCassaUpdatedEvent`/`VenditaCreatedEvent` con dati IVA o lasciare invariati (il refetch del client ricarica comunque il breakdown). Raccomandazione: invariati.

## Risks

| Rischio | Probabilità | Mitigazione |
|---------|-------------|-------------|
| Backfill migrazione errato su dati reali (aliquota/scorporo) | Media | SQL con stessa formula di `IvaCalculator` (no midpoint per aliquote reali, documentato); migrazione idempotente; verificare su copia del DB prima del deploy; `ImportoIva` aggregato preservato bit a bit nel backfill registri |
| Cambio comportamento `VenditeContanti` (non più azzerato) altera `TotaleVendite`/`ContanteAtteso` per registri con vendite itemizzate | Media | A regime odierno le vendite itemizzate non sono usate nel flusso reale (azzeramento attuale lo dimostra): impatto nullo per i registri esistenti senza vendite; test di integrazione su entrambi gli scenari; documentare nello spec |
| Somma breakdown ≠ `ImportoIva` legacy per divergenze di rounding | Bassa | `ImportoIva` è definito come `Σ Imposta` del breakdown (non ricalcolato indipendentemente): coincidenza per costruzione; per registri senza vendite la riga unica stimata usa lo stesso `ScorporaDaLordo` di oggi → valore identico |
| Rottura query GraphQL/fragment esistenti | Bassa | Solo campi additivi; nessun campo rinominato/rimosso; test frontend esistenti aggiornati solo nei mock |
| Migrazioni auto-apply all'avvio falliscono in produzione a metà sequenza | Bassa | Migrazioni EF transazionali per step; ordine A→B→C con dipendenze esplicite; rollback plan sotto |
| La riga "stimato" viene letta come dato fiscale esatto | Media | Flag `stimato` esposto in GraphQL e mostrato in UI; limite contabile documentato in spec e proposta |

## Rollback Plan

- **Codice applicativo**: revert dei commit backend+frontend; i campi additivi GraphQL spariscono senza rompere i client (i fragment vanno revertati insieme — stesso commit/PR).
- **Database**: le 3 migrazioni sono additive (colonne nuove con default + tabella nuova): `dotnet ef database update <MigrazionePrecedente>` le rimuove senza toccare dati preesistenti. I valori backfillati vivono solo nelle colonne/tabella nuove: il drop è privo di perdita per i dati storici originali.
- **`ImportoIva` e `TotaleIvaCalcolato`**: mai modificati nei valori persistiti dal backfill (la riga stimata replica l'aggregato); il rollback ripristina il calcolo single-rate identico a oggi.
- **`VenditeContanti`**: il revert ripristina l'azzeramento; nessun dato persistito da correggere (il ricalcolo avviene a ogni salvataggio).

## Dependencies

- **Fase 2 committata** (`coerenza-calcoli-fase2`): `IvaCalculator` con aliquota parametrica è il prerequisito dichiarato ("Prerequisito Fase 3" nella XML doc del calculator).
- `BusinessSettings` con riga presente (seed esistente) per il default di backfill; fallback 22 in sua assenza.
- Suite test backend `backend/DuedGusto.Tests` (`dotnet test`) e frontend (`npm run test`, `ts:check`, `lint`).
- MySQL 8.0+: subquery in `UPDATE` per i backfill cross-tabella.

## Success Criteria

- [ ] Ogni prodotto ha `AliquotaIva` valida in `{0, 4, 5, 10, 22}`; i prodotti preesistenti sono backfillati all'aliquota di default derivata da `BusinessSettings.VatRate × 100`
- [ ] Ogni nuova vendita persiste snapshot `AliquotaIva`/`Imponibile`/`ImportoIva` con `Imponibile + ImportoIva == PrezzoTotale` al centesimo (via `IvaCalculator.ScorporaDaLordo`); le vendite storiche sono backfillate
- [ ] Un registro con vendite a più aliquote espone `breakdownIva` con una riga esatta per aliquota (`stimato = false`) e l'eventuale residuo a default (`stimato = true`); `Σ imposta == importoIva` e `Σ (imponibile + imposta) == totaleVendite`
- [ ] Per un registro senza vendite itemizzate (flusso attuale), `importoIva` calcolato dopo la change coincide al centesimo con il valore pre-change
- [ ] Chiusura mensile (`totaleIvaCalcolato`) e riepilogo annuale (`totaleIva`) invariati nei valori per i dati esistenti
- [ ] `mutateProdotto` crea/aggiorna un prodotto con aliquota validata; aliquota fuori set → errore GraphQL esplicito
- [ ] Le query/fragment GraphQL esistenti eseguono senza modifiche (campi solo additivi)
- [ ] Il dettaglio registro frontend mostra il breakdown per aliquota con indicazione "stimato"
- [ ] `dotnet build` + `dotnet test` passano (nuovi test breakdown inclusi); `npm run ts:check` + `npm run lint` + `npm run test` passano
- [ ] Rollback verificato: `ef database update` alla migrazione precedente rimuove gli artefatti senza toccare i dati originali
