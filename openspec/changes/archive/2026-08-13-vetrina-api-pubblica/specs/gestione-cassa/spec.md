# Delta for Gestione Cassa

**Change**: vetrina-api-pubblica
**Date**: 2026-08-11
**Status**: Draft

> **Nota sullo schema GraphQL** — questa delta **non modifica nulla**: dichiara ciò che MUST
> restare invariato e come lo si prova. È l'unica forma in cui il confine cassa/vetrina può
> essere un requisito invece di un'intenzione.
>
> Il change precedente ha separato le scritture; questo separa le **letture** — nasce il primo
> consumatore pubblico del listino, e la tentazione naturale sarebbe riusare la query della cassa
> aggiungendovi un argomento. Non succede: il listino pubblico ha una sorgente propria, e il
> commento che lo dichiara da mesi diventa vero **senza toccare una riga** del ramo `vendite`.
>
> **Comportamento attuale verificato**:
> - [`VenditeQueries.cs:20`](../../../../../backend/GraphQL/Vendite/VenditeQueries.cs) — commento:
>   *"il listino pubblico del sito vetrina NON passa da qui, ma da `/api/public/menu`"*, che
>   finora rimandava a una rotta inesistente.
> - `VenditeQueries.cs:37` — `prodotti` filtra `.Where(p => p.Attivo)`; `prodotto(id)` non filtra;
>   `categorieProdotto` filtra `p.Attivo && p.Categoria != null`.
> - `VenditeMutations.UpsertProdottoAsync` assegna **esplicitamente ogni campo** del proprio
>   input a ogni invocazione: non è una patch selettiva.
> - Le impostazioni operative (`BusinessSettings`) possiedono orari, giorni, fuso, valuta,
>   aliquota IVA e importi del giornale, e sono lette e scritte da cassa e chiusure mensili.

## ADDED Requirements

### Requirement: Il listino pubblico non passa dalle query della cassa

La rotta pubblica del menu MUST leggere i prodotti con una propria lettura, e MUST NOT invocare
le query del ramo `vendite` né la connection di amministrazione della vetrina. Le query della
cassa MUST restare invariate: stessa firma, stessi argomenti, stesso comportamento; in
particolare la query `prodotti` MUST NOT guadagnare alcun argomento, nemmeno opzionale con
default retrocompatibile, e MUST continuare a restituire i soli prodotti attivi.

La differenza fra i due filtri MUST restare reale e osservabile: la query della cassa seleziona i
prodotti **attivi**, la rotta pubblica seleziona i prodotti **pubblicati**, cioè attivi **e**
marcati visibili. Non sono lo stesso insieme, e nessuna delle due MUST essere derivata
dall'altra.

#### Scenario: Il commento sul listino pubblico diventa vero

- GIVEN il codice della change applicata
- WHEN si ispeziona la provenienza dei prodotti restituiti dalla rotta pubblica del menu
- THEN non passa da alcuna query del ramo `vendite`
- AND la rotta a cui il commento rimandava esiste

#### Scenario: La query della cassa non cambia comportamento

- GIVEN un listino con 5 prodotti attivi e 2 disattivati
- WHEN un client autenticato invoca la query `prodotti` del ramo `vendite`
- THEN la risposta contiene i soli 5 prodotti attivi, esattamente come prima della change

#### Scenario: Nessun nuovo argomento sulla query della cassa

- GIVEN lo schema GraphQL della change applicata
- WHEN si ispezionano gli argomenti della query `prodotti` del ramo `vendite`
- THEN sono esattamente quelli precedenti alla change
- AND non esiste alcun argomento relativo alla pubblicazione sul sito

#### Scenario: I due insiemi divergono nel modo atteso

- GIVEN un prodotto attivo e non marcato visibile, e un prodotto attivo e marcato visibile
- WHEN si confrontano il risultato della query della cassa e quello della rotta pubblica
- THEN la query della cassa contiene entrambi
- AND la rotta pubblica contiene solo il secondo

#### Scenario: Le altre query della cassa restano identiche

