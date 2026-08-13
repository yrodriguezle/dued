# Delta per sito-pubblico

**Domain**: sito-pubblico
**Change**: pannello-sito-per-pagine
**Date**: 2026-08-13
**Status**: Draft
**Tipo**: DELTA sulla spec attiva [`openspec/specs/sito-pubblico/specs.md`](../../../../specs/sito-pubblico/specs.md)

## Purpose del delta

Questo change è un lavoro di **amministrazione**: cambia il posto da cui si guardano i contenuti, non
i contenuti. Il sito è il **testimone** che dimostra che non è successo altro.

Il delta contiene due sole cose:

1. l'**invariante di non regressione** — a contenuti invariati il sito si comporta esattamente come
   prima, e la prova è un confronto, non un'impressione;
2. il vincolo su [`rotte.ts`](../../../../../sito/src/lib/rotte.ts): resta la **sorgente unica** delle
   pagine, e il pannello la rispecchia invece di duplicarla.

⚠️ Nella forma minima del change **nessun file di `sito/` viene toccato**. I sorgenti `.astro`
cambiano **soltanto** se il design scioglie il nodo B verso gli slot nominati (variante B2 della
proposal, delta [`media-assets`](../media-assets/spec.md)). L'invariante vale in entrambi i casi, ma
nel primo è anche un confronto `git diff` vuoto.

---

## Dominio: Non regressione del sito

### ADDED Requirements

### Requirement: 🔴 A contenuti invariati, il sito si comporta esattamente come prima

Con i dati del database invariati, dopo il change il sito MUST rendere:

| Cosa | MUST restare |
|---|---|
| Insieme delle pagine raggiungibili | lo stesso |
| Codici di risposta HTTP di ciascuna pagina | gli stessi, incluso il 404 condizionato di `/aperitivo` e `/locale` |
| Voci di navigazione di intestazione e piè di pagina | le stesse |
| Voci della sitemap | le stesse |
| Immagini rese da ciascuna pagina, e la posizione in cui compaiono | le stesse |
| Politica di cache dichiarata per stato | la stessa |

La prova MUST essere una **cattura prima/dopo** confrontabile, e MUST NOT essere una lettura a
occhio: la classe di guasto che questo change rischia — un contenuto azzerato da un salvataggio che
non lo mostrava — si manifesta esattamente come una pagina *quasi* uguale.

⚠️ Il confronto MUST includere le due pagine **condizionate**, in **entrambi** i loro stati: con il
testo presente e con il testo assente. Un confronto fatto solo nello stato pubblicato non
dimostrerebbe nulla sul caso che il change rende raggiungibile da sei posti invece che da uno.

#### Scenario: 🔴 Le cinque pagine rispondono come prima

- GIVEN un database con contenuti reali, catturato prima del change
- WHEN si richiedono le cinque pagine del sito dopo il change, senza modificare alcun contenuto
- THEN ogni pagina risponde con lo stesso codice HTTP di prima
- AND ogni pagina rende le stesse immagini, nelle stesse posizioni

#### Scenario: 🔴 Il 404 condizionato si comporta come prima, in entrambi gli stati

- GIVEN il testo dell'aperitivo valorizzato
- WHEN si richiede `/aperitivo`
- THEN risponde come prima del change
- AND svuotando il testo e richiedendola di nuovo, risponde 404 come prima del change

#### Scenario: Navigazione e sitemap invariate

- GIVEN gli stessi contenuti prima e dopo il change
- WHEN si confrontano le voci di navigazione dell'intestazione, del piè di pagina, della pagina 404 e
  della sitemap
- THEN sono le stesse

#### Scenario: La politica di cache non cambia

- GIVEN il backend in ascolto e poi non in ascolto
- WHEN si richiedono le pagine in entrambi gli stati
- THEN le intestazioni di cache sono quelle dichiarate dalla spec attiva

#### Scenario: ⚠️ Nella forma minima, `sito/` non compare nel diff

- GIVEN il change applicato senza aver adottato gli slot nominati
- WHEN si esegue il confronto delle modifiche su `sito/`
- THEN è vuoto

### Requirement: 🔴 `rotte.ts` resta la sorgente unica delle pagine, e il pannello la rispecchia

L'elenco delle pagine del sito MUST continuare a vivere in **un posto solo**, e il pannello del
gestionale MUST **rispecchiarlo** invece di possederne una seconda copia autonoma.

Una divergenza fra i due elenchi — una pagina del sito senza scheda, una scheda che nomina una pagina
inesistente, un'etichetta diversa — MUST essere rilevata da una verifica automatica.

⚠️ È lo stesso principio che la spec attiva applica già alla navigazione: intestazione, piè di
pagina, 404 e sitemap leggono tutti dallo **stesso** filtro, proprio perché il primo che ne
dimenticasse uno pubblicherebbe in sitemap un URL che risponde 404 — una cosa che non si vede da
nessuna parte per settimane. Un pannello che elenca una pagina che non esiste è la stessa forma di
guasto, vista dall'altro lato.

Il pannello MUST NOT introdurre una sesta pagina, e MUST NOT rimuovere o rinominare alcuna rotta.

#### Scenario: 🔴 Le due liste coincidono

- GIVEN l'elenco delle pagine dichiarato dal sito e l'elenco delle schede dichiarato dal pannello
- WHEN si esegue la verifica automatica
- THEN i due elenchi hanno gli stessi percorsi e le stesse etichette

#### Scenario: 🔴 Verifica per mutazione dell'allineamento

- GIVEN la verifica dell'allineamento verde
- WHEN si rinomina l'etichetta di una pagina in un solo dei due posti
- THEN la verifica fallisce nominando la pagina e le due etichette

#### Scenario: Il filtro di navigazione non viene duplicato

- GIVEN il codice del change applicato
- WHEN si cerca chi decide se una pagina esiste
- THEN esiste ancora un solo filtro nel sito
- AND il pannello calcola lo stato di pubblicazione a partire dallo stesso criterio, non da una
  seconda regola scritta a mano
