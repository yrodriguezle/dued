# Delta per api-pubblica

**Domain**: api-pubblica
**Change**: pannello-sito-per-pagine
**Date**: 2026-08-13
**Status**: Draft
**Tipo**: DELTA sulla spec attiva [`openspec/specs/api-pubblica/specs.md`](../../../../specs/api-pubblica/specs.md)

## Purpose del delta

`GET /api/public/galleria` **cambia forma**. Il cambio è additivo — nessun campo esistente sparisce,
si rinomina o cambia tipo — ma è **sul contratto**, e il contratto è pinnato da questa spec: la
sezione «Superficie REST introdotta» dichiara la risposta come `{ "immagini": [ … ] }`, e da questo
change ha un secondo campo di primo livello.

Il motivo è il nodo B della [proposal](../../proposal.md): fino a qui le quattro pagine del sito
indicizzavano `immagini` ciascuna con i propri offset — `galleria[0]`, `slice(0,3)`,
`galleria[1] ?? galleria[0]`, `slice(2,5)`, `at(-1)` — cioè la **stessa regola scritta quattro
volte in quattro file**, in nessun posto interrogabile. Il campo nuovo porta la regola **dentro il
contratto**: il consumatore legge un nome invece di calcolare un indice.

⚠️ **Perché questo delta esiste anche se il cambio è additivo.** Un campo aggiunto senza dirlo
lascia la spec attiva a descrivere una risposta che il backend non produce più, e la spec attiva è
il posto in cui si va a leggere *cosa promette la rotta* quando la si consuma da fuori. Il fatto che
nessun consumatore si rompa non rende la dichiarazione facoltativa.

⚠️ **Da fare all'archiviazione**: il blocco della sezione «Superficie REST introdotta» della spec
attiva va aggiornato — `GET /api/public/galleria` non è più `{ "immagini": [ … ] }` ma
`{ "immagini": [ … ], "ruoli": { … } }`. È l'unico punto della spec attiva che diventa **falso**
senza questo delta.

**Fuori scope in questo delta**: come il sito consuma il campo — sta nel delta
[`consumo-api-pubblica`](../consumo-api-pubblica/spec.md); la regola che assegna i ruoli e il suo
comportamento a slot vuoti — sta nel delta [`media-assets`](../media-assets/spec.md); il fatto che
il sito renda le stesse immagini di prima — sta nel delta
[`sito-pubblico`](../sito-pubblico/spec.md).

---

## Dominio: `GET /api/public/galleria`

### ADDED Requirements

### Requirement: 🔴 La galleria espone i ruoli già risolti, accanto all'elenco che resta

La risposta MUST portare, oltre all'elenco delle immagini, un oggetto che dichiara **quale immagine
ricopre quale ruolo su quale pagina**, già risolto dal server.

`immagini` MUST restare, con lo stesso contenuto, lo stesso ordine e lo stesso tipo di elemento: i
quattro scenari della spec attiva che lo pinnano MUST continuare a valere **senza modifiche**. Il
campo nuovo è additivo per definizione, e un consumatore che ignora i ruoli MUST vedere una risposta
indistinguibile da quella di prima del change.

I ruoli MUST essere esposti come **immagini complete**, nella forma unica di tutta la superficie
pubblica, e MUST NOT essere espressi come indici dentro `immagini`: gli indici sono precisamente ciò
che questo change esiste per abolire, ed esporli sposterebbe la regola dal server al consumatore
lasciandola scritta in due posti.

L'oggetto dei ruoli MUST essere **sempre presente**, anche a galleria vuota, e MUST NOT essere
`null`: non deve essere un campo da controllare prima di leggerlo.

| Ruolo | Forma | A galleria insufficiente |
|---|---|---|
| eroe della home | immagine singola, **nullable** | `null` |
| griglia della home | lista, **mai `null`** | meno di tre elementi, o zero |
| foto del menu | lista, **mai `null`** | meno di tre elementi, o zero |
| ritratto del locale | immagine singola, **nullable** | `null` |
| quadrate del locale | lista, **mai `null`** | meno di tre elementi, o zero |
| eroe dell'aperitivo | immagine singola, **nullable** | `null` **anche a galleria piena** — non ha ripiego posizionale |

⚠️ Le immagini dei ruoli sono le **stesse** che compaiono in `immagini`, ripetute. La duplicazione
nel payload costa qualche centinaio di byte su una risposta cacheata cinque minuti e risparmia al
consumatore una ricerca per chiave dentro ogni pagina — cioè logica, proprio dove la si sta
togliendo.

#### Scenario: 🔴 L'elenco delle immagini è invariato

- GIVEN una galleria con gli stessi media prima e dopo il change
- WHEN un client anonimo richiede `/api/public/galleria`
- THEN il campo delle immagini contiene le stesse chiavi, nello stesso ordine, di prima del change
- AND ogni elemento ha lo stesso insieme di campi di prima

#### Scenario: I ruoli usano la forma unica dell'immagine

- GIVEN una galleria con almeno un media pubblicato
- WHEN si confronta un'immagine dell'elenco con la stessa immagine vista come ruolo
- THEN hanno lo stesso insieme di campi
- AND non esiste un secondo tipo di immagine nella superficie pubblica

#### Scenario: I ruoli ci sono anche a galleria vuota

- GIVEN nessun media nella cartella della galleria
- WHEN un client anonimo richiede `/api/public/galleria`
- THEN la risposta è `200`
- AND l'oggetto dei ruoli è presente
- AND i ruoli singoli valgono `null` e le tre griglie sono liste vuote

