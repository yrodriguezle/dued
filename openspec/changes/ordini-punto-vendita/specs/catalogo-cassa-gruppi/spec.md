# Delta for Catalogo Cassa — Gruppi di prodotti e varianti

**Change**: ordini-punto-vendita
**Date**: 2026-08-28
**Status**: Draft
**Base spec**: nessuna — dominio nuovo. Confina con `openspec/specs/gestione-cassa/specs.md`
(§ *Mutation mutateProdotto*, § *Aliquota IVA del prodotto*) e con `openspec/specs/vetrina-prodotti/`
**Fonti vincolanti**: issue #24 punto B, issue #19 (convenzione dei codici, confine cassa/vetrina)

Un tasto generico apre una griglia di varianti. I **gruppi** sono un livello sopra i prodotti,
liberi e gestiti dall'utente; le **varianti** sono articoli a sé, con codice e prezzo propri.

Convenzioni trasversali (vincolanti per tutti i requirement):

- Il gruppo è **indipendente** da `Categoria` (che è contabile) e dal prezzo. Non lo si deriva,
  lo si compone.
- La convenzione dei codici resta quella decisa in #19: categoria + nome abbreviato
  (`BIB-COCA-33`, `CAF-ESPRESSO`). Le collisioni si risolvono allungando con le parole del nome,
  mai con un progressivo.
- `eliminaProdotto` NON esiste nell'API e questo change NON lo introduce: un articolo sbagliato
  si disattiva, non si cancella.
- Il confine cassa/vetrina resta intatto: `ProdottoInput` MUST NOT acquisire alcun campo di
  vetrina, e i campi introdotti qui MUST NOT esserne uno.

### Impatti sullo schema GraphQL

- MUST esistere un tipo per il gruppo, con almeno nome, stato di attività, ordinamento e i
  prodotti che contiene, più una mutation di upsert nello stesso stile di `mutateProdotto`
  (assegnazione totale dei campi che le competono).
- La query che alimenta la griglia di vendita (`vendite { prodotti }`, che già filtra
  `p => p.Attivo`) MUST poter restituire l'informazione di appartenenza al gruppo e il colore
  esplicito, senza costringere il client a una seconda query per tessera.
- La connection `prodotti` dell'anagrafica MUST continuare a restituire **anche i non attivi**:
  è l'anagrafica, non il listino operativo, ed è ciò che rende riattivabile un articolo spento.
- Nessuna mutation introdotta qui MUST poter scrivere `VisibileSulSito`, `NomeVetrina`,
  `PrezzoVetrina`, `CategoriaVetrina`, `ImmagineId`, `Allergeni`, `OrdinamentoVetrina`,
  `Novita`, `Consigliato` o `InLavagnaDal`.

---

## ADDED Requirements

### Requirement: I gruppi sono un raggruppamento libero, gestito dall'utente

MUST esistere una **pagina di gestione** dove l'utente crea un gruppo e vi assegna i prodotti che
vuole. Il raggruppamento MUST NOT essere derivato da `Categoria` né dal prezzo: è un livello
indipendente, ed è ciò che scioglie il nodo del taglio trasversale.

L'appartenenza MUST essere esplicita. Disattivare o eliminare un gruppo MUST NOT toccare i
prodotti che contiene.

#### Scenario: Creazione di un gruppo trasversale

- GIVEN un catalogo con prodotti in categorie diverse
- WHEN si crea il gruppo «Spritz» e vi si assegnano articoli di categorie diverse e prezzi da 2,50 a 4,50 €
- THEN il gruppo esiste con quegli articoli
- AND nessuna `Categoria` di prodotto è stata modificata

#### Scenario: Rimozione di un gruppo

- GIVEN un gruppo con nove articoli
- WHEN il gruppo viene eliminato o disattivato
- THEN i nove articoli restano in anagrafica, attivi e vendibili
- AND tornano a comparire come tessere sciolte nella griglia di vendita

