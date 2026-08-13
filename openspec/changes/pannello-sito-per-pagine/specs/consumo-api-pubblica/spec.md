# Delta per consumo-api-pubblica

**Domain**: consumo-api-pubblica
**Change**: pannello-sito-per-pagine
**Date**: 2026-08-13
**Status**: Draft
**Tipo**: DELTA sulla spec attiva [`openspec/specs/consumo-api-pubblica/specs.md`](../../../../specs/consumo-api-pubblica/specs.md)

## Purpose del delta

È il lato consumatore del delta [`api-pubblica`](../api-pubblica/spec.md): quella spec dice **cosa il
backend espone**, questa dice **come il sito lo legge**.

Il cambio del contratto è additivo dal lato del backend, ma dal lato del consumatore **non lo è**, e
questa è l'unica cosa che questo delta esiste per dichiarare. La spec attiva impone che ogni lettura
verifichi la forma della risposta prima di restituirla, e la lettura della galleria da qui in avanti
**pretende** il campo dei ruoli. Da ciò discendono due conseguenze che vanno scritte perché non si
scoprano da sole:

1. un backend **più vecchio del sito** produce da questo momento un esito **assente con motivo di
   formato**, cioè la degradazione già documentata, invece di una pagina resa a metà;
2. e quindi esiste un **ordine di messa in linea**: il backend prima del sito. Non è una precauzione
   organizzativa, è la differenza fra una pagina senza fotografie e un errore servito al visitatore.

⚠️ La scelta di **pretendere** il campo invece di tollerarne l'assenza è deliberata ed è la stessa
già presa per il campo dei testi nella lettura della rotta del sito. La ragione è la stessa: le
quattro pagine leggono un ruolo **dentro il frontmatter**, cioè durante il rendering server-side, e
un campo assente lì non produce una sezione mancante — produce un errore in fase di rendering, cioè
un **500 servito al visitatore**. La lettura tollerante avrebbe spostato il guasto dal posto in cui
è visibile e diagnosticabile a quello in cui non lo è.

**Fuori scope in questo delta**: la forma della risposta e ciò che non vi compare — delta
[`api-pubblica`](../api-pubblica/spec.md); il comportamento HTTP delle pagine in degradazione, che
sta nella spec attiva [`sito-pubblico`](../../../../specs/sito-pubblico/specs.md); il fatto che le
pagine rendano le stesse immagini di prima — delta [`sito-pubblico`](../sito-pubblico/spec.md).

---

## Dominio: La lettura delle rotte

### MODIFIED Requirements

### Requirement: 🔴 Il modulo di lettura restituisce un esito e non lancia mai

La forma del requisito attivo resta **integralmente valida**: unione discriminata a due stati,
nessuna eccezione propagata, nessuna promessa che rifiuta, motivi distinti per timeout, rete, HTTP e
formato, un solo valore di timeout, una riga nei log per ogni assenza, nessun secondo tentativo.

Ciò che questo change aggiunge è **quali chiavi la lettura della galleria pretende**: il campo dei
ruoli MUST stare fra le chiavi richieste, accanto all'elenco delle immagini.

⚠️ Pretendere una chiave **restringe** deliberatamente la tolleranza della lettura, e va fatto solo
quando l'alternativa è peggiore. Qui lo è: il campo viene letto nel frontmatter delle pagine, quindi
la sua assenza non degrada una sezione ma interrompe il rendering. Dichiarandolo fra le chiavi
pretese, un backend più vecchio produce l'assenza con motivo **formato** — che è uno stato che il
sito sa rendere, con una riga nei log e una pagina senza fotografie.

Ne discende un **vincolo di ordine**: il backend MUST essere in linea prima del sito. Il vincolo MUST
essere scritto dove lo legge chi fa il deploy, non soltanto nei documenti del change.

#### Scenario: 🔴 Backend più vecchio del sito

- GIVEN un backend che risponde `200` alla rotta della galleria senza il campo dei ruoli
- WHEN il sito ne invoca la lettura
- THEN l'esito dichiara l'assenza con motivo di formato
- AND nessuna eccezione viene propagata al chiamante
- AND l'assenza lascia una riga nei log

#### Scenario: 🔴 Una pagina che consuma i ruoli non serve un errore al visitatore

- GIVEN la lettura della galleria con esito assente
- WHEN si aprono le pagine che consumano i ruoli
- THEN rispondono senza mostrare fotografie della galleria
- AND nessuna risposta è un errore del server

#### Scenario: Galleria vuota e galleria non letta restano due cose diverse

- GIVEN un backend che risponde `200` con un elenco vuoto e i ruoli vuoti
- WHEN il sito ne invoca la lettura
- THEN l'esito è presente, non assente
- AND le pagine non dichiarano alcun problema di lettura

### Requirement: I tipi del sito rispecchiano i DTO, campo per campo