- GIVEN un prodotto disattivato con una categoria che nessun prodotto attivo possiede
- WHEN un client invoca `prodotto(id)` e `categorieProdotto`
- THEN entrambe rispondono esattamente come prima della change

### Requirement: 🔴 I file di scrittura della cassa restano invariati alla lettera

`VenditeMutations`, `ProdottoInputType` e `VenditeQueries` MUST restare **invariati alla
lettera**: non "equivalenti", non "compatibili" — **senza differenze**. Il criterio di verifica
MUST essere il confronto testuale con lo stato precedente alla change, e MUST risultare vuoto.

`ProdottoInput` MUST NOT guadagnare alcun campo, e il percorso di upsert MUST NOT assegnare,
azzerare o normalizzare alcun campo di vetrina: la ragione resta strutturale e non stilistica,
perché l'upsert assegna esplicitamente ogni campo del proprio input a ogni invocazione.

I test strutturali del confine introdotti dal change precedente MUST continuare a passare
**senza alcuna modifica**: un test del confine che va adattato per far passare una change è un
confine che è stato spostato.

L'estrazione della regola di pubblicazione in un punto condiviso (spec `vetrina-prodotti`) MUST
riguardare i soli file del ramo vetrina, e MUST NOT richiedere alcuna modifica al ramo cassa.

#### Scenario: Confronto testuale vuoto sui file della cassa

- GIVEN il repository dopo la change
- WHEN si confrontano `VenditeMutations`, `ProdottoInputType` e `VenditeQueries` con lo stato
  precedente alla change
- THEN non risulta alcuna differenza

#### Scenario: I test del confine passano senza essere toccati

- GIVEN i test strutturali del confine cassa/vetrina introdotti dal change precedente
- WHEN si esegue la suite dopo la change
- THEN passano
- AND nessuno di essi è stato modificato

#### Scenario: Un salvataggio della cassa non azzera la vetrina

- GIVEN un prodotto pubblicato con tutti i campi di vetrina valorizzati
- WHEN la cassa invoca `mutateProdotto` con un payload di soli campi contabili
- THEN i campi contabili risultano aggiornati
- AND ognuno dei dieci campi di vetrina conserva esattamente il valore precedente
- AND il prodotto continua a comparire nella rotta pubblica del menu

#### Scenario: Nessun conteggio di test preesistenti diminuisce

- GIVEN il conteggio dei test del backend e del frontend prima della change
- WHEN si esegue la suite dopo la change
- THEN nessun test preesistente risulta rimosso o modificato per farlo passare

### Requirement: Le impostazioni operative restano la sorgente unica degli orari

Le impostazioni operative MUST restare invariate: nessuna colonna aggiunta, nessuna modifica alla
loro mutation di aggiornamento, nessun vincolo nuovo. La rotta pubblica dell'identità MUST
leggerle in **sola lettura** e MUST NOT scrivervi.

Le impostazioni della vetrina MUST NOT poter dichiarare orari propri (spec
`impostazioni-vetrina`): è ciò che rende impossibile per costruzione lo stato in cui il sito
dichiara un orario e la cassa un altro.

#### Scenario: Le impostazioni operative non cambiano forma

- GIVEN lo schema del database dopo la change
- WHEN si ispezionano le colonne delle impostazioni operative
- THEN sono esattamente quelle precedenti alla change

#### Scenario: La composizione pubblica è di sola lettura

- GIVEN una richiesta anonima alla rotta pubblica dell'identità
- WHEN la richiesta viene servita
- THEN nessuna scrittura viene effettuata sulle impostazioni operative
- AND la marca temporale di aggiornamento delle impostazioni operative resta invariata

#### Scenario: Un orario modificato in cassa è quello che il sito mostra

- GIVEN un amministratore che modifica l'orario di chiusura dalle impostazioni della cassa
- WHEN si richiede la rotta pubblica dell'identità dopo il tempo di cache
- THEN il nuovo orario è quello esposto
- AND non esiste alcun altro punto del sistema da cui quel valore possa essere modificato per il
  sito