#### Scenario: Il gruppo non tocca i campi di vetrina

- GIVEN un prodotto con `VisibileSulSito`, `NomeVetrina` e immagine valorizzati
- WHEN lo si assegna a un gruppo o gliene si cambia il colore
- THEN nessun campo di vetrina è cambiato
- AND il test strutturale del confine cassa/vetrina (`ConfineVetrinaCassaTests`) resta verde

---

### Requirement: Un prodotto può appartenere a più gruppi

*Chiude **D-B1**, **D-B2** e **D-B3**. Decisione dell'utente sul primo punto («più gruppi se non è
complicato»), verificata sul codice; gli altri due erano già chiusi in `design.md`.*

L'appartenenza prodotto↔gruppo MUST essere **molti-a-molti**, con un'entità di join esplicita che
porta l'ordinamento del prodotto **dentro quel gruppo**. Lo stesso prodotto MUST poter comparire in
più gruppi contemporaneamente, e MUST avere lo **stesso colore** in tutti: il colore è una proprietà
del prodotto, MUST NOT stare sulla riga di appartenenza.

Il tastone del gruppo MUST mostrare un prezzo **derivato** dal minimo dei prezzi dei membri attivi
(«da X €»), calcolato a ogni lettura e MUST NOT essere persistito. Quando tutti i membri hanno lo
stesso prezzo, il tastone MUST mostrare il prezzo nudo, senza «da».

L'ordine dei prodotti dentro il gruppo MUST essere **manuale**, con pareggio deterministico su
`Prodotto.Codice`. MUST NOT essere derivato dal prezzo né dal nome: la mano impara la posizione, e un
ordinamento che si rimescola a ogni ritocco di listino rallenta un gesto pensato per essere cieco.

#### Scenario: Lo stesso articolo in due gruppi

- GIVEN l'articolo «Spritz Aperol» assegnato al gruppo «Spritz»
- WHEN lo si assegna anche al gruppo «Aperitivi»
- THEN l'articolo compare fra le varianti di entrambi i gruppi
- AND l'assegnazione al primo gruppo è rimasta
- AND il colore mostrato è lo stesso in entrambi

#### Scenario: L'ordinamento è per gruppo, non per prodotto

- GIVEN un articolo presente in due gruppi
- WHEN lo si sposta in cima al primo gruppo
- THEN la sua posizione nel secondo gruppo è invariata

#### Scenario: Il prezzo del tastone segue il listino

- GIVEN un gruppo i cui membri attivi costano 2,50, 3,00 e 4,50 €
- WHEN il tastone del gruppo viene reso
- THEN mostra «da 2,50 €»
- WHEN il membro da 2,50 € viene disattivato
- THEN il tastone mostra «da 3,00 €» senza che nulla sia stato riscritto a database

#### Scenario: Prezzo unico, nessun «da»

- GIVEN un gruppo i cui membri attivi costano tutti 3,00 €
- WHEN il tastone del gruppo viene reso
- THEN mostra «3,00 €» e non «da 3,00 €»

---

### Requirement: La griglia di vendita mostra i gruppi al posto delle varianti

Al primo livello la griglia MUST mostrare i **gruppi** più i prodotti **non raggruppati**. Un
prodotto che appartiene a un gruppo MUST NOT comparire anche come tessera sciolta al primo
livello.

Toccare un gruppo apre una griglia di tastoni con le sue varianti; toccarne una aggiunge la voce
all'ordine aperto. La griglia delle varianti MUST essere una griglia di pulsanti e MUST NOT usare
AG Grid.

La ricerca per nome o codice MUST trovare anche i prodotti che stanno dentro un gruppo:
altrimenti raggruppare li fa sparire.

#### Scenario: Il primo livello non peggiora al crescere del listino