#### Scenario: Le griglie non sono mai nulle

- GIVEN una galleria con una sola immagine pubblicata
- WHEN un client anonimo richiede `/api/public/galleria`
- THEN le tre griglie sono liste, non `null`
- AND possono avere meno di tre elementi

#### Scenario: 🔴 L'eroe dell'aperitivo è nullo finché nessuno lo sceglie

- GIVEN una galleria piena e nessuna scelta esplicita per l'eroe dell'aperitivo
- WHEN un client anonimo richiede `/api/public/galleria`
- THEN quel ruolo vale `null`
- AND nessuna immagine gli viene attribuita per posizione

#### Scenario: Un consumatore che ignora i ruoli non si accorge del change

- GIVEN un consumatore che legge soltanto l'elenco delle immagini
- WHEN richiede la rotta dopo il change
- THEN ottiene lo stesso risultato di prima
- AND nessun campo che leggeva è sparito o ha cambiato tipo

### Requirement: 🔴 L'origine del ruolo non appartiene alla superficie pubblica

La risposta MUST NOT dichiarare **come** un ruolo è stato risolto — scelta esplicita
dell'amministratore oppure ripiego sulla posizione nella galleria.

Quel dato esiste e serve, ma serve al **pannello di amministrazione**, per poter dire *«scelta da
te»* invece di *«è la prima della galleria, e cambierà quando ne carichi un'altra»*. Il sito non ha
nulla da farne: renderebbe la stessa immagine in entrambi i casi. Esporlo aggiungerebbe alla
superficie anonima un dato che descrive lo **stato dell'amministrazione**, che è precisamente la
categoria di campi che questa spec tiene fuori.

Il divieto ricorsivo dei nomi vietati della spec attiva MUST attraversare i tipi nuovi **senza
essere modificato**: un tipo annidato nuovo non deve avere bisogno di essere iscritto da qualche
parte per essere sorvegliato.

#### Scenario: Nessun campo di origine nella risposta

- GIVEN il corpo JSON di `/api/public/galleria`
- WHEN se ne enumerano ricorsivamente le chiavi
- THEN nessuna dichiara l'origine del ruolo
- AND nessuna dichiara un indice o una posizione

#### Scenario: 🔴 Il divieto ricorsivo raggiunge il tipo nuovo senza modifiche

- GIVEN la verifica che attraversa i tipi raggiungibili dalla superficie pubblica
- WHEN si aggiunge il tipo dei ruoli
- THEN la verifica lo attraversa senza essere modificata
- AND un campo vietato aggiunto lì dentro la farebbe fallire

### Requirement: La selezione della galleria è una sola, e i ruoli ne discendono

L'insieme dei media su cui i ruoli sono calcolati MUST essere **esattamente** quello restituito in
`immagini`: stessa cartella, stesso filtro di pubblicazione, stesso ordinamento editoriale con lo
stesso criterio di parità.

Due selezioni che differissero anche solo nell'ordinamento darebbero **ruoli diversi a dati
identici**, cioè un elenco e un piano che si contraddicono dentro la stessa risposta. La selezione
MUST quindi vivere in un posto solo, letto da entrambi i consumatori interni.

Un media escluso dall'elenco — non pubblicato, o fuori dalla cartella della galleria — MUST NOT
comparire in alcun ruolo, **nemmeno se qualcuno lo ha scelto esplicitamente**: la scelta decade e il
ruolo ricade sul proprio ripiego, o resta vuoto.

#### Scenario: Ruoli ed elenco pescano dalla stessa selezione

- GIVEN una galleria con più media pubblicati e alcuni non pubblicati
- WHEN un client anonimo richiede `/api/public/galleria`
- THEN ogni immagine che compare in un ruolo compare anche nell'elenco
- AND nessuna immagine assente dall'elenco compare in un ruolo

#### Scenario: Una scelta che punta fuori dalla galleria decade

- GIVEN un ruolo assegnato esplicitamente a un media successivamente spubblicato
- WHEN un client anonimo richiede `/api/public/galleria`
- THEN quel media non compare in alcun ruolo
- AND il ruolo espone il proprio ripiego, o resta vuoto

#### Scenario: L'ordine dei ruoli è stabile fra due richieste identiche

- GIVEN due media della galleria con lo stesso valore di ordinamento
- WHEN si richiede `/api/public/galleria` due volte senza modifiche intermedie
- THEN i ruoli attribuiti sono gli stessi in entrambe le risposte

### Requirement: Il campo nuovo non cambia il costo né la cache della rotta

La rotta MUST continuare a rispondere con la stessa politica di cache dichiarata dalla spec attiva,
MUST continuare a non accettare alcun parametro di query, e MUST continuare ad avere un costo
**fisso e indipendente da qualunque input del chiamante**.

Il calcolo dei ruoli MUST avvenire sui dati già letti per comporre l'elenco, senza una seconda
lettura della galleria.

#### Scenario: La politica di cache è quella di prima

- GIVEN la rotta della galleria dopo il change
- WHEN si ispezionano gli header della risposta
- THEN dichiarano lo stesso tempo di cache pubblico di prima del change

#### Scenario: Nessun parametro nuovo

- GIVEN la rotta della galleria dopo il change
- WHEN se ne ispeziona la firma
- THEN non accetta alcun parametro di query
- AND non esiste un modo per chiedere i ruoli senza le immagini, o viceversa
