# Proposal: ordini al punto vendita, gruppi di prodotti e voce «Vendita» di primo livello

Fonte primaria: GitHub issue **#24**, che segue **#19** — quest'ultima resta valida per l'anagrafica
di cassa e per la mappatura dei tre secchi, e ne viene corretta solo la premessa sul momento in cui
si sceglie il metodo di pagamento. Le decisioni contenute nella issue sono dell'utente e sono
**vincolanti**: qui non si rimettono in discussione, si traducono in piano.

## Intent

Il punto vendita in produzione implementa il gesto «due tocchi per consumazione» (#19 Fase 5):
prodotto → metodo di pagamento, e il **secondo tocco scrive già nei secchi del registro**, nello
stesso commit in cui nasce la riga. In `VenditeMutations.CreaVenditaAsync` la sequenza è:
`SecchiIncassiApplier.ApplicaDelta` muove `IncassiElettronici` o `IncassoContanteTracciato`, poi
`BreakdownIvaApplier.ApplicaAsync` ricalcola `VenditeContanti`, `TotaleVendite` e le righe IVA.

Al bancone quell'assunto è falso:

> Quando batto la consumazione **non so ancora come pagheranno**.

Si prende l'ordine, si prepara, si serve, e il metodo di pagamento si scopre **alla fine**, quando
arrivano alla cassa. Il metodo non appartiene alla riga: appartiene **all'ordine**.

La conseguenza non è estetica. Battere una consumazione oggi **dichiara già dove vanno i soldi**;
se poi pagano diversamente bisogna correggere, e la correzione passa da un'operazione dichiarata
non idempotente nel suo stesso file:

> ⚠️ **Il delta non è idempotente per costruzione.** Applicarlo due volte per la stessa vendita
> raddoppia l'importo, e nessun controllo a valle se ne accorgerebbe.
> — `backend/GraphQL/GestioneCassa/SecchiIncassiApplier.cs`

Un flusso che costringe a indovinare e poi correggere, appoggiato su un'operazione che non tollera
la doppia applicazione, è una macchina per errori contabili. L'ordine toglie l'indovinello: le voci
si accumulano senza toccare niente, e la scrittura contabile diventa **una transizione sola**.

Servono tre cose, che la issue mette in quest'ordine di lavoro:

1. **C** — la voce «Vendita» in sidebar di primo livello: indipendente, costa poco, si fa subito.
2. **A** — l'ordine: il cambio strutturale, con tutte le decisioni già prese.
3. **B** — i gruppi di prodotti: dipende da A, perché i gruppi servono a riempire un ordine.

## Scope

### In Scope

**A. L'ordine**

1. Entità **ordine** con macchina a stati (`APERTO` → `CHIUSO` | `SPLITTATO` | `ANNULLATO`, più
   `STORNATO` per l'ordine chiuso da correggere) e **righe d'ordine** come entità propria.
   `SPLITTATO` è il padre di uno split: non muove secchi — li muovono i figli, che nascono `CHIUSO` —
   e non è stornabile direttamente.
2. **Identificativo stampabile** sull'ordine e righe leggibili come gruppo — la stampa non si fa
   ora, ma vincola il modello da subito (vedi Out of Scope).
3. Il **pagamento si sceglie a fine ordine**, non per voce. La modale attuale
   (`SceltaMetodoPagamento.tsx`) resta valida come gesto — sale dal basso, bersagli ≥ 56 px, una
   mano sola — e si sposta: da ogni voce a fine ordine.
4. Un ordine aperto **non tocca né i secchi né il breakdown IVA**.
5. La chiusura muove i secchi **una volta e una sola**, con la garanzia sulla transizione di stato
   e non sulla buona fede del chiamante.
6. **Split per metodo di pagamento**: alla chiusura l'ordine si spacca in 2..n ordini chiusi, uno
   per metodo, in una transazione sola. Il modello resta «un ordine, un metodo».
7. **Calcolo del resto al cliente**: alla chiusura in contanti si digita quanto ha dato il cliente
   e l'app mostra il resto. Nome diverso da `RegistroCassa.Resto`, in codice e in UI.
8. La **chiusura del registro si blocca** con ordini aperti, con l'elenco mostrato lì e le due
   uscite per ognuno: chiuderlo incassando, o annullarlo.
9. **Annullare** (ordine aperto, nessun delta) e **stornare** (ordine chiuso, delta inverso) sono
   due mutation distinte, con due nomi distinti e due guardie distinte.
10. L'ordine annullato **non sparisce**: stato `ANNULLATO`, con chi e quando, e resta consultabile.

**B. Gruppi di prodotti**

11. Entità **gruppo**, raggruppamento **libero gestito dall'utente**, con pagina di gestione: si
    crea il gruppo e ci si mettono dentro i prodotti che si vogliono. Indipendente da categoria e
    da prezzo — è il livello sopra i prodotti che scioglie il taglio trasversale.
12. Nel punto vendita la griglia principale mostra **gruppi + prodotti non raggruppati**; toccare
    un gruppo apre la griglia di **tastoni** delle varianti (pulsanti, non AG Grid).
13. **Ogni variante diventa un articolo a sé**: le 14 voci accorpate del listino 2026 si spaccano,
    e «con prosecco di bottiglia» (+0,50) diventa un articolo per ogni spritz invece di un secondo
    tocco. Il listino passa da **122 a circa 147** articoli.
14. Le vecchie voci accorpate si **disattivano**, non si cancellano: `eliminaProdotto` non esiste
    nell'API. L'anagrafica arriva a ~161 righe di cui 14 spente.
15. **Colore esplicito** per variante (Liscio bianco, Aperol arancione, Campari rosso, Cynar viola)
    che, quando valorizzato, **vince** sul colore generato da `coloriProdotto.tsx`.

**C. La voce in sidebar**

16. `SeedMenusVendita.cs`: da `MenuPadre = cassaMenu` a **primo livello** (`MenuPadreId = null`),
    con una posizione che la mette in cima.

### Out of Scope

- **La stampa delle voci in fase di ordine.** È prevista, ma non ora. Vincola comunque il modello
  fin da subito: serve un identificativo stampabile e righe leggibili come gruppo. Un modello che
  tratta le righe come vendite sciolte agganciate al registro non lo reggerebbe.
- **Più conti insieme (tavoli).** Si gestisce l'ordine, non il tavolo: uno per volta.
- **Ordini a cavallo di mezzanotte.** Finché la cassa non si chiude, tutto resta nel giorno di
  apertura.
- **Split per importo** sullo stesso insieme di voci — totale 30 €, 20 in contanti e 10 con carta
  senza poter dire quali voci stanno di qua e quali di là. Non supportato, e **detto esplicitamente
  in UI** invece di lasciarlo scoprire all'operatore alla cassa. Se poi capita davvero, si riapre.
- **Cancellazione fisica** delle 14 voci accorpate: richiede SQL diretto sul VPS.
- **Pubblicazione in vetrina** delle nuove varianti: `VisibileSulSito` resta `false`, caricare il
  listino non pubblica niente ed è giusto così.
- **Caricamento in produzione** del listino ampliato: resta una decisione a parte, come già per
  `SEED_LISTINO_2026`.
- **Sottoscrizione `onVenditaCreated`** e sua estensione agli ordini: resta il punto aperto di
  #19 Fase 6, non si allarga qui.

### Decisioni prese con l'utente (issue #24, vincolanti)

| Domanda | Decisione |
|---|---|
| Ordini aperti a lungo | **Sì, sono la norma**: un ordine resta aperto finché non si sa come pagano |
| Ordini già chiusi | **Sì**, convivono con quelli aperti |
| Pagamento misto | **Sì, per split**: alla chiusura l'ordine si spacca in 2..n ordini, uno per metodo |
| Ordine a cavallo di mezzanotte | **Non si gestisce**: tutto resta nel giorno di apertura |
| Più conti insieme (tavoli) | **No**: si gestisce l'ordine, non il tavolo |
| Chiusura cassa con ordini aperti | **Si blocca**, ma si può annullare un ordine per sbloccarla |
| Ordine annullato | **Non sparisce**: stato `ANNULLATO` tracciato, non cancellazione fisica |
| Gruppi di prodotti | **Raggruppamento libero**, gestito dall'utente da una pagina di gestione |
| Varianti | **Ogni variante è un articolo a sé**; «con prosecco» è un articolo, non un secondo tocco |
| Voci accorpate vecchie | **Disattivate**, mai cancellate |
| Colore | **Esplicito per variante**, vince sul generato |
| Voce «Vendita» | **Primo livello** in sidebar |
| Un prodotto in più gruppi | **Sì, molti-a-molti** — criterio dell'utente «se non è complicato»; valutato sul codice, non lo è (vedi «Decisioni aperte — chiuse dall'utente») |
| `GRAPPA` e righe 49-50 del foglio | **Entrano** nel listino di questo change. `GRAPPA` («€ 3 / 4») diventa **due articoli**; le righe 49-50 (2,50 €) restano **senza nome** finché non arriva la lista |
| Ruoli della voce «Vendita» | **Per chiunque** — cioè chiunque sia **autenticato**: il menu è visibilità, l'autorizzazione resta quella di `this.Authorize()` sui tipi GraphQL |
| Sqlite nei test | **Si aggiunge**: senza, la guardia della transizione resta scoperta e il verde della CI è fuorviante |

## Approach

### A1 — Entità riga d'ordine separata da `Vendita`

Il vincolo che decide il modello è uno solo, ed è nel codice: `BreakdownIvaApplier.ApplicaAsync`
ricalcola **da capo dalla somma delle `Vendite` persistite** del registro
(`db.Vendite.Where(v => v.RegistroCassaId == registro.Id)`, poi
`registro.VenditeContanti = vendite.Sum(v => v.PrezzoTotale)`). Se le righe d'ordine fossero
`Vendite`, un ordine ancora aperto entrerebbe **subito** nel breakdown IVA e in `VenditeContanti`.

Due strade possibili:

| | **(a)** Stato su `Vendita` + filtro negli applier | **(b)** `Ordine` + `RigaOrdine`, `Vendita` creata alla chiusura |
|---|---|---|
| Costo iniziale | basso: una colonna, una migrazione | medio: due tabelle, una migrazione |
| Invariante | «una `Vendita` conta solo se lo stato è quello giusto» → **disciplina** | «una `Vendita` esiste ⇒ è incassata» → **per costruzione** |
| Punti da non dimenticare | ogni lettura di `Vendite`: `BreakdownIvaApplier`, l'input di `IvaBreakdownCalculator`, la query `vendite(registroCassaId)`, `ScontrinoDelGiorno.tsx`, i rollup della chiusura mensile, i servizi che oggi assumono «vendita = incassata» | nessuno: a valle non cambia niente |
| Modo di fallire | **silenzioso**: un filtro dimenticato gonfia il breakdown e nessun controllo se ne accorge | rumoroso: il tipo non compila |

**Raccomandata la (b).** La (a) trasforma un'invariante in una consuetudine, su almeno cinque punti
di lettura, con esattamente la classe di errore che questo change esiste per togliere: contabile e
senza sintomi. La (b) costa due tabelle e lascia intatto tutto ciò che sta a valle.

Effetto collaterale positivo e non secondario: la chiusura crea le N `Vendite` e invoca
**una volta sola** `BreakdownIvaApplier`. Sparisce da sé il problema annotato in #19 Fase 5
(«quindici consumazioni = trenta round-trip e quindici ricalcoli»), senza dover introdurre la
`creaVendite(input: [...])` che lì si ipotizzava.

### A2 — La garanzia sta sulla transizione, non sul chiamante

Il delta dei secchi non è idempotente, quindi «una volta e una sola» va imposto **dove la
transizione avviene**. In una transazione unica:

1. `UPDATE Ordini SET Stato='CHIUSO' … WHERE Id=@id AND Stato='APERTO'` — se le righe toccate sono
   **0**, l'ordine era già chiuso: si esce con un errore parlante **senza aver mosso niente**. In
   alternativa `RowVersion` con concorrenza ottimistica; l'importante è che la condizione sia nel
   database e non in un `if` letto prima.
2. Creazione delle `Vendita` dalle righe, con lo snapshot IVA di riga come oggi
   (`VenditeMutations.RicalcolaImportiSnapshot`).
3. `SecchiIncassiApplier.ApplicaDelta` **una volta per ordine chiuso**, con il totale e il metodo
   dell'ordine.
4. `BreakdownIvaApplier.ApplicaAsync` **dopo** i secchi. L'ordine di invocazione è già documentato
   e vincolante: il breakdown ricalcola `TotaleVendite` a partire da `IncassiElettronici`, e
   leggerlo prima darebbe un totale vecchio di un ordine.

Questo copre il doppio tocco, il retry di rete, la riapertura della pagina, e i due telefoni dietro
lo stesso bancone — casi che una guardia lato client non copre.

### A3 — Lo split è una chiusura sola

Una sola mutation:

    chiudiOrdine(id: Int!, input: {
      pagamenti: [{ metodo, righeOrdineIds: [Int!]!, contanteRicevuto }]
    })

Con un elemento è la chiusura semplice, con n è lo split. **Una transazione, n ordini chiusi**, il
delta applicato n volte ma su n insiemi **disgiunti** di righe. Mai n chiusure indipendenti
orchestrate dal client: è il modo in cui si finisce con un ordine chiuso a metà e i secchi mossi
in parte. La transizione è «ordine aperto → n ordini chiusi», non n transizioni separate.

Validazioni lato server, **prima** di qualunque scrittura: la partizione delle righe deve essere
**totale e disgiunta** (nessuna riga fuori, nessuna riga in due tagli), almeno un pagamento, metodi
tutti dentro `MetodiPagamentoVendita.Ammessi`.

### A4 — Il resto al cliente non è `Resto`

`RegistroCassa.Resto` esiste già ed è la **colonna AG** del foglio, «Ecc al netto delle spese con
scontrino»: è un dato contabile della quadratura. Il resto dato al cliente non c'entra nulla, non
tocca alcun secchio, ed è un aiuto all'operatore.

Nomi proposti: `Ordine.ContanteRicevuto` persistito (opzionale, solo per i metodi in contanti) e
**`restoDaDare` derivato** (`ContanteRicevuto − Totale`), mai persistito con un nome che possa
confondersi. In UI si scrive «Resto al cliente», mai «Resto» nudo nella stessa pagina in cui compare
la quadratura. Sbagliare qui crea una confusione che poi non si toglie più.

### A5 — Annulla, storna, e la scappatoia tracciata

Due gesti con conseguenze opposte non vanno sullo stesso pulsante:

| | `annullaOrdine` | `stornaOrdine` |
|---|---|---|
| Stato ammesso | solo `APERTO`, mai incassato | solo `CHIUSO`, già incassato |
| Effetto sui secchi | **nessuno** — non ha mai toccato niente | delta **inverso**, una volta sola |
| Guardia | transizione `APERTO → ANNULLATO` | stessa guardia di A2, sulla transizione |
| Rischio | basso: non c'è delta da disfare | alto: il delta non è idempotente |
| Esito | `ANNULLATO` | `STORNATO` |

Entrambi registrano **chi e quando** (`AnnullatoDaUtenteId`, `AnnullatoIl`, `MotivoAnnullamento`).

⚠️ **Perché la traccia non è un di più.** Se annullare un ordine è il modo per sbloccare la chiusura
di cassa, è anche il modo per far sparire un incasso reale: si batte, si serve, si incassa, si
annulla, la cassa chiude pulita. Non è un sospetto su nessuno — è che un controllo con una
scappatoia silenziosa non controlla niente. Un ordine annullato resta consultabile con autore e
momento: costa poco adesso, e aggiungerlo dopo, quando gli ordini annullati sono già spariti, non
recupera lo storico.

### A6 — Il blocco della chiusura di cassa

Un ordine aperto è per definizione un incasso non dichiarato. Nuovo guard in
`GestioneCassaGuards` (`GuardOrdiniAperti`), invocato da `ChiudiRegistroCassaOrchestrator.ExecuteAsync`
accanto ai due esistenti (`GuardMeseChiuso`, `GuardGiornoOperativoConPeriodi`), con messaggio
parlante che dice **quanti** sono. Query di appoggio `ordiniAperti(registroCassaId)` per mostrarli
in pagina con le due uscite raggiungibili da lì.

### A7 — L'identificativo stampabile

`Ordine.Numero`, progressivo **per registro** (indice univoco su `(RegistroCassaId, Numero)`),
assegnato dentro la transazione di creazione. Sullo split, gli ordini figli conservano il numero del
padre con un suffisso (`7/a`, `7/b`): quando la stampa arriverà, la carta già consegnata resterà
rintracciabile. Concorrenza fra due telefoni: `MAX(Numero)+1` dentro la transazione, con
ritentativo sulla violazione dell'indice univoco.

### B — I gruppi

- **`GruppoProdotti`** (codice, nome, colore, ordinamento, attivo) + **`ProdottoGruppo`**, entità di
  appartenenza **esplicita** con chiave composita e payload `Ordinamento`, l'ordine manuale della
  variante dentro quel gruppo. La relazione è **molti-a-molti**: decisione chiusa dall'utente col
  criterio «se non è complicato», e sul codice di questo progetto non lo è — il pattern esiste già in
  `Ruolo` ↔ `Menu` e, con payload, in `RegistroCassaMensile`.
- **Colore sul prodotto** (`Prodotto.Colore`, esadecimale nullable), **non** sull'appartenenza: il
  colore è della bevanda (Aperol arancione, Campari rosso), non del raggruppamento — lo stesso
  articolo presente in due gruppi non deve avere due colori. `coloriProdotto.tsx` acquisisce un
  ramo: se `colore` è valorizzato vince, altrimenti resta la generazione da categoria, che serve
  alle ~147 voci della griglia. Servono **entrambi** i meccanismi, come dice la issue: il generato
  per la griglia, l'esplicito per i tastoni dentro un gruppo.
- **Prezzo sul tastone di gruppo: «da X €» derivato** dal minimo dei membri, non un campo
  memorizzato — le varianti costano diverso (2,50 → 4,50) e un prezzo scritto una volta invecchia
  in silenzio al primo ritocco di listino.
- **Spacchettamento del listino**: nuovo seeder additivo, stessa convenzione codici `CAT-NOME`
  di #19 D2, IVA 10% come tutto il listino, **OFF per default** con interruttore proprio e
  `dryrun`. Crea le ~25 varianti nuove e **disattiva le 14 accorpate se presenti**.

⚠️ **È il primo seeder di prodotti che scrive su righe esistenti.** `SeedProdottiListino` è
esplicitamente idempotente e **non distruttivo** — salta i codici presenti e non riscrive mai una
riga, così un prezzo corretto a mano dalla pagina Prodotti sopravvive al riavvio. Questo non può
esserlo, perché deve spegnere delle righe. La differenza va scritta nel file, non lasciata dedurre.

⚠️ **Deve reggere due mondi.** In sviluppo le 14 accorpate esistono e vanno disattivate; **in
produzione `Prodotti` è vuota e `SEED_LISTINO_2026` è OFF**, quindi non c'è niente da disattivare e
il seeder deve non fare rumore. Le due situazioni vanno entrambe testate.

### C — La voce in sidebar

`SeedMenusVendita.cs`: `MenuPadre = null`, `Posizione = 0`. I primi livelli oggi sono Dashboard 1,
Cassa 2, Fornitori 3, Utenti 4, Ruoli 5, Menù 6, Impostazioni 7, Wiki 8, e
`duedgusto/src/common/ui/createDataTree.tsx` ordina per `posizione` crescente: lo **0** la mette in
cima **senza rinumerare nulla**. Cade anche il primo early-return del seeder, che oggi rinuncia se
«Cassa» non esiste — un padre che non serve più.

> 🔴 **Trappola concreta, e silenziosa.** `SeedMenus.UpdateMenuIfNeeded` (riga 20) fa
> `if (menu.MenuPadreId != menuPadre?.Id) { menu.MenuPadre = menuPadre; needsUpdate = true; }`.
>
> Con `menuPadre = null` e la navigazione **mai `Include`-ata** — la query di `SeedMenusVendita`
> carica solo `.Include(m => m.Ruoli)` — `menu.MenuPadre` è **già `null` in memoria**:
> l'assegnazione è un no-op, EF non rileva alcun cambio di FK, e il successivo
> `dbContext.Menus.Update(venditaMenu)` marca l'entità come modificata riscrivendo `MenuPadreId`
> **col vecchio valore**. Il seed segnalerebbe `needsUpdate = true`, il riavvio andrebbe a buon
> fine, e la voce resterebbe sotto Cassa.
>
> Correzione: assegnare esplicitamente `menu.MenuPadreId = menuPadre?.Id`. Per i padri **non nulli**
> il codice attuale funziona (assegnare una navigazione non nulla innesca il fixup): il difetto si
> manifesta **soltanto** nel caso che serve a noi, ed è il motivo per cui non è mai emerso.

### Moduli coinvolti e migrazioni

**Moduli: backend + frontend** (entrambi, in tutte e tre le parti A, B, C).

**Migrazioni DB: sì — 2 migrazioni, entrambe additive e DDL pura** (una per fase, come in
`design.md`): `AddOrdiniPuntoVendita` per A e `AddGruppiProdotti` per B.

- Nuove tabelle: `Ordini`, `RigheOrdine` (migrazione A); `GruppiProdotti`, `ProdottiGruppi`
  (appartenenza gruppo↔prodotto, migrazione B).
- Nuove colonne: `Vendite.OrdineId` (nullable, migrazione A); `Prodotti.Colore` (`varchar(20)`,
  **nullable**, migrazione B).
- **Nessuna colonna esistente viene rimossa o ristretta**, nessun backfill necessario: in
  produzione `Vendite` è vuota e non esiste alcun ordine pregresso da convertire.
- Indice univoco su `(RegistroCassaId, Numero)` in `Ordini`.
- ⚠️ `DeleteBehavior.Restrict` su prodotto→riga d'ordine, coerente con quello già in essere su
  prodotto→vendita: una variante usata in un ordine non deve poter sparire.

## Affected Areas

| Area | Impact | Descrizione |
|------|--------|-------------|
| `backend/Models/Ordine.cs` | New | Stato, numero stampabile, metodo, `ContanteRicevuto`, tracce di annullamento/storno |
| `backend/Models/RigaOrdine.cs` | New | Riga d'ordine: prodotto, quantità, prezzo unitario, note |
| `backend/Models/GruppoProdotti.cs` + `ProdottoGruppo.cs` | New | Raggruppamento libero **molti-a-molti** (decisione chiusa) con join esplicita: chiave composita `{GruppoProdottiId, ProdottoId}` e payload `Ordinamento` manuale. Stampo: `RegistroCassaMensile` |
| `backend/Models/Prodotto.cs` | Modified | `Colore` esplicito, nullable. ⚠️ **non** deve entrare in `ProdottoInput` senza estendere `UpsertProdottoAsync`, che assegna ogni campo esplicitamente |
| `backend/DataAccess/AppDbContext.cs` | Modified | DbSet nuovi, indice univoco `(RegistroCassaId, Numero)`, `DeleteBehavior.Restrict` |
| `backend/Migrations/*` | New | Migrazione additiva: 4 tabelle + 1 colonna nullable |
| `backend/GraphQL/Ordini/` | New | `creaOrdine`, `aggiungiRiga`, `rimuoviRiga`, `chiudiOrdine` (con split), `annullaOrdine`, `stornaOrdine`; query `ordini` / `ordiniAperti` |
| `backend/GraphQL/GraphQLMutations.cs`, `GraphQLQueries.cs` | Modified | Ramo `ordini`. ⚠️ Un modulo **senza `this.Authorize()` è pubblico** per default: la regola va messa a livello di tipo, come in `VenditeMutations` |
| `backend/GraphQL/GestioneCassa/SecchiIncassiApplier.cs` | Unchanged | Invocato dalla chiusura ordine invece che da `creaVendita`. Il commento sul delta non idempotente resta e va richiamato dal nuovo chiamante |
| `backend/GraphQL/GestioneCassa/BreakdownIvaApplier.cs` | Unchanged | Continua a ricalcolare da Σ `Vendite`: con A1 non serve alcun filtro nuovo — è il punto della scelta |
| `backend/GraphQL/GestioneCassa/GestioneCassaGuards.cs` | Modified | `GuardOrdiniAperti` |
| `backend/GraphQL/GestioneCassa/ChiudiRegistroCassaOrchestrator.cs` | Modified | Invoca il guard nuovo accanto ai due esistenti |
| `backend/GraphQL/Vendite/VenditeMutations.cs` | Modified | **`creaVendita` rimossa** dallo schema (decisione chiusa in `design.md`); `aggiornaVendita` / `eliminaVendita` restano ma rifiutano ogni `Vendita` con `OrdineId != null`; + mutation di ordine e di gruppo. Il tipo ha già `this.Authorize()` e copre i campi nuovi |
| `backend/SeedData/SeedMenus.cs` | Modified | `UpdateMenuIfNeeded`: assegnazione esplicita di `MenuPadreId` (padre nullo) |
| `backend/SeedData/SeedMenusVendita.cs` | Modified | Primo livello, `Posizione = 0`, via il vincolo sul padre «Cassa» |
| `backend/SeedData/` (nuovo seeder varianti) | New | ~25 varianti nuove, disattivazione delle 14 accorpate, OFF per default con dry-run |
| `duedgusto/src/components/pages/vendite/PuntoVendita.tsx` | Modified | Da «due tocchi per consumazione» ad «accumulo → chiudi»; barra ordine fissa in basso |
| `duedgusto/src/components/pages/vendite/SceltaMetodoPagamento.tsx` | Modified | Si sposta a fine ordine; acquisisce split e contante ricevuto/resto |
| `duedgusto/src/components/pages/vendite/coloriProdotto.tsx` | Modified | Il colore esplicito vince su quello generato |
| `duedgusto/src/components/pages/vendite/` (nuovi) | New | Griglia varianti di gruppo, elenco ordini aperti, pannello resto al cliente |
| `duedgusto/src/components/pages/prodotti/` (nuova pagina gruppi) | New | Gestione gruppi e appartenenze |
| `duedgusto/src/graphql/ordini/` | New | Fragment, query e mutation degli ordini |
| Scheda registro / chiusura cassa (frontend) | Modified | Blocco con elenco ordini aperti e le due uscite |

## Risks

| Rischio | Probabilità | Mitigazione |
|---------|-------------|-------------|
| Doppia applicazione del delta alla chiusura (retry di rete, doppio tocco, due telefoni) | Media | Guardia sulla **transizione di stato in SQL** (`WHERE Stato='APERTO'` + verifica righe toccate) dentro la transazione, non sul chiamante. Test dedicato sulla doppia chiusura |
| Split non atomico → ordine chiuso a metà, secchi mossi in parte | Media | Una sola mutation `chiudiOrdine` con i tagli in ingresso, una sola transazione. Il client non orchestra mai n chiusure |
| Partizione delle righe incompleta o sovrapposta nello split | Media | Validazione server: unione = tutte le righe, intersezioni vuote, prima di qualunque scrittura. Errore parlante |
| `creaVendita` resta una **seconda porta** verso gli stessi secchi accanto all'ordine | Alta | Da chiudere in design: restringerla, o documentarla come uso amministrativo. Due flussi che scrivono negli stessi secchi con regole diverse ricreano esattamente il difetto che questo change toglie |
| Confusione fra `Resto` (colonna AG) e resto al cliente | Alta | Nomi diversi in modello, GraphQL e UI dal primo commit; il resto al cliente è derivato e non tocca la quadratura. `RiepilogoCards.tsx` resta il riferimento normativo |
| L'annullamento usato per far sparire un incasso | Media | Stato `ANNULLATO` con autore e momento, mai cancellazione fisica; ordini annullati consultabili e verificabili a fine mese |
| La spec `openspec/specs/gestione-cassa/specs.md:1204` diverge già dal codice su `TotaleVendite` (#19) | Media | Riallineare **prima** di scriverci sopra: costruire spec nuove su una base sbagliata la propaga |
| Il seeder varianti scrive su righe esistenti — primo del suo genere | Media | Interruttore proprio, `dryrun`, idempotenza verificata, comportamento definito **anche col database vuoto** (produzione) |
| Il passaggio a primo livello di «Vendita» non avviene, in silenzio (trappola EF) | Alta | `menu.MenuPadreId = menuPadre?.Id` esplicito + verifica **sul database** dopo il riavvio, non sul solo `needsUpdate` |
| Ruoli: la voce viene aperta a tutti e qualcuno legge l'allargamento come un allargamento di **permessi** | Media | ✅ Deciso: la voce va a **tutti i ruoli**. Il menu è **sola visibilità**: `VenditeQueries` / `VenditeMutations` hanno `this.Authorize()` a livello di tipo e continuano a esigere un utente autenticato. Scenario di spec dedicato («Visibile non vuol dire aperto»). ⚠️ `AssegnaRuoli` non toglie mai un ruolo: restringere dopo richiede SQL sul VPS |
| Prestazioni: la chiusura crea N vendite e ricalcola il breakdown | Bassa | Una sola invocazione dell'applier per ordine, contro una per riga di oggi: il cambio **migliora** il profilo attuale |
| `Prodotto.Colore` finisce per sbaglio in `ProdottoInput` senza essere assegnato in `UpsertProdottoAsync` | Media | `UpsertProdottoAsync` assegna ogni campo esplicitamente: un campo aggiunto all'input e non assegnato lo azzererebbe in massa. Stesso confine già pinnato per i campi di vetrina da `ConfineVetrinaCassaTests` |

## Rollback Plan

Il change è **additivo** a livello di schema: nuove tabelle e una colonna nullable. Nulla di
esistente viene rimosso o ristretto, e nessun dato pregresso viene riscritto.

1. **Prima del rollback: chiudere o annullare tutti gli ordini `APERTO`.** Un ordine aperto è un
   incasso non ancora dichiarato: revertire lasciandone in giro perde l'informazione. Le `Vendite`
   già create dalle chiusure sono `Vendite` normali, restano corrette e **non vanno toccate**.
2. **Codice**: revert dei commit backend + frontend nello stesso PR (fragment, tipi e seeder
   inclusi).
3. **Database**: `dotnet ef database update <migrazione-precedente>` elimina le quattro tabelle
   nuove e la colonna `Prodotti.Colore`. `Vendite`, `RegistriCassa` e i tre secchi non sono
   coinvolti dalla migrazione: nessuna perdita per lo storico né per la quadratura.
4. **Frontend**: `PuntoVendita.tsx` torna al flusso a due tocchi, che continua a funzionare perché
   `creaVendita` non viene rimossa dall'API.
5. **Voce di menu**: torna sotto Cassa dal seed. Qui il padre è **non nullo**, quindi il percorso
   funziona senza la correzione — che va comunque mantenuta, perché è una correzione di un difetto
   reale a prescindere da questo change.
6. **Prodotti creati dal seeder varianti**: ⚠️ **non si cancellano** — `eliminaProdotto` non esiste.
   Si disattivano, e si riattivano le 14 accorpate. È irreversibile solo nel senso che le righe
   restano in anagrafica; è un motivo in più per tenere quel seeder **OFF per default** e passare
   sempre da `dryrun` prima.

## Dependencies

- **Una dipendenza nuova, lato test**: `Microsoft.EntityFrameworkCore.Sqlite` in
  `backend/DuedGusto.Tests`. Decisione dell'utente, chiusa. Serve perché InMemory non applica né i
  token di concorrenza né gli indici unici e rende `BeginTransactionAsync` un no-op: senza Sqlite la
  guardia della transizione — il pezzo più critico del change — resterebbe scoperta, con la CI verde.
  Nessuna dipendenza nuova di **runtime** (né NuGet né npm).
- **B dipende da A**: i gruppi servono a riempire un ordine.
- **Il solo *contenuto* del listino dipende da una decisione ancora aperta**: come si spaccano le 14
  voci accorpate, con quali nomi e codici. Va chiusa prima di scrivere il **seeder**, non prima di
  costruire il meccanismo dei gruppi: schema, migrazione, pagina di gestione e tastoni non la
  aspettano.
- **Riallineamento della spec `gestione-cassa`** su `TotaleVendite` (eredità aperta di #19 Fase 0):
  la formula in spec diverge da quella del codice.
- **#19** resta la base: anagrafica di cassa (Fase 1), listino 2026 (Fase 2), metodo di pagamento
  sulla vendita e alimentazione per delta (Fase 4), griglia mobile first (Fase 5) sono tutte
  presupposti già in essere.
- Il caricamento in **produzione** del listino ampliato resta una decisione separata, come
  `SEED_LISTINO_2026`.

## Decisioni aperte — chiuse dall'utente

Le cinque domande di questa sezione sono state poste all'utente e **quattro sono state chiuse**. Le
prime tre erano quelle che la issue #24 elencava come «da decidere sul modello dei gruppi»; le ultime
due erano emerse dal codice. Resta aperta **una sola cosa**, ed è un dato, non una scelta di modello.

1. ✅ **Un prodotto può stare in più gruppi, o in uno solo?** → **Più gruppi (molti-a-molti).**
   L'utente ha posto il criterio «più gruppi *se non è complicato*, altrimenti uno solo», e sul codice
   di questo progetto **non è complicato**: il molti-a-molti con entità di join esplicita ha già due
   precedenti in casa (`Ruolo` ↔ `Menu` in `AppDbContext.cs:104-118`; e, più vicino perché con
   payload, `RegistroCassaMensile` con chiave composita e campo `Incluso`), la pagina di gestione
   ricalca `roles/RoleDetails.tsx` + `RoleMenus.tsx`, e il seed sa già popolare una relazione del
   genere (`SeedMenus.AssegnaRuoli`). L'unico costo reale — «prodotti non raggruppati» diventa
   `!p.Gruppi.Any()` invece di `p.GruppoId == null` — è un'anti-join su ~147 righe già in cache.
   Il costo dell'errore è invece asimmetrico: da 1:N a N:N si passa solo con una migrazione **con dati
   dentro**, mentre un N:N usato con un gruppo per prodotto si comporta come un 1:N.
   Dettaglio in `tasks.md` §0.3 e in `design.md` §«gruppi molti-a-molti con entità di join esplicita».
2. ✅ **Il gruppo ha un prezzo indicativo sul tastone?** → **«da X €» derivato** da `Min(prezzo dei
   membri attivi)`, mai persistito. Quando tutti i membri costano uguale si mostra il prezzo nudo,
   senza «da». Chiusa in `design.md`.
3. ✅ **L'ordine dei prodotti dentro il gruppo è manuale o automatico?** → **Manuale**
   (`ProdottoGruppo.Ordinamento`), pareggio su `Prodotto.Codice`. Chiusa in `design.md`.
4. ✅ **Che ne è di `creaVendita` come porta diretta ai secchi?** → **Rimossa dallo schema**, non
   deprecata né ristretta per ruolo: `aggiornaVendita` / `eliminaVendita` restano ma rifiutano ogni
   `Vendita` con `OrdineId != null`, indicando `stornaOrdine`. In produzione `Vendite` è vuota e
   l'unico consumatore è `PuntoVendita.tsx`, quindi è l'ultimo momento in cui l'operazione è gratuita.
   Chiusa in `design.md` §«`creaVendita` viene RIMOSSA dallo schema, non deprecata».
5. ✅ **Ruoli della voce «Vendita»** → **per chiunque**, non più il solo SuperAdmin.
   🔴 Verificato che cosa comporta davvero: il menu governa **la sola visibilità in sidebar**;
   l'autorizzazione delle operazioni è separata e non cambia. `VenditeMutations.cs:26` e
   `VenditeQueries.cs:21` hanno `this.Authorize()` **a livello di tipo** — autenticazione richiesta,
   nessun ruolo specifico. Quindi «per chiunque» significa **chiunque sia autenticato**, e non apre
   alcun accesso anonimo. Sweep di controllo su tutti i moduli GraphQL montati: tutti hanno
   `this.Authorize()`, **nessuna esposizione anonima trovata**.
   ⚠️ Asimmetria da ricordare: `SeedMenus.AssegnaRuoli` solo aggiunge ruoli. Restringere in futuro
   richiederebbe SQL diretto sul VPS.

### L'unica decisione ancora aperta

- ⏳ **Lista esatta delle varianti** (~147 voci: nomi, codici, prezzi). **Rimandata dall'utente**, che
  la produrrà lui. Blocca **solo i dati** del listino (`tasks.md` 10.1 e 10.2): schema, migrazione,
  seeder parametrico, pagina di gestione dei gruppi e tastoni della griglia si costruiscono e si
  testano senza conoscerla.
  ℹ️ Perimetro **allargato** da una decisione già presa: `GRAPPA` e le righe 49-50 del foglio, prima
  fuori scope, **entrano**. `GRAPPA` porta due importi in una cella («€ 3 / 4») e con la regola «ogni
  variante è un articolo a sé» diventa **due articoli**, uno a 3,00 € e uno a 4,00 €. Le righe 49-50
  costano 2,50 € e **non hanno nome**: il nome non si inventa, arriva con questa lista.

## Success Criteria

- [ ] Un ordine aperto con n voci lascia il registro **identico**: `IncassiElettronici`,
      `IncassoContanteTracciato`, `VenditeContanti`, `TotaleVendite` e righe IVA invariati
- [ ] Alla chiusura i secchi si muovono **una volta sola**; una seconda chiusura dello stesso ordine
      fallisce con errore parlante **senza muovere nulla** (test sulla doppia chiusura)
- [ ] Lo split in n metodi produce n ordini chiusi e un movimento complessivo dei secchi pari a
      quello dell'ordine intero
- [ ] Uno split con partizione incompleta o sovrapposta viene rifiutato prima di qualunque scrittura
- [ ] Chiudere il registro con almeno un ordine aperto **fallisce**, con l'elenco visibile in pagina
      e le due uscite raggiungibili da lì
- [ ] Annullare un ordine aperto lascia i secchi intatti, lo porta in `ANNULLATO` e lo lascia
      **consultabile** con autore e momento
- [ ] Stornare un ordine chiuso applica il delta inverso **una volta sola**
- [ ] Il resto al cliente compare in UI, è corretto, e **non** compare in alcun campo del registro
      né si chiama `Resto`
- [ ] `ContanteNetto`, `RestoFornitore`, `Ecc`, `Resto` restano quelli del foglio
      (`RiepilogoCards` come riferimento normativo, test invariati e verdi)
- [ ] Una chiusura in contanti non tracciati lascia la quadratura identica, come oggi
- [ ] La griglia mostra **gruppi + prodotti non raggruppati**; un gruppo apre i tastoni delle
      varianti con i **colori espliciti**
- [ ] La pagina di gestione gruppi crea, rinomina, riordina e popola un gruppo
- [ ] Il listino arriva a ~147 articoli attivi; le 14 accorpate risultano **disattivate e presenti**
      dove esistevano, e il seeder non fa rumore su un database vuoto
- [ ] «Vendita» compare **in cima alla sidebar di primo livello** dopo il riavvio, verificato **sul
      database** e non solo sul log del seed
- [ ] `dotnet build` + `dotnet test` verdi; `npm run ts:check` + `npm run lint` + `npm run test`
      verdi
- [ ] E2E Playwright a viewport **360 e 390 px** sul flusso ordine → chiusura → resto