- GIVEN 147 articoli attivi, di cui 120 distribuiti in 12 gruppi
- WHEN si apre il punto vendita senza filtri
- THEN il primo livello mostra 12 tessere di gruppo e 27 tessere di prodotto
- AND nessuna delle 120 varianti compare al primo livello

#### Scenario: Due tocchi per una variante

- GIVEN un ordine `APERTO` e il gruppo «Spritz» con quattro varianti
- WHEN si tocca il gruppo e poi «Aperol»
- THEN l'ordine contiene una voce «Spritz Aperol» al suo prezzo
- AND non è stato chiesto alcun metodo di pagamento

#### Scenario: La ricerca attraversa i gruppi

- GIVEN «Spritz Cynar» dentro il gruppo «Spritz»
- WHEN si digita «cynar» nella ricerca
- THEN l'articolo compare fra i risultati e si può battere direttamente

---

### Requirement: Ogni variante è un articolo a sé

Le voci accorpate del listino MUST essere spaccate in articoli distinti, ciascuno con `Codice`
proprio secondo la convenzione già decisa e prezzo proprio. «Con prosecco di bottiglia» (+0,50)
MUST essere un articolo per ogni spritz, NON un secondo tocco.

Le vecchie voci accorpate MUST NOT essere cancellate — `eliminaProdotto` non esiste nell'API:
MUST essere **disattivate** e restano in anagrafica. La tabella cresce e non si accorcia mai:
è una conseguenza accettata, non un difetto da aggirare con SQL diretto sul VPS.

Il listino passa da circa 122 a circa 147 articoli attivi, più le 14 voci accorpate spente.

#### Scenario: Spaccatura di una voce accorpata

- GIVEN la voce di listino «Spritz Aperol / Hugo / Cynar»
- WHEN si applica la spaccatura del listino
- THEN esistono tre articoli attivi distinti, con tre codici distinti
- AND la voce accorpata originale esiste ancora con `Attivo == false`
- AND nessuna riga di anagrafica è stata cancellata

#### Scenario: I disattivati non si vendono ma restano in anagrafica

- GIVEN un articolo accorpato disattivato
- WHEN si apre la griglia di vendita e poi la pagina Prodotti
- THEN l'articolo non compare nella griglia di vendita (`vendite { prodotti }` filtra `Attivo`)
- AND compare nella pagina Prodotti (connection `prodotti`), dove può essere riattivato

#### Scenario: Lo storico resta leggibile

- GIVEN una vendita passata che referenzia una voce poi disattivata
- WHEN si consulta lo scontrino di quel giorno
- THEN la riga mostra nome e importo di allora, con lo snapshot IVA immutato

#### Scenario: I nuovi articoli non finiscono online

- GIVEN i nuovi articoli creati dalla spaccatura
- WHEN si consulta il menu pubblico
- THEN nessuno di essi vi compare, perché `VisibileSulSito == false` alla nascita
- AND il numero di gruppi e di voci del menu pubblico è invariato

---

### Requirement: Il colore esplicito di variante vince sul colore generato

MUST esistere un **colore esplicito** valorizzabile sulla variante (sul prodotto o sulla sua
appartenenza al gruppo). Quando è valorizzato, MUST vincere sul colore generato da
`coloriProdotto.tsx`. Quando è assente o non valido, il colore generato MUST valere immutato.

I due meccanismi convivono e servono a cose diverse: il **generato** per le circa 147 tessere
della griglia, dove la tinta dice la categoria e la banda separa i vicini; l'**esplicito** per i
tastoni dentro un gruppo, dove il colore è quello della bevanda ed è editoriale, uno per uno.

#### Scenario: I colori della bevanda

- GIVEN il gruppo «Spritz» con Liscio bianco, Aperol arancione, Campari rosso, Cynar viola come colori espliciti
- WHEN si apre il gruppo
- THEN ogni tastone usa il proprio colore esplicito
- AND non usa la variazione di luminosità generata dalla categoria

#### Scenario: Nessun colore esplicito — comportamento invariato