Il requisito attivo resta valido e si estende al campo nuovo: il tipo della galleria MUST guadagnare
i ruoli, e il tipo dei ruoli MUST rispecchiare il DTO **campo per campo**, con le nullabilità che il
backend ha scelto deliberatamente.

Vincoli che il tipo MUST riportare fedelmente:

| Campo | Vincolo | Perché |
|---|---|---|
| ruoli | **mai nullo**, presente anche a galleria vuota | il backend lo compone sempre; renderlo opzionale costringerebbe ogni pagina a un controllo che non serve mai |
| eroe della home, ritratto del locale | immagine **nullable** | a galleria vuota non esiste nulla da mostrare |
| eroe dell'aperitivo | immagine **nullable**, e nulla **anche a galleria piena** | non ha ripiego posizionale: è una decisione di questo change, non un caso limite |
| le tre griglie | liste, **mai nulle**, di lunghezza qualunque | il numero di foto è un fatto della galleria, non una promessa del contratto |
| origine del ruolo | **assente**, perché il DTO non la possiede | dichiararla qui la renderebbe sempre indefinita — è il guasto che il requisito attivo esiste per impedire |

#### Scenario: Il tipo dei ruoli non inventa campi

- GIVEN il modulo dei tipi del sito
- WHEN se ne confrontano i campi dei ruoli con il DTO corrispondente
- THEN ogni campo dichiarato esiste nel DTO
- AND nessuno dichiara l'origine del ruolo

#### Scenario: Le griglie sono liste anche quando sono vuote

- GIVEN una risposta con le griglie vuote
- WHEN una pagina le itera
- THEN non solleva alcun errore
- AND non rende alcuna fotografia

#### Scenario: L'eroe dell'aperitivo nullo non è trattato come un guasto

- GIVEN una risposta con l'eroe dell'aperitivo nullo e la galleria piena
- WHEN si apre quella pagina
- THEN la pagina si renderizza senza immagine di testata
- AND non dichiara alcun problema di lettura

---

## Dominio: La lettura dei ruoli

### ADDED Requirements

### Requirement: 🔴 La forma vuota dei ruoli è un ripiego di lettura, non un ripiego editoriale

Quando la galleria **non si è letta**, il consumatore MUST disporre di una forma vuota dei ruoli —
ruoli singoli nulli, griglie vuote — così che le pagine possano leggere un ruolo per nome senza un
controllo di esistenza per ciascuno.

Quella forma MUST essere dichiarata **una volta sola** e MUST vivere nel modulo di **lettura**, non
nel modulo dei tipi: il modulo dei tipi è lo specchio dei DTO e MUST NOT contenere valori.

🔴 La forma vuota MUST NOT essere una regola editoriale di ripiego. Non sceglie immagini, non
sostituisce quelle mancanti, non riproduce alcun ordine: dichiara che **non c'è nulla da rendere**,
che è uno stato diverso da «la galleria è vuota» soltanto nei log.

#### Scenario: Una sola dichiarazione della forma vuota

- GIVEN i sorgenti del sito
- WHEN si cerca chi dichiara i ruoli vuoti
- THEN esiste una sola dichiarazione
- AND nessuna pagina ne scrive una propria

#### Scenario: La forma vuota non sceglie immagini

- GIVEN la lettura della galleria fallita e un elenco di immagini disponibile da altra fonte
- WHEN le pagine rendono
- THEN nessun ruolo viene attribuito ad alcuna immagine

### Requirement: 🔴 Il consumatore legge un nome, mai un indice

Nessun sorgente del sito MUST calcolare il ruolo di un'immagine dalla sua **posizione** nell'elenco
della galleria: né per indice, né per finestra, né prendendo il primo o l'ultimo elemento.

È la proprietà per cui il campo nuovo esiste. Lasciarne una copia nel sito significherebbe avere la
regola in due posti — il server e la pagina — che è lo stato di partenza con un campo in più: due
scritture divergono, e diverge in silenzio quella che nessuno guarda.

⚠️ Il divieto riguarda gli indici **sulla galleria**. Le altre liste che le pagine tagliano — i
prodotti, le categorie — non sono in questa spec e restano dove sono.

#### Scenario: 🔴 Nessuna aritmetica sugli indici della galleria

- GIVEN i sorgenti delle pagine del sito
- WHEN si cercano indicizzazioni, finestre o accessi posizionali sull'elenco della galleria
- THEN non ne esiste alcuno
- AND ogni immagine con un ruolo viene letta per nome

#### Scenario: La regola non è duplicata nemmeno nei doppi di prova

- GIVEN il doppio del backend usato dai test del sito
- WHEN se ne ispeziona la risposta della galleria
- THEN rispecchia il contratto corrente
- AND non riscrive la regola di assegnazione dei ruoli come autorità alternativa