- GIVEN un prodotto senza colore esplicito
- WHEN se ne calcola il colore
- THEN il risultato è identico a quello odierno di `coloreProdotto(categoria, indice, modo)`
- AND i test esistenti di `coloriProdotto` restano verdi

#### Scenario: Colore esplicito non valido

- GIVEN un prodotto con colore esplicito vuoto o non interpretabile
- WHEN se ne calcola il colore
- THEN si ricade sul colore generato, senza errore e senza tessera priva di colore

#### Scenario: Il colore esplicito non sposta gli altri

- GIVEN una categoria con trenta articoli, uno dei quali riceve un colore esplicito
- WHEN si ricarica la griglia
- THEN il colore generato degli altri ventinove è invariato
- AND l'indice per categoria resta calcolato sul listino **intero**, non sulla lista filtrata a schermo

#### Scenario: Leggibilità nei due temi

- GIVEN un colore esplicito chiaro come il bianco dello spritz liscio
- WHEN il tastone viene reso in tema chiaro e in tema scuro
- THEN il testo resta leggibile in entrambi

---

## Decisioni di questo dominio — esito

| # | Domanda | Esito |
|---|---|---|
| **D-B1** | Un prodotto può stare in **più gruppi** o in uno solo? | ✅ **Più gruppi, molti-a-molti.** Criterio dell'utente «se non è complicato»; verificato sul codice che non lo è (precedenti `Ruolo`↔`Menu` e `RegistroCassaMensile`, UI `RoleMenus.tsx`). Pinnato dal requirement «Un prodotto può appartenere a più gruppi» |
| **D-B2** | Il tastone del gruppo mostra un **prezzo indicativo**, «da 2,50 €», o nessun prezzo? | ✅ **«da X €» derivato** da `Min(prezzo dei membri attivi)`, mai persistito; prezzo nudo se i membri costano uguale |
| **D-B3** | L'ordine dei prodotti **dentro** il gruppo è manuale o per prezzo/nome? | ✅ **Manuale**, pareggio su `Prodotto.Codice` |
| **D-B4** | Con quali **nomi e codici** si spaccano le 14 voci accorpate del listino 2026 | ⏳ **Ancora aperta.** Rimandata dall'utente, che produrrà la lista |

🔴 **D-B4 blocca i dati, non il meccanismo.** Tutti i requirement di questo file sono verificabili con
gruppi e prodotti costruiti dal test: l'unica cosa ferma è il **contenuto** del seeder di listino.

## Fuori scope, dichiarato

- La pubblicazione dei nuovi articoli sul **sito** (#19 Fase 3): resta un secondo passaggio, da
  `sito/VetrinaProdottiList.tsx`.
- La cancellazione fisica delle 14 voci accorpate: richiede SQL diretto sul VPS e non è parte di
  questo change.

## Rientrato in scope

- ✅ `GRAPPA` e le **righe 49-50** del foglio, prima dichiarate fuori scope, **entrano nel listino di
  questo change** per decisione dell'utente.
  - `GRAPPA` porta due importi in una cella («€ 3 / 4»): per la regola «ogni variante è un articolo a
    sé» MUST diventare **due articoli distinti**, uno a 3,00 € e uno a 4,00 €, con codici distinti.
    Nessun formato «prezzo doppio» MUST essere introdotto nel modello.
  - Le righe 49-50 costano 2,50 € e **non hanno nome**. Il nome MUST arrivare con la lista di **D-B4**
    e MUST NOT essere inventato in fase di implementazione: finché manca, quelle due righe non sono
    seminabili.

#### Scenario: `GRAPPA` si spacca in due articoli

- GIVEN la riga di listino `GRAPPA` con la cella prezzo «€ 3 / 4»
- WHEN si applica la spaccatura del listino
- THEN esistono due articoli attivi distinti, uno a 3,00 € e uno a 4,00 €, con due codici distinti
- AND nessun articolo porta due prezzi
