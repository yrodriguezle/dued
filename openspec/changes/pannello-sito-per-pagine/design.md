# Design: Il pannello «Sito» modellato sulle pagine (pannello-sito-per-pagine)

> Proposal di riferimento: [proposal.md](./proposal.md). Questo documento **chiude i due nodi che
> la proposal ha lasciato aperti di proposito** — §2 (nodo A, la scrittura) in [D1](#d1) e §3 (nodo
> B, le immagini) in [D5](#d5) — e dichiara in [D15](#d15) le cinque divergenze verificate rispetto
> al testo della proposal.
>
> Dottrina ereditata: [`vetrina-api-pubblica/design.md`](../archive/2026-08-13-vetrina-api-pubblica/design.md)
> — §D1 (una regola vive in un posto solo, e la seconda copia si rende *faticosa* da scrivere), §D2
> (la superficie pubblica è chiusa **per costruzione**, non per disciplina), §D8 (il singleton è un
> valore di dominio), §D9 (assegnazione totale, e perché non si copia `updateBusinessSettings`).

---

## Technical Approach

Quattro pezzi, in **ordine obbligato**. L'ordine non è organizzativo: il primo pezzo è la rete che
deve esistere *prima* che il secondo possa rompere qualcosa in silenzio.

1. **Si riscrive la rete, con il modulo ancora intero.** Il test
   [`ImpostazioniVetrinaPage.test.tsx:143`](../../../duedgusto/src/components/pages/sito/__tests__/ImpostazioniVetrinaPage.test.tsx)
   confronta il modulo **con sé stesso** e resterebbe verde su una scheda parziale che azzera 26
   campi su 30. Va sostituito con un confronto contro un'**autorità esterna**, e va visto fallire,
   mentre il modulo è ancora unico e quindi il fallimento è dimostrabile. Nessuna riga di divisione
   prima di questo passo ([D3](#d3), [D4](#d4)).
2. **Si partiziona la scrittura.** Una mutation per scheda, **totale sul proprio sottoinsieme
   disgiunto** (A3). L'assegnazione totale — la riga che permette di svuotare un campo — sopravvive
   intatta *dentro* ogni scheda; ciò che sparisce è la sovrapposizione fra scheda e scheda
   ([D1](#d1), [D2](#d2)).
3. **Si dà un'identità a tre immagini.** Tre slot nominati (eroe della home, ritratto del locale,
   eroe dell'aperitivo) sul modello di `ImmagineOgId`, e — decisione più importante di tutte — la
   regola che oggi assegna i ruoli **per posizione**, oggi scritta quattro volte dentro quattro
   file `.astro`, si sposta in **una funzione C# sola**, letta sia dal sito sia dal pannello
   ([D5](#d5), [D6](#d6)).
4. **Si costruiscono le cinque schede.** Cinque voci di menu, cinque componenti, una mappa
   pagina → campi che vive in un posto solo e che un test del sito confronta con i sorgenti
   `.astro` ([D9](#d9), [D10](#d10), [D12](#d12)).

Due principi governano ogni decisione di questo documento.

**La proprietà di un campo si dichiara nel sistema dei tipi, non in un commento.** Ogni volta che
una scelta poteva risolversi con «ricordarsi di rispedire anche X», il design sceglie la forma in
cui X non è nemmeno *nominabile* dalla scheda sbagliata. Le quattro classi di input, la mappa
`Record<keyof …>` esaustiva del frontend e il test di riflessione sono tre strati della stessa idea.

**Una posizione non è un ruolo.** Il difetto di fondo che questo change corregge non è che manchi
un conteggio: è che *«la seconda foto»* significhi contemporaneamente tre cose diverse su tre
pagine. La cura non è documentare la convenzione, è dare un nome alle immagini che ne hanno bisogno
— e lasciare la posizione dove è ancora onesta, cioè nelle griglie.

---

## Architecture Decisions

<a id="d1"></a>
### D1 🔴 — Nodo A: **A3**, quattro scritture totali su sottoinsiemi disgiunti

**Choice.** La mutation unica si divide in **quattro**, ognuna con il proprio tipo di input e
ognuna ad **assegnazione totale sul proprio sottoinsieme**:

| Mutation | Input | Campi | Scheda |
|---|---|---|---|
| `mutateImpostazioniVetrina` *(esistente, ridotta)* | `ImpostazioniVetrinaInput` | 20 | Impostazioni sito |
| `mutatePaginaHome` | `PaginaHomeInput` | 4 (+1 slot) | Sito → Home |
| `mutatePaginaLocale` | `PaginaLocaleInput` | 2 (+1 slot) | Sito → Il locale |
| `mutatePaginaAperitivo` | `PaginaAperitivoInput` | 4 (+1 slot) | Sito → Aperitivo |

Le schede **Menu** e **Contatti** non possiedono alcun campo e quindi **non hanno alcuna
mutation**: vedi [D10](#d10).

Il commento-divieto di
[`VetrinaMutations.cs:488-490`](../../../backend/GraphQL/Vetrina/VetrinaMutations.cs) resta valido
alla lettera e va **ricopiato in ognuno dei quattro resolver**, perché la ragione per cui vale è
locale a ciascuno: *l'input possiede esattamente i campi scrivibili di quella scheda, quindi non c'è
nulla da preservare e quindi non c'è alcuna ragione di assegnare sotto condizione.*

**Alternatives considered.**

- **A1 — ogni scheda rispedisce tutti i 30 campi (leggi-modifica-riscrivi).** Scartata per
  l'argomento decisivo che la proposal già nomina — due amministratori su due schede diverse
  producono un **aggiornamento perso**, senza alcun errore — e per un secondo argomento che pesa
  altrettanto: `turnstileSiteKey` viaggia oggi **senza essere mostrato**
  ([`impostazioniVetrinaModulo.tsx:69-74`](../../../duedgusto/src/components/pages/sito/impostazioniVetrinaModulo.tsx))
  proprio perché l'assegnazione è totale. Con A1 quel trucco diventa **cinque superfici di
  trasporto invisibile** invece di una, e ognuna è un campo che qualcuno un giorno dimenticherà di
  ricopiare in una scheda nuova. A1 non risolve il problema: lo moltiplica per cinque e lo
  nasconde meglio.
- **A1-bis — A1 più un controllo di concorrenza ottimistica (`updatedAt` come token).** È la
  correzione ovvia al difetto decisivo di A1, e va nominata perché qualcuno la proporrà. Scartata:
  ripara l'aggiornamento perso ma non tocca le cinque superfici di trasporto, e in cambio aggiunge
  una modalità di errore nuova («qualcun altro ha salvato: ricarica e riprova») su una pagina
  amministrata da una persona sola. Costo alto, metà del beneficio.
- **A2 — mutation parziale (semantica *patch*).** Scartata: per funzionare dovrebbe distinguere
  «campo assente» da «campo esplicitamente `null`», e in GraphQL.NET quella distinzione **si perde
  nella deserializzazione** verso il POCO di input (`context.GetArgument<T>` produce `null` in
  entrambi i casi). Recuperarla richiederebbe di ispezionare il dizionario grezzo degli argomenti,
  cioè di rinunciare al tipo di input — che è esattamente l'artefatto su cui poggia il pin per
  riflessione. E soprattutto: la spec `impostazioni-vetrina` ha **scelto** di non fare quella
  distinzione, e il test `Mutation_ConUnCampoOpzionaleSvuotato_PersisteLAssenza` esiste per
  impedire che venga reintrodotta.
- **A5 — una sola mutation con input a gruppi facoltativi** (`input: { home: {…}, locale: {…} }`,
  gruppo assente = «non toccare»). È l'alternativa seria, e va spiegato perché perde. Tre ragioni.
  ① Reintroduce l'assegnazione condizionale, solo un livello più in alto: `if (input.Home is not
  null)` **non è** `if (!string.IsNullOrEmpty(input.ClaimVetrina))`, ma per chi legge sono la stessa
  forma, e la distinzione fra i due livelli è precisamente il genere di sottigliezza che si erode
  al terzo lettore. ② Le validazioni diventano condizionali a loro volta: `ValidaReputazione` girerebbe
  solo se il gruppo `home` è presente, e una validazione che a volte non gira è una validazione che
  un giorno non gira. ③ Un client potrebbe legittimamente inviare due gruppi in una chiamata,
  cioè *«un salvataggio che tocca due pagine»* — la cosa che questo change esiste per rendere
  impossibile. Con A3 è impossibile per costruzione: una mutation, una pagina.

**Rationale.** A3 è l'unica forma che conserva **entrambe** le proprietà in tensione — *«un campo
si deve poter svuotare»* e *«salvare una scheda non tocca le altre»* — senza aggiungere una terza
semantica. E il vincolo che impone (partizione **totale e disgiunta**) non è un costo accidentale:
è la regola di proprietà del §1 della proposal, resa eseguibile. Il documento la fa rispettare da
due lati indipendenti in [D3](#d3).

**Due conseguenze da scrivere adesso.**

🔴 **`mutateImpostazioniVetrina` diventa una modifica breaking dello schema**: il suo input passa
da 30 a 20 campi, e una chiamata che inviasse `claimVetrina` viene rifiutata dalla **validazione
del documento**. È accettabile perché l'unico consumatore è il frontend di questo repository, che
si deploya insieme; non è accettabile *tacerlo*, perché il piano di rollback della proposal (§3)
assume il contrario — vedi [D15](#d15).

⚠️ **L'upsert del singleton va condiviso, non copiato.** Tutte e quattro le funzioni devono poter
creare la riga se manca (installazione con `SEED_ON_STARTUP=false`, dove il primo salvataggio è
anche il primo inserimento). Quattro `FirstOrDefaultAsync` + `Add` copiati sono quattro posti in
cui un giorno la costante `IdSingleton` viene sostituita da un `FirstOrDefault()` senza criterio.
Un helper privato solo:

```csharp
/// <summary>
/// La riga, letta per identificativo e creata se manca. 🔴 Sede UNICA dell'upsert: le quattro
/// scritture della vetrina la chiamano tutte, e nessuna ha un proprio `FirstOrDefaultAsync`.
/// Mai un FirstOrDefaultAsync() senza criterio — c'è una riga sola e il database lo impone con
/// un CHECK, quindi chiederla per identificativo è anche il modo di dirlo al lettore.
/// </summary>
private static async Task<ImpostazioniVetrina> CaricaOCreaSingletonAsync(AppDbContext dbContext)
```

⚠️ **Ordine invariato dentro ogni resolver**: *tutte* le validazioni prima di qualunque tocco al
change tracker. Vale per i quattro, non solo per quello che ce l'ha già
([`VetrinaMutations.cs:440-442`](../../../backend/GraphQL/Vetrina/VetrinaMutations.cs)).

---

<a id="d2"></a>
### D2 🔴 — La partizione dei 30 campi, e i due grappoli che la vincolano

**Choice.** La partizione, per intero. È l'artefatto centrale del change: ogni riga di codice di
[D1](#d1), [D3](#d3) e [D9](#d9) discende da questa tabella.

| Campo | Proprietario | Letto da | Nota |
|---|---|---|---|
| `InsegnaPubblica` | **Impostazioni sito** | tutte e 5 | `index:90, menu:72, locale:54, aperitivo:54, contatti:71` |
| `Via` `Cap` `Citta` `Provincia` `Paese` | **Impostazioni sito** | `/`, `/contatti` | + JSON-LD di `Base.astro` |
| `Latitudine` `Longitudine` | **Impostazioni sito** | `/`, `/contatti` | 🔴 **grappolo 1**: `Mappa.astro` |
| `Telefono` `Email` | **Impostazioni sito** | `/contatti` | |
| `UrlInstagram` `UrlFacebook` | **Impostazioni sito** | `/contatti` | |
| `MetaTitoloDefault` `MetaDescrizioneDefault` `ImmagineOgId` | **Impostazioni sito** | tutte (via `Base.astro`) | |
| `OraInizioTemaSera` | **Impostazioni sito** | `/`, `/aperitivo` | `index:209`, `aperitivo:114` |
| `PrenotazioniAttive` `PrenotazioniPreavvisoOre` `PrenotazioniCopertiMax` `TurnstileSiteKey` | **Impostazioni sito** | nessuno | ganci spenti |
| `ClaimVetrina` | **Home** | `/` | `index:91` (meta) e `index:139-143` |
| `PunteggioGoogle` `NumeroRecensioniGoogle` `UrlProfiloGoogle` | **Home** | `/` | 🔴 **grappolo 2**: `index:382 → Recensioni.astro` |
| `StoriaTitolo` `StoriaTesto` | **Il locale** | `/locale` | `StoriaTesto` decide se `/locale` esiste |
| `AperitivoTitolo` `AperitivoTesto` `AperitivoPunti` `AperitivoCategorie` | **Aperitivo** | `/aperitivo` **e `/`** | `index:159,212,214-218` — letti dalla home, posseduti dall'aperitivo |

**20 + 4 + 2 + 4 = 30.** Nessun campo orfano, nessun campo condiviso.

🔴 **I due grappoli a validazione incrociata cadono entrambi dentro una scheda sola, e non per
fortuna: è il vincolo che ha determinato la tabella.**

- `Latitudine`/`Longitudine`
  ([`VetrinaMutations.cs:545-567`](../../../backend/GraphQL/Vetrina/VetrinaMutations.cs)) stanno
  con l'indirizzo, in **Impostazioni sito**. `ValidaCoordinate` resta dov'è e viene chiamata da un
  resolver solo.
- `PunteggioGoogle`/`NumeroRecensioniGoogle`
  ([`VetrinaMutations.cs:576-598`](../../../backend/GraphQL/Vetrina/VetrinaMutations.cs)) stanno
  con `UrlProfiloGoogle` in **Home**, perché il blocco reputazione si rende solo lì
  (`index.astro:382`). `ValidaReputazione` si sposta di chiamante, non di forma.

Lo stesso vincolo vale al piano di sopra, nel modulo Formik: il `superRefine` di
[`impostazioniVetrinaModulo.tsx:249-288`](../../../duedgusto/src/components/pages/sito/impostazioniVetrinaModulo.tsx)
contiene **entrambi** i controlli incrociati e va spezzato in due — coordinate nello schema di
Impostazioni sito, reputazione nello schema della Home. Un controllo incrociato spezzato fra due
schemi non segnalerebbe più *entrambi* i campi, che è precisamente la proprietà che il test alle
righe 92-101 dimostra.

⚠️ **`AperitivoTitolo`/`Testo`/`Punti` sono letti dalla home e posseduti dall'aperitivo.** È il caso
che rende la regola *«un campo, una pagina»* falsa e la regola *«un campo, un proprietario»* vera.
La scheda **Home** li mostra quindi in **sola lettura**, con il collegamento a `Sito → Aperitivo`
— esattamente il trattamento che la pagina attuale riserva agli orari
([`ImpostazioniVetrinaPage.tsx:578-590`](../../../duedgusto/src/components/pages/sito/ImpostazioniVetrinaPage.tsx)).

**Alternatives considered.**
- *`ClaimVetrina` alle Impostazioni sito* (è «l'identità del locale»): scartata — si rende in un
  punto solo, dentro la home (`index.astro:139-143`), e metterlo altrove costringerebbe la scheda
  Home a essere una mappa invece che un modulo, per il campo che più le appartiene.
- *La reputazione alle Impostazioni sito* (è «un dato del locale», non della home): scartata perché
  spezzerebbe il grappolo 2 dal suo unico consumatore, e perché un amministratore che vuole cambiare
  «4,7 su 180 recensioni» sta guardando la home.
- *Una quinta scheda «SEO» che raccoglie i meta*: scartata — non corrisponde a una pagina, e la
  proposal ha già escluso i meta per pagina (che sarebbero la forma giusta) perché richiedono una
  migrazione da decidere a parte.

---

<a id="d3"></a>
### D3 🔴 — La totalità si fa rispettare da **due lati**, e i due lati non sono ridondanti

Il criterio di successo dice: *«l'unione degli input è esattamente l'insieme dei campi scrivibili:
né un campo orfano né un campo condiviso da due schede»*. Sono **due** proprietà distinte, e nessun
singolo meccanismo le copre bene entrambe.

**① Totalità, dal compilatore, sul frontend.** Un tipo di intersezione nomina i 30 campi, e una
mappa esaustiva costringe ad assegnarne ognuno a una scheda:

```ts
// duedgusto/src/components/pages/sito/proprietaCampiVetrina.tsx
type SchedaSito = "impostazioni" | "home" | "locale" | "aperitivo";

/** I campi scrivibili, tutti, in un tipo solo. L'intersezione dei quattro input li nomina
 *  esattamente una volta ciascuno perché i quattro sono disgiunti (② lo dimostra). */
type CampiScrivibiliVetrina =
  ImpostazioniVetrinaInput & PaginaHomeInput & PaginaLocaleInput & PaginaAperitivoInput;

/**
 * 🔴 `Record<keyof …>` e non `Partial<Record<…>>`: aggiungere un campo scrivibile senza
 *    assegnarlo a una scheda è un ERRORE DI COMPILAZIONE, non un test rosso — e `ts:check`
 *    gira in CI. È il posto in cui «quale scheda possiede questo campo» smette di essere
 *    conoscenza e diventa una firma.
 */
export const PROPRIETA_CAMPI: Record<keyof CampiScrivibiliVetrina, SchedaSito> = { … };
```

Il compilatore garantisce la **totalità** (nessun campo orfano). Non garantisce la **disgiunzione**:
se `claimVetrina` finisse in due `inputDa…`, l'intersezione lo nominerebbe comunque una volta sola
e la mappa resterebbe valida.

**② Disgiunzione e totalità insieme, per riflessione, sul backend.** Il pin esistente
([`ImpostazioniVetrinaTests.cs:427-447`](../../../backend/DuedGusto.Tests/Integration/GraphQL/ImpostazioniVetrinaTests.cs))
smette di essere una lista letterale e diventa un confronto contro **il modello**:

```csharp
// L'autorità non è più una lista scritta a mano: è l'entità, meno ciò che dichiaratamente
// non si scrive da GraphQL. Un campo aggiunto al modello e a nessun input diventa ORFANO e
// questo test lo dice per nome.
private static readonly string[] NonScrivibiliDaGraphQL =
[
    "ImpostazioniVetrinaId",  // c'è una riga sola e il resolver sa quale (spec, §D8)
    "CreatedAt", "UpdatedAt", // ciò che il sistema ha osservato, non ciò che un client dichiara
    "ImmagineOg",             // navigazione: si scrive ImmagineOgId
    "ImmagineEroeHome", "ImmagineRitrattoLocale", "ImmagineEroeAperitivo", // idem, D5
];

[Fact] public void UnioneDegliInput_EEsattamenteLInsiemeDeiCampiScrivibili() { … }
[Fact] public void NessunCampoAppartieneADueSchede() { … }   // intersezione a coppie = ∅
```

**Perché i due lati non si sostituiscono.** ① è **gratuito e immediato** (fallisce mentre scrivi, in
`ts:check`) ma cieco alla duplicazione. ② copre entrambe le proprietà ma solo in `dotnet test`, e
solo sul C#. Insieme coprono i due modi in cui la partizione può marcire — un campo nuovo
dimenticato, e un campo copiato in due posti — e lo fanno nei due punti in cui il rispettivo errore
si commette.

**Alternatives considered.**
- *Solo il test C#*: sufficiente in teoria, ma il campo nuovo si aggiunge normalmente partendo dal
  frontend, e scoprire l'errore alla fine di `dotnet test` invece che nell'editor è la differenza
  fra una correzione e un giro di build.
- *Generare i tipi TS dallo schema GraphQL (codegen)*: eliminerebbe la doppia scrittura alla radice
  ed è la risposta giusta a lungo termine, ma il progetto scrive i tipi a mano in
  [`src/@types/vetrina.d.ts`](../../../duedgusto/src/@types/vetrina.d.ts) per tutti i domini.
  Introdurre codegen per un dominio solo è un cambiamento di stack in un change che parla d'altro.
  **Candidato dichiarato per un change dedicato.**
- *Un solo test che confronta i nomi TS con i nomi C# leggendo i sorgenti*: possibile, ma il modo
  in cui una divergenza si manifesta oggi è già accettabile — un campo che il frontend invia e lo
  schema non conosce viene **rifiutato dalla validazione del documento**, rumorosamente, non
  azzerato in silenzio. È il salto qualitativo che questo change compra: la divergenza smette di
  essere muta.

---

<a id="d4"></a>
### D4 🔴 — Il test frontend si riscrive **prima** della divisione, e lo si vede fallire

**Il vincolo.** Il test *«ogni valore del modulo finisce nell'input»*
([riga 143-162](../../../duedgusto/src/components/pages/sito/__tests__/ImpostazioniVetrinaPage.test.tsx))
fa `Object.keys(valori).filter(chiave => !(chiave in input))`: confronta il modulo **con sé stesso**.
Su una scheda che conoscesse 4 campi su 30 sarebbe **verde mentre il salvataggio ne azzera 26**.

**Choice — un ordine, non una raccomandazione.**

1. Si introduce `CAMPI_SCRIVIBILI` e `PROPRIETA_CAMPI` ([D3](#d3)) **mentre il modulo è ancora
   unico**, e il test diventa:

   ```ts
   it("🔴 l'unione delle schede copre esattamente i campi scrivibili", () => {
     const prodotti = [inputImpostazioni(v), inputHome(v), inputLocale(v), inputAperitivo(v)]
       .flatMap(Object.keys);
     expect(new Set(prodotti).size).toBe(prodotti.length);       // nessun campo in due schede
     expect(prodotti.sort()).toEqual([...CAMPI_SCRIVIBILI].sort()); // nessun campo orfano
   });
   ```

2. **Si dimostra che è rosso**: si toglie a mano un campo da `inputDaValori` e si verifica il
   fallimento, con il nome del campo nel messaggio. La dimostrazione va **annotata nel commit**,
   perché è l'unica prova che la rete regge — un test strutturale che nessuno ha mai visto fallire
   è indistinguibile da un test che non verifica niente.
3. **Solo dopo** si divide il modulo.

**Rationale.** Il guasto che questa rete previene **è già avvenuto una volta** in questo stesso file
— è la ragione per cui `turnstileSiteKey` viaggia senza essere mostrato — e la divisione in schede
ne moltiplica per cinque le occasioni. Riscrivere il test *dopo* significherebbe scriverlo contro
il codice appena prodotto, che è il modo di far passare un test invece di farlo verificare qualcosa.

⚠️ Il test *«trasporta la chiave antispam che la pagina non mostra»* (riga 137) **resta**, spostato
sulla scheda Impostazioni sito: `turnstileSiteKey` continua a non mostrarsi e continua a viaggiare,
ma ora dentro un gruppo da 20 campi invece che da 30 — e il commento va aggiornato, perché la
ragione non è più *«l'assegnazione del server è totale»* in astratto, è *«è totale su questo
gruppo, e questo campo appartiene a questo gruppo»*.

---

<a id="d5"></a>
### D5 🔴 — Nodo B: **B2 ibrida**, e la mossa vera è spostare la regola dei ruoli nel backend

**Il problema, misurato.** Quattro pagine indicizzano la stessa lista, con offset diversi:

| Pagina | Riga | Codice | Posizioni |
|---|---|---|---|
| `/` | [`index.astro:85-86`](../../../sito/src/pages/index.astro) | `const [eroe, ...altre] = galleria; const griglia = altre.slice(0, 3);` | 1ª; 2ª-4ª |
| `/menu` | [`menu.astro:68`](../../../sito/src/pages/menu.astro) | `const foto = galleria.slice(0, 3);` | 1ª-3ª |
| `/locale` | [`locale.astro:38-39`](../../../sito/src/pages/locale.astro) | `const ritratto = galleria[1] ?? galleria[0] ?? null; const quadrate = galleria.slice(2, 5);` | 2ª (ripiego 1ª); 3ª-5ª |
| `/aperitivo` | [`aperitivo.astro:50`](../../../sito/src/pages/aperitivo.astro) | `const eroe = galleria.at(-1) ?? null;` | **l'ultima** |

**Choice — tre mosse, di cui la seconda è quella che conta.**

**① Tre slot nominati sull'entità**, sul modello esatto di `ImmagineOgId` (nullable, FK
`Restrict`, **senza navigazione inversa**):

```csharp
// backend/Models/ImpostazioniVetrina.cs
/// <summary>L'immagine grande in cima alla home. Vuota: il sito usa la prima della galleria,
/// che è il comportamento di oggi — e la scheda della pagina lo dice.</summary>
public int? ImmagineEroeHomeId { get; set; }
public MediaAsset? ImmagineEroeHome { get; set; }

public int? ImmagineRitrattoLocaleId { get; set; }
public MediaAsset? ImmagineRitrattoLocale { get; set; }

public int? ImmagineEroeAperitivoId { get; set; }
public MediaAsset? ImmagineEroeAperitivo { get; set; }
```

⚠️ Perché **queste tre e non nove**: sono le sole immagini con un ruolo **singolo e riconoscibile**.
Le griglie sono davvero *«foto del locale»*, va bene che compaiano su più pagine, e trasformarle in
nove slot significherebbe nove selettori da compilare prima che il sito sembri finito, più una
migrazione ogni volta che una griglia passa da tre a quattro foto.

🔴 **I tre slot appartengono alle rispettive schede di [D2](#d2)**: `ImmagineEroeHomeId` alla Home,
`ImmagineRitrattoLocaleId` a Il locale, `ImmagineEroeAperitivoId` all'Aperitivo. I due nodi si
incastrano invece di sommarsi — ed è la conferma reciproca che entrambe le scelte sono quelle
giuste.

**② 🔴 La regola posizionale si sposta dai quattro `.astro` a una funzione C# sola.** È la decisione
centrale di [D5](#d5), e vale a prescindere dal pannello:

```csharp
// backend/Services/Vetrina/RuoliImmaginiVetrina.cs
/// <summary>
/// Chi sta ricoprendo quale ruolo, adesso. 🔴 Sede UNICA della regola: fino a questo change
/// viveva scritta quattro volte, dentro quattro file .astro, e il backend non ne aveva copia —
/// motivo per cui la domanda «quante immagini ospita questa pagina» non aveva risposta
/// da nessuna parte, nemmeno per chi leggeva il codice.
///
/// Logica pura, senza DbContext: esercitabile dai test senza montare niente, e raggiungibile
/// sia dal controller pubblico sia dal ramo GraphQL di amministrazione senza che nessuno dei
/// due dipenda dall'altro. Stessa collocazione e stessa ragione di RegoleVetrina.
/// </summary>
public static class RuoliImmaginiVetrina
{
    public static PianoImmagini Risolvi(
        ImpostazioniVetrina impostazioni, IReadOnlyList<MediaAsset> galleria);
}
```

Il piano, per intero e senza eccezioni:

| Ruolo | Regola | Ripiego a slot vuoto |
|---|---|---|
| `EroeHome` | slot `ImmagineEroeHomeId` | `galleria[0]` |
| `GrigliaHome` (3) | finestra `[1..4)` | — |
| `FotoMenu` (3) | finestra `[0..3)` | — |
| `RitrattoLocale` | slot `ImmagineRitrattoLocaleId` | `galleria[1] ?? galleria[0]` |
| `QuadrateLocale` (3) | finestra `[2..5)` | — |
| `EroeAperitivo` | slot `ImmagineEroeAperitivoId` | `galleria.at(-1)` |

🔴 **A slot tutti vuoti il piano riproduce, immagine per immagine, ciò che il sito rende oggi.** È
il criterio di successo *«il sito non cambia comportamento a contenuti invariati»*, ed è
l'asserzione principale del test unitario di [Testing Strategy](#testing-strategy).

⚠️ **Una sola regola in più: la finestra salta le immagini che hanno già un ruolo singolo nella
stessa pagina, e scorre.** Serve perché con uno slot esplicito la stessa foto potrebbe comparire
due volte sulla stessa pagina — e renderebbe **falso** il numero che la scheda dichiara. A slot
vuoti la regola non ha effetto (l'eroe della home è `galleria[0]`, la griglia parte da `[1]`; il
ritratto del locale è `[1]`, le quadrate partono da `[2]`), quindi non altera il comportamento
attuale: si attiva solo quando l'amministratore ha scelto, cioè quando è utile.

**③ Nessun backfill.** Gli slot nascono `null` e restano `null` finché qualcuno non sceglie. Il
ripiego **è la semantica permanente dello slot vuoto**, non un ponte temporaneo verso una
migrazione dati.

**Alternatives considered.**

- **B1 — una cartella per pagina** (`galleria-home`, `galleria-locale`…). Scartata: cambia il valore
  canonico `"galleria"` che la spec `api-pubblica` pinna
  ([specs.md:678-695](../../specs/api-pubblica/specs.md)) e il filtro di uguaglianza secca di
  [`PublicController.cs:581-594`](../../../backend/Controllers/PublicController.cs); e costringe a
  **caricare due volte la stessa foto** per mostrarla su due pagine, che è il difetto peggiore per
  una libreria di media.
- **B3 — solo didattico**: la scheda *spiega* la convenzione posizionale, il modello non cambia.
  Scartata come scelta primaria, e va detto perché con precisione: **risponde alla domanda
  sbagliata**. Con B3 il numero è giusto e stabile, ma l'**identità** delle immagini no — caricare
  una sesta foto continua a spostare l'eroe dell'aperitivo, e la scheda si limiterebbe ad annunciare
  in anticipo un difetto invece di toglierlo. Resta il **ripiego onesto** se il costo di toccare il
  sito si rivelasse più alto del previsto: il pannello, la partizione della scrittura e le cinque
  voci di menu non dipendono da [D5](#d5) e si consegnano lo stesso.
- **Slot per ogni immagine (nove), galleria abolita.** Scartata: vedi ⚠️ in ①.
- **Una colonna JSON `RuoliImmagini` su `ImpostazioniVetrina`.** Scartata: perde la chiave esterna,
  quindi cancellare un media non verrebbe più rifiutato ([D7](#d7)) e il sito renderebbe una chiave
  morta. È lo stesso argomento con cui la proposal ha scartato il CMS a blocchi: un modello più
  potente e un prodotto peggiore.
- **Lasciare la risoluzione nei `.astro` e mandare al sito i soli slot.** Sarebbe la migrazione più
  piccola. Scartata: il ripiego («slot, altrimenti la posizione») finirebbe scritto **quattro volte
  nei `.astro` e una quinta nel pannello**, che è il problema di partenza con un campo in più. Con
  ②, il pannello e il sito leggono lo **stesso** piano, quindi la scheda non può mentire su quale
  foto la pagina sta usando.

**Rischio residuo dichiarato.** Finché l'amministratore non sceglie, la trappola resta:
riordinare la galleria o caricare una foto cambia ancora le immagini di quattro pagine. La
differenza è che ora la trappola è **visibile** — la scheda dell'Aperitivo dice *«nessuna immagine
scelta: la pagina usa l'ultima della galleria, quindi cambia ogni volta che ne carichi una»* — e ha
un rimedio a un clic. Un difetto con un rimedio nominato non è lo stesso difetto.

---

<a id="d6"></a>
### D6 — Il contratto pubblico: `/api/public/galleria` guadagna `ruoli`, additivo

**Choice.** La rotta della galleria — **quella che le quattro pagine già chiamano** — guadagna un
secondo campo accanto all'elenco:

```csharp
// backend/Controllers/Public/Dto/GalleriaPubblicaDto.cs
public record GalleriaPubblicaDto(
    IReadOnlyList<ImmaginePubblicaDto> Immagini,   // invariato: contratto esistente, spec verde
    RuoliImmaginiDto Ruoli);                       // nuovo

public record RuoliImmaginiDto(
    ImmaginePubblicaDto? EroeHome,      IReadOnlyList<ImmaginePubblicaDto> GrigliaHome,
    IReadOnlyList<ImmaginePubblicaDto> FotoMenu,
    ImmaginePubblicaDto? RitrattoLocale, IReadOnlyList<ImmaginePubblicaDto> QuadrateLocale,
    ImmaginePubblicaDto? EroeAperitivo);
```

Le quattro pagine sostituiscono l'aritmetica sugli indici con una lettura per nome:

```astro
const { ruoli } = esitoGalleria.stato === 'ok' ? esitoGalleria.dati : RUOLI_VUOTI;
const eroe = ruoli.eroeHome;          // era: const [eroe, ...altre] = galleria;
const griglia = ruoli.grigliaHome;    // era: altre.slice(0, 3);
```

**Alternatives considered.**
- *Mettere i ruoli su `/api/public/site`*: `site` è l'identità del locale e `contatti.astro` lo
  legge **senza** leggere la galleria ([`contatti.astro:15`](../../../sito/src/pages/contatti.astro)).
  Metterci le immagini gonfierebbe l'unica risposta che oggi non ne ha bisogno.
- *Ruoli espressi come **chiavi** invece che come immagini complete*: risparmierebbe qualche
  centinaio di byte su una risposta cacheata 300 s, in cambio di una `join` per chiave dentro ogni
  `.astro` — cioè di logica dove stiamo togliendo logica. Il payload duplicato è preferibile alla
  regola duplicata.
- *Ruoli espressi come **indici** in `immagini`*: gli indici sono precisamente ciò che questo change
  esiste per abolire; riesportarli sarebbe una beffa.
- *Rimuovere `immagini` e lasciare solo `ruoli`*: romperebbe il contratto pinnato dalla spec
  `api-pubblica` (quattro scenari) e i test `menu.test.mjs:157` e `prefissi.test.mjs:50`. `immagini`
  resta, ed è additivo per definizione.

⚠️ **La superficie pubblica resta chiusa per costruzione**: `RuoliImmaginiDto` è un `record` in
`duedgusto.Controllers.Public.Dto` e riusa `ImmaginePubblicaDto`, quindi i tre test strutturali di
`SuperficiePubblicaTests` lo attraversano **senza modifiche** (la BFS è ricorsiva sui tipi
annidati). Nessun nome vietato compare nel nuovo record.

⚠️ **`ImmaginePubblicaDto` resta identico** e continua a essere lo stesso tipo di `/api/public/menu`:
`PublicControllerTests.cs:611` resta verde.

**Lato amministrazione**, lo stesso piano si legge da GraphQL, con un campo in più che il sito non
ha ragione di conoscere:

```
vetrina {
  ruoliImmagini {
    eroeHome       { mediaAssetId  origine }   # origine: SLOT | POSIZIONE
    ritrattoLocale { mediaAssetId  origine }
    eroeAperitivo  { mediaAssetId  origine }
    grigliaHome    { mediaAssetId }
    fotoMenu       { mediaAssetId }
    quadrateLocale { mediaAssetId }
  }
}
```

`origine` è ciò che permette alla scheda di dire *«scelta da te»* invece di *«è la prima della
galleria, e cambierà»*, e alla libreria media di distinguere un ruolo **stabile** da uno
**posizionale**. Non esce in pubblico perché il sito non ha nulla da farci.

---

<a id="d7"></a>
### D7 🔴 — Cancellare un media: i referenti diventano **quattro**, e l'ordine resta la sostanza

**Il vincolo.** [`EliminaMediaAssetAsync`](../../../backend/GraphQL/Vetrina/VetrinaMutations.cs)
(righe 374-419) verifica **due** referenti — i prodotti e `ImmagineOgId` — e li verifica **prima**
di `storage.EliminaAsync(asset.Chiave)` (riga 414). La docstring alle righe 358-372 spiega perché
l'ordine è la sostanza: con la verifica dopo, la foreign key rifiuterebbe comunque, ma **a file già
cancellati**, e un test che verificasse solo il rifiuto resterebbe verde.

**Choice.** I tre slot nuovi entrano nella **stessa** verifica, prima del disco, e l'errore
**nomina il ruolo**:

```csharp
// Referenti 2-5: i quattro slot immagine delle impostazioni del sito. Si leggono QUI, insieme
// agli altri e prima di qualunque scrittura su disco: fra questa riga e storage.EliminaAsync
// non deve poter entrare nulla.
string? ruoloOccupato = await dbContext.ImpostazioniVetrina
    .Where(i => i.ImmagineOgId == mediaAssetId || i.ImmagineEroeHomeId == mediaAssetId
             || i.ImmagineRitrattoLocaleId == mediaAssetId
             || i.ImmagineEroeAperitivoId == mediaAssetId)
    .Select(i => i.ImmagineOgId == mediaAssetId ? "l'immagine di anteprima social del sito"
               : i.ImmagineEroeHomeId == mediaAssetId ? "l'immagine grande della pagina Home"
               : i.ImmagineRitrattoLocaleId == mediaAssetId ? "il ritratto della pagina «Il locale»"
               : "l'immagine grande della pagina «Aperitivo»")
    .FirstOrDefaultAsync();
```

**Rationale.** È il punto più facile da sbagliare dell'intero nodo B, e lo si sbaglia in modo
**silenzioso a metà**: la FK impedisce comunque la cancellazione della riga, quindi il sintomo non
è «i dati sono spariti» ma «i file sono spariti e il messaggio d'errore è incomprensibile». Il test
che conta non è quello sul rifiuto — è quello che asserisce che **i file sono ancora sul
filesystem**, ed è già scritto per il caso `ImmagineOg`: va reso una `[Theory]` sui quattro slot,
non copiato quattro volte.

⚠️ **`VerificaImmagineAssegnabileAsync` va chiamata per ogni slot** nella rispettiva scrittura
(`internal static`, sede unica della regola *«esiste ed è pubblicato»*): `mutatePaginaHome` per
l'eroe, `mutatePaginaLocale` per il ritratto, `mutatePaginaAperitivo` per il suo eroe.

⚠️ **`DeleteBehavior.Restrict` e nessuna navigazione inversa** su tutte e tre le relazioni: la spec
`impostazioni-vetrina` ha uno scenario dedicato — *«Nessuna colonna ombra sull'entità dei media»*
(righe 187-192) — e tre relazioni con navigazione inversa produrrebbero tre collezioni su
`MediaAsset`, cioè tre colonne ombra.

---

<a id="d8"></a>
### D8 — La migrazione EF: additiva, e la procedura **a backend spento**

**Choice.** Una migrazione sola, `SlotImmaginiPagineVetrina`, **puro DDL**: tre colonne `int NULL`,
tre indici, tre chiavi esterne verso `MediaAssets`. Nessun `UPDATE`, nessuna alterazione di tabelle
esistenti diverse da `ImpostazioniVetrina`.

```csharp
// backend/DataAccess/AppDbContext.cs — dentro il blocco ImpostazioniVetrina esistente
entity.HasOne(x => x.ImmagineEroeHome)
      .WithMany()                              // 🔴 nessuna navigazione inversa: niente
      .HasForeignKey(x => x.ImmagineEroeHomeId) //    collezione ombra su MediaAsset
      .OnDelete(DeleteBehavior.Restrict);
// idem per ImmagineRitrattoLocale e ImmagineEroeAperitivo
```

**Procedura — da documentare, non da eseguire in fase di design.** In questo repository
`dotnet ef migrations add` **non gira con il backend acceso**: lo strumento ricostruisce il progetto
e il `.dll` è bloccato dal processo in esecuzione.

```bash
# 1. Fermare il backend (Ctrl-C sul `dotnet run`, o `taskkill /IM duedgusto.exe`)
cd backend
dotnet build                                          # deve passare PRIMA di generare
dotnet ef migrations add SlotImmaginiPagineVetrina

# 2. Ispezionare Up() a occhio, e rifiutare tutto ciò che non sia:
#      AddColumn<int>(name: "ImmagineEroeHomeId", table: "ImpostazioniVetrina", nullable: true)
#      CreateIndex(...)  +  AddForeignKey(... onDelete: ReferentialAction.Restrict)
#    🔴 Nessun AlterTable su MediaAssets. Nessun AddColumn su MediaAssets.
#    ⚠️ Se il modello è cambiato dopo la generazione, la migrazione va RIGENERATA
#       (dotnet ef migrations remove, poi add), non modificata a mano.

# 3. Riavviare: MigrateAsync la applica all'avvio (Program.cs), niente `database update`.
cd backend && dotnet run
```

**Rollback.** Le tre colonne sono nullable e additive: **lasciarle in produzione è innocuo** e il
codice precedente le ignora. ⚠️ L'unico punto di non ritorno del change resta quello che la proposal
già nomina: se qualcuno ha usato gli slot per scegliere immagini che l'ordine della galleria non
riprodurrebbe, tornare indietro **perde quella scelta editoriale in silenzio**. Prima di un revert
dei `.astro`, gli slot valorizzati vanno riportati nell'ordine della galleria.

---

<a id="d9"></a>
### D9 — La mappa pagina → campi: **una sola**, in C#, verificata dai test del **sito**

**Il vincolo.** Renderla esplicita crea una seconda scrittura, e due scritture divergono: qualcuno
aggiunge un campo a `locale.astro`, la scheda «Il locale» non lo impara mai, e l'amministratore ha
una mappa che mente con sicurezza — il modo peggiore di sbagliare per uno strumento di orientamento.

**Choice — la mappa vive nel backend, la verifica vive nel sito.**

```csharp
// backend/Services/Vetrina/MappaPagineVetrina.cs
//
// 🔴 UNA VOCE PER RIGA, e la forma è VINCOLANTE: sito/test/mappa-pagine.test.mjs legge questo
//    file con una regex. Cambiare la forma senza cambiare la regex renderebbe il test CIECO
//    invece che rosso — per questo il test asserisce anche il NUMERO di voci trovate.
new VoceMappa("/",          "ClaimVetrina",     "testi.claim",              Scheda.Home),
new VoceMappa("/",          "PunteggioGoogle",  "reputazione.punteggio",    Scheda.Home),
new VoceMappa("/",          "AperitivoTitolo",  "testi.aperitivo.titolo",   Scheda.Aperitivo), // letto qui, posseduto altrove
new VoceMappa("/locale",    "StoriaTesto",      "testi.storia.testo",       Scheda.Locale),
…
```

Tre campi per voce e non due: **pagina**, **campo del modello** e **percorso nel DTO pubblico**. Il
terzo è ciò che permette la verifica meccanica (i `.astro` leggono `sito.testi.storia.testo`, non
`StoriaTesto`) ed è, come effetto secondario, la prima documentazione della mappatura che oggi
esiste solo dentro `PublicController.TestiDa`
([righe 453-464](../../../backend/Controllers/PublicController.cs)).

Due consumatori, **nessuna copia**:
- il **pannello** la legge da GraphQL (`vetrina { mappaPagine }`) e ci costruisce le sezioni
  «testi di questa pagina» e «testi ereditati, si cambiano qui»;
- il **sito** la verifica: `sito/test/mappa-pagine.test.mjs` scansiona i cinque `.astro`, raccoglie
  le espressioni `sito.<percorso>` e le confronta con le voci dichiarate. Divergono in un verso o
  nell'altro → **rosso**.

**Perché la verifica sta nel sito e non nel backend.** I test di `sito/` **già scansionano i
sorgenti** — `moduli.test.mjs` (unicità di `astro:env/server`), `orari-sorgenti.test.mjs` (nessun
orario scritto a mano), `tema-sorgenti.test.mjs`, con l'helper condiviso `_scansione.mjs`. Aggiungere
lì una scansione è continuare un pattern; farlo dal backend (che oggi scansiona solo `backend/`,
`RegolaPubblicazioneUnicaTests`) accoppierebbe la CI del backend al layout dei sorgenti del sito, in
una direzione che il repository non ha mai preso.

**Alternatives considered.**
- *Mappa in `sito/src/lib/campiPerPagina.ts`, accanto a `rotte.ts`*: sarebbe la casa naturale, e
  `rotte.ts` è già *«le pagine del sito in un posto solo»*. Scartata perché **il gestionale non può
  importare da `sito/`**: sono due build separate, e la mappa finirebbe ricopiata nel pannello, cioè
  duplicata proprio nel punto in cui serve che non lo sia.
- *Mappa in un `.json` condiviso*: toglierebbe la fragilità della regex, ma aggiungerebbe al backend
  una lettura di file a runtime (o un asset incorporato) con i suoi modi di fallire, per un dato che
  cambia una volta ogni sei mesi. Il costo della regex è **un'asserzione sul conteggio delle voci**.
- *Derivare la mappa leggendo i `.astro` a build time*: già scartata dalla proposal (Alternative §5)
  — il gestionale non può dipendere dalla build del sito. Il **confronto** resta ed è questo test.

⚠️ **Il test va scritto in modo da fallire, non da tacere.** Tre asserzioni, non una: ① le voci
parsate sono ≥ N (la regex ha funzionato); ② ogni `sito.<percorso>` trovato nei `.astro` compare
nella mappa (nessun campo letto e non dichiarato); ③ ogni voce dichiarata per una pagina compare in
quel `.astro` (nessuna voce fantasma).

---

<a id="d10"></a>
### D10 — Una scheda senza campi propri **non ha un pulsante Salva**, e non è una mancanza

**Choice.** Le schede **Menu** e **Contatti** non hanno `Formik`, non hanno `FormikToolbar` e non
chiamano alcuna mutation. Sono composte da: stato di pubblicazione, conteggio esatto delle immagini
con i loro ruoli, elenco dei testi **ereditati** in sola lettura con il collegamento a dove si
cambiano, e le altre sorgenti che le alimentano (prodotti pubblicati per `/menu`, orari e contatti
per `/contatti`).

**Rationale.** È la risposta letterale alla domanda dell'utente. `/menu` legge di `site` **solo**
`insegna` (`menu.astro:72`); la sua descrizione SEO è perfino scritta a mano nel sorgente
(`menu.astro:73`). Mettere lì un modulo vuoto con un pulsante Salva grigio sarebbe peggio di non
metterlo: suggerirebbe che manchi qualcosa da compilare.

⚠️ **Corollario sulla voce di menu**: la scheda di `/aperitivo` **esiste sempre**, anche quando la
pagina del sito non esiste. Nasconderla sarebbe togliere l'unico posto da cui la si può creare.

⚠️ La scheda `/menu` **rimanda** alla griglia prodotti esistente e mostra un conteggio; non diventa
una seconda griglia prodotti. Stessa regola per le recensioni sulla scheda Home.

**Alternative considerata e scartata.** *Dare a `/menu` e `/contatti` titolo e descrizione SEO
propri*, così che ogni scheda abbia almeno un campo. È l'estensione naturale — la proposal la nomina
in §1 — ma è **una migrazione e un'altra decisione**: due colonne per pagina, o un'entità
`SeoPagina`, e la scelta fra le due dipende da se un giorno le pagine diventeranno dati. Fuori
scope, dichiarata in [Open Questions](#open-questions).

---

<a id="d11"></a>
### D11 — Lo stato di pubblicazione è la **prima riga**, e la conferma scatta solo quando serve

**Il vincolo verificato.** `PublicController.TestiDa` (righe 453-464) decide che una sezione è
assente **solo in base al corpo del testo**: `Storia` è `null` se `StoriaTesto` è vuoto, un titolo
da solo non basta. `rotte.ts:43,49` fa sparire `/aperitivo` e `/locale` da intestazione, piè di
pagina, 404 e sitemap con lo stesso criterio.

**Choice.**
- La scheda dichiara lo stato **prima di ogni campo**, non in fondo e non come nota:
  *«Non pubblicata: manca il testo, e finché manca la pagina risponde 404 e non compare nel menu del
  sito.»*
- Alla sottomissione, **e solo** quando il valore letto dal server è non vuoto e quello nuovo è
  vuoto, si chiede conferma esplicita con `useConfirm` (già usato in
  [`ImpostazioniVetrinaPage.tsx:117-133`](../../../duedgusto/src/components/pages/sito/ImpostazioniVetrinaPage.tsx)):
  *«Salvando, la pagina “Il locale” sparisce dal sito e il suo indirizzo risponde “pagina non
  trovata”. Procedo?»*
- La condizione riguarda **due campi soli**, `StoriaTesto` e `AperitivoTesto`, ed è scritta accanto
  a loro. Estenderla a «ogni campo che si svuota» annegherebbe l'unico caso in cui svuotare cancella
  un URL, che è l'informazione da far passare.

⚠️ Il titolo **non** entra nella condizione, perché non entra nella regola del server: un
`aperitivoTitolo` svuotato non fa sparire la pagina. Una conferma che scattasse anche lì
insegnerebbe una regola falsa.

---

<a id="d12"></a>
### D12 — Seed: un helper invece del nono blocco copiato, e ciò che il seed **fa già oggi**

**Il vincolo.** [`SeedMenusSito.cs`](../../../backend/SeedData/SeedMenusSito.cs) è 226 righe con
**quattro blocchi quasi identici** (righe 83-114, 117-148, 154-185, 191-222). Aggiungerne cinque
porta il file a ~500 righe di codice fotocopiato, e nove copie della stessa idempotenza divergono al
primo bugfix applicato a una sola — che è, alla lettera, la ragione scritta nella docstring del file
per cui `UpdateMenuIfNeeded` è **riusata e non copiata** da `SeedMenus`.

**Choice.** Un helper locale, e i nove figli diventano nove chiamate:

```csharp
private static async Task<Menu> UpsertVoceSitoAsync(
    AppDbContext dbContext, Menu padre, IReadOnlyList<Ruolo> ruoli, Ruolo superAdmin,
    string titolo, string percorso, string icona, int posizione,
    string nomeVista, string percorsoFile)
```

Ordine risultante del sottomenu:

| Pos. | Titolo | Percorso | Icona | `PercorsoFile` |
|---|---|---|---|---|
| 1 | Home | `/gestionale/sito/pagine/home` | `House` | `sito/pagine/PaginaHome.tsx` |
| 2 | Menu | `/gestionale/sito/pagine/menu` | `UtensilsCrossed` | `sito/pagine/PaginaMenu.tsx` |
| 3 | Aperitivo | `/gestionale/sito/pagine/aperitivo` | `Martini` | `sito/pagine/PaginaAperitivo.tsx` |
| 4 | Il locale | `/gestionale/sito/pagine/locale` | `Armchair` | `sito/pagine/PaginaLocale.tsx` |
| 5 | Contatti | `/gestionale/sito/pagine/contatti` | `MapPin` | `sito/pagine/PaginaContatti.tsx` |
| 6 | Libreria media | `/gestionale/sito/media` *(invariato)* | `Images` | *(invariato)* |
| 7 | Prodotti vetrina | `/gestionale/sito/prodotti` *(invariato)* | `ShoppingBag` | *(invariato)* |
| 8 | Recensioni sito | `/gestionale/sito/recensioni` *(invariato)* | `Star` | *(invariato)* |
| 9 | Impostazioni sito | `/gestionale/sito/impostazioni` *(invariato)* | `Store` | *(invariato)* |

Le etichette delle cinque pagine sono **identiche** a quelle di
[`rotte.ts:36-52`](../../../sito/src/lib/rotte.ts) — è il punto: il pannello **rispecchia** l'unica
sorgente delle pagine invece di duplicarla. I **percorsi restano le chiavi di idempotenza**: le
quattro voci esistenti conservano il proprio, quindi il riordino non ne ricrea nessuna.

⚠️ **`Percorso` sotto `pagine/` e non direttamente sotto `sito/`**: `/gestionale/sito/media` esiste
già, e un `/gestionale/sito/menu` accanto sarebbe visivamente indistinguibile da una risorsa. Il
segmento dice a chi legge un URL di che genere di scheda si tratta.

⚠️ **Il caricamento dinamico copre già la sottocartella**: il glob è
`import.meta.glob("../components/pages/**/*.tsx")`
([`dynamicComponentLoader.tsx:9`](../../../duedgusto/src/routes/dynamicComponentLoader.tsx)), quindi
`sito/pagine/PaginaHome.tsx` si risolve senza toccare il router. **Nessuna modifica al routing
dinamico**: è la ragione per cui cinque voci non costano più di una.

🔴 **Correzione di fatto rispetto alla proposal (§7).** Il riordino **non è la prima volta** che si
usa `UpdateMenuIfNeeded` per riscrivere una posizione: `SeedMenus.UpdateMenuIfNeeded`
([righe 10-27](../../../backend/SeedData/SeedMenus.cs)) contiene
`if (menu.Posizione != posizione) { menu.Posizione = posizione; needsUpdate = true; }` e gira **a
ogni avvio**, su tutte le voci seedate. Un riordino manuale fatto dall'anagrafica menu su una voce
seedata **è già oggi** sovrascritto al riavvio successivo. Il rischio esiste, ma è preesistente e
non introdotto qui: la mitigazione resta la verifica su tre riavvii, non un meccanismo nuovo.

**Alternative considerata.** *Appendere le cinque pagine alle posizioni 5-9 senza toccare le
esistenti.* Costo zero sui dati vivi, ma metterebbe «Libreria media» prima di «Home», cioè
riproporrebbe l'ordinamento per entità che questo change esiste per rovesciare. Scartata: il valore
del change è l'ordine, non l'aggiunta.

---

<a id="d13"></a>
### D13 — Icone: cinque nuove, e il test che oggi **non esiste**

**Il vincolo.** [`getLazyIcon`](../../../duedgusto/src/components/layout/sideBar/getLazyIcon.tsx)
(righe 4-7) restituisce `undefined` per un nome sconosciuto: la voce compare **senza icona**, senza
alcun errore, e la cosa si nota solo guardando la barra. `iconMapping` ha **29** nomi e i cinque
adatti al ramo Sito (`Globe`, `Images`, `ShoppingBag`, `Store`, `Star`) sono tutti già impegnati.

**Choice.** Cinque nomi nuovi, **verificati esistenti** nella `lucide-react` installata:
`House`, `UtensilsCrossed`, `Martini`, `Armchair`, `MapPin`. Nessuno collide con i 29 esistenti
(`Menu` c'è già ma è l'hamburger di lucide, non il listino — ragione in più per non riusarlo per la
pagina Menu del sito).

🔴 **E un test che oggi non c'è.** Nessun file del repository verifica che le stringhe `Icona = "…"`
del seed esistano in `iconMapping`: le due liste sono tenute allineate a mano, e il commento alle
righe 65-67 di `iconMapping.tsx` lo dichiara come *«il prezzo di avere le voci a database»*. Il
prezzo si può smettere di pagare:

```ts
// duedgusto/src/components/layout/sideBar/__tests__/iconeDelSeed.test.tsx
// Legge i sorgenti del seed e pretende che ogni icona nominata esista nella mappa.
// 🔴 Un'icona mancante non produce alcun errore a runtime: la voce compare senza icona.
//    Questo test è l'unico punto in cui quel silenzio diventa rumore.
it("ogni icona nominata dal seed esiste in iconMapping", () => {
  // Tutti i sorgenti del seed, non un elenco scritto a mano: un file nuovo che nomina
  // un'icona deve entrare da solo, altrimenti il test copre ciò che copriva ieri.
  const sorgenti = readdirSync(resolve(RADICE_REPO, "backend/SeedData"))
    .filter((f) => f.endsWith(".cs"))
    .map((f) => readFileSync(resolve(RADICE_REPO, "backend/SeedData", f), "utf8"));
  const nominate = [...sorgenti.join("\n").matchAll(/Icona\s*=\s*"([^"]+)"|,\s*"([A-Z]\w+)",\s*true,/g)] …
  expect(nominate.length).toBeGreaterThan(20);           // la regex ha funzionato
  expect(nominate.filter((n) => !(n in iconMapping))).toEqual([]);
});
```

⚠️ Le icone compaiono nel seed in **due posizioni sintattiche**: come inizializzatore di oggetto
(`Icona = "Globe"`) e come **terzo argomento posizionale** di `UpdateMenuIfNeeded(menu, titolo,
percorso, icona, …)`. La regex deve coprirle entrambe, e l'asserzione sul conteggio è ciò che rivela
se ne ha persa una.

---

<a id="d14"></a>
### D14 — Gli orari: lo sbarramento passa da **uno** a **quattro** input, per costruzione

**Il vincolo da rispettare, alla lettera.** Gli orari vivono in `BusinessSettings` e hanno una sola
sorgente ([`PublicController.cs:387-398`](../../../backend/Controllers/PublicController.cs)).
Sono letti dalla home, da `/contatti` e dal piè di pagina di ogni pagina: **tre schede** avrebbero
un motivo plausibile per offrirli.

**Choice — nessun meccanismo nuovo, il meccanismo esistente moltiplicato per quattro.**

1. **Il modello non li possiede** — invariato.
2. **Nessuno dei quattro input li accetta**: `openingTime`, `closingTime`, `operatingDays`,
   `timezone` non sono proprietà di nessuna delle quattro classi, quindi il rifiuto arriva dalla
   **validazione dello schema**, prima del resolver.
3. **Il test enumerativo si estende.** Oggi
   [`ImpostazioniVetrinaTests.cs:386-418`](../../../backend/DuedGusto.Tests/Integration/GraphQL/ImpostazioniVetrinaTests.cs)
   è una `[Theory]` su **una** mutation × 6 campi vietati. Diventa una `[Theory]` su **quattro**
   mutation × gli stessi campi: 24 casi, generati, non copiati.
4. **Le schede li mostrano in sola lettura**, con il collegamento a `/gestionale/settings`, come già
   fa la pagina attuale ([`ImpostazioniVetrinaPage.tsx:578-590`](../../../duedgusto/src/components/pages/sito/ImpostazioniVetrinaPage.tsx)).
   Il test di pagina *«non mostra alcun campo di orario e indica dove si modificano»* (riga 200) si
   replica su **ognuna** delle schede che li mostra — Home, Contatti, Impostazioni sito.

**Rationale.** Il vincolo è già garantito a tre livelli e il rischio di questo change non è che
qualcuno lo violi di proposito: è che una scheda nuova, scritta fra sei mesi, non erediti la
protezione perché la protezione era pinnata **su una mutation nominata**. Rendere la `[Theory]`
enumerativa sulle quattro mutation è ciò che fa ereditare la copertura a chi arriva dopo.

---

<a id="d15"></a>
### D15 — Divergenze dichiarate rispetto alla proposal

Cinque, verificate sui file reali. Sono dichiarate, non nascoste.

1. 🔴 **I campi scrivibili sono 30, non 31.** Contando l'elenco letterale di
   `ImpostazioniVetrinaInput_HaEsattamenteICampiScrivibili`
   ([righe 429-446](../../../backend/DuedGusto.Tests/Integration/GraphQL/ImpostazioniVetrinaTests.cs))
   e le proprietà di `ImpostazioniVetrinaInput` si ottiene **30** in entrambi i casi, e altrettanto
   contando le chiavi di `ValoriImpostazioniVetrina`. Il *«soltanto dieci sono specifici di una
   pagina»* della proposal è invece **esatto** (4 home + 2 locale + 4 aperitivo). Il numero compare
   sette volte nella proposal e va corretto, perché è il numero su cui il test di partizione
   asserisce.
2. **Il riordino del seed non è una capacità nuova.** `UpdateMenuIfNeeded` riscrive `Posizione` a
   ogni avvio già oggi ([D12](#d12)): il rischio sui dati vivi è preesistente, non introdotto.
3. 🔴 **Ridurre `mutateImpostazioniVetrina` da 30 a 20 campi è una modifica breaking dello schema**,
   quindi il rollback descritto al §3 del piano — *«tornare all'input unico è additivo
   all'incontrario perché i campi non cambiano nome»* — è vero sui **nomi** e falso sulla
   **forma**: il ripristino richiede di riespandere l'input, e va fatto **prima** del revert del
   frontend, non dopo.
4. **La scheda «Impostazioni sito» non viene rinominata.** La proposal la vuole *«rinominata di
   conseguenza»*; dopo la riduzione contiene identità, indirizzo, contatti, social, SEO di default,
   aspetto e ganci spenti — cioè esattamente ciò che «Impostazioni sito» già descrive. Un rename
   costerebbe una riga e non comprerebbe nulla, e il `Percorso` deve comunque restare invariato
   perché è la chiave di idempotenza del seed.
5. **`/api/public/galleria` cambia, `/api/public/site` no.** La proposal prevedeva gli slot nel DTO
   di `site` (tabella «Affected Areas»). La rotta scelta è `galleria`, per le ragioni di
   [D6](#d6) — è quella che le quattro pagine già chiamano, e `contatti.astro` legge `site` **senza**
   leggere la galleria.

---

## Data Flow

**Scrittura — la partizione, vista da sopra.** Quattro percorsi che non si incrociano mai, e
un'unica riga a database che nessuno dei quattro scrive per intero.

```
   Scheda Home          Scheda Il locale      Scheda Aperitivo     Scheda Impostazioni
        │                      │                     │                     │
  mutatePaginaHome    mutatePaginaLocale   mutatePaginaAperitivo  mutateImpostazioniVetrina
   PaginaHomeInput     PaginaLocaleInput    PaginaAperitivoInput  ImpostazioniVetrinaInput
      (4 + 1)               (2 + 1)               (4 + 1)               (20)
        │                      │                     │                     │
        └──────────┬───────────┴──────────┬──────────┴──────────┬──────────┘
                   │   GuardAmministratore │  (prima istruzione)│
                   └───────────────────────┴────────────────────┘
                                       │
                        CaricaOCreaSingletonAsync   ← sede unica dell'upsert
                                       │
                    ┌──────────────────┴───────────────────┐
                    │  ImpostazioniVetrina (IdSingleton=1) │
                    └──────────────────────────────────────┘
                      🔴 33 colonne, 4 scrittori, 0 sovrapposizioni
                         (verificato da riflessione: D3 ②)

   Le schede Menu e Contatti non compaiono: non scrivono nulla (D10).
```

**Lettura — la regola dei ruoli, prima e dopo.** Il guasto che sparisce è la freccia che oggi va
dalla galleria a quattro file diversi con quattro aritmetiche diverse.

```
  PRIMA                                  DOPO
  ─────                                  ────
  GET /api/public/galleria               GET /api/public/galleria
        │  { immagini: [...] }                 │  { immagini: [...], ruoli: {...} }
        ├──→ index.astro    [0], slice(1,4)    │        ▲
        ├──→ menu.astro     slice(0,3)         │        │  RuoliImmaginiVetrina.Risolvi()
        ├──→ locale.astro   [1]??[0], slice(2,5)        │  ← slot + ripiego posizionale
        └──→ aperitivo.astro  .at(-1)          │        │     (sede UNICA della regola)
             🔴 quattro copie della regola     │        │
                                               ├──→ index.astro      ruoli.eroeHome / .grigliaHome
                                               ├──→ menu.astro       ruoli.fotoMenu
                                               ├──→ locale.astro     ruoli.ritrattoLocale / .quadrateLocale
                                               └──→ aperitivo.astro  ruoli.eroeAperitivo

                                         GraphQL  vetrina { ruoliImmagini { … origine } }
                                               ├──→ le cinque schede: «questa pagina usa queste N»
                                               └──→ MediaLibrary: il ruolo accanto a ogni immagine
```

**Il ciclo che l'utente vive**, che è poi la richiesta originale:

```
  Sito → Il locale
    ├─ ① «Pubblicata» / «Non pubblicata: manca il testo → 404 e sparisce dal menu»   (D11)
    ├─ ② «4 immagini: 1 ritratto scelto da te + 3 dalla galleria (3ª-5ª)»            (D5)
    ├─ ③ testi DI PROPRIETÀ: Titolo, Testo                          → modificabili   (D2)
    └─ ④ testi EREDITATI: insegna, indirizzo, orari                 → sola lettura + link
```

---

## File Changes

| File | Azione | Descrizione |
|---|---|---|
| `backend/Models/ImpostazioniVetrina.cs` | Modifica | +3 slot immagine (`ImmagineEroeHomeId`, `ImmagineRitrattoLocaleId`, `ImmagineEroeAperitivoId`) + 3 navigazioni, sul modello di `ImmagineOgId` |
| `backend/DataAccess/AppDbContext.cs` | Modifica | 3 `HasOne(...).WithMany()` con `Restrict`, **senza navigazione inversa** |
| `backend/Migrations/*_SlotImmaginiPagineVetrina.cs` | Nuovo | Additiva, puro DDL. Procedura in [D8](#d8) — **non generata in fase di design** |
| `backend/Services/Vetrina/RuoliImmaginiVetrina.cs` | Nuovo | 🔴 Sede unica della risoluzione ruolo→immagine. Logica pura, senza `DbContext` |
| `backend/Services/Vetrina/MappaPagineVetrina.cs` | Nuovo | 🔴 Sede unica della mappa pagina → campo → percorso DTO. Forma vincolata dal test del sito ([D9](#d9)) |
| `backend/GraphQL/Vetrina/VetrinaMutations.cs` | Modifica | +3 resolver e +3 `Applica…Async`; `ApplicaImpostazioniVetrinaAsync` ridotta a 20 campi; `CaricaOCreaSingletonAsync` estratto; `EliminaMediaAssetAsync` con 4 referenti ([D7](#d7)) |
| `backend/GraphQL/Vetrina/Types/ImpostazioniVetrinaInputType.cs` | Modifica | Ridotto a 20 campi |
| `backend/GraphQL/Vetrina/Types/PaginaHomeInputType.cs` | Nuovo | 4 campi + `immagineEroeHomeId` |
| `backend/GraphQL/Vetrina/Types/PaginaLocaleInputType.cs` | Nuovo | 2 campi + `immagineRitrattoLocaleId` |
| `backend/GraphQL/Vetrina/Types/PaginaAperitivoInputType.cs` | Nuovo | 4 campi + `immagineEroeAperitivoId` |
| `backend/GraphQL/Vetrina/Types/ImpostazioniVetrinaType.cs` | Modifica | +3 slot in lettura (il tipo di output resta unico) |
| `backend/GraphQL/Vetrina/VetrinaQueries.cs` | Modifica | +`ruoliImmagini`, +`mappaPagine`, entrambi dietro `GuardAmministratore` |
| `backend/Controllers/PublicController.cs` | Modifica | La galleria compone `Ruoli` da `RuoliImmaginiVetrina`; nessun altro cambio |
| `backend/Controllers/Public/Dto/GalleriaPubblicaDto.cs` | Modifica | +`Ruoli`; +`RuoliImmaginiDto` (riusa `ImmaginePubblicaDto`) |
| `backend/SeedData/SeedMenusSito.cs` | Riscrittura | `UpsertVoceSitoAsync` + 9 chiamate al posto di 4 blocchi copiati; riordino ([D12](#d12)) |
| `backend/DuedGusto.Tests/**` | Modifica + Nuovi | Vedi [Testing Strategy](#testing-strategy) |
| `duedgusto/src/@types/vetrina.d.ts` | Modifica | `ImpostazioniVetrinaInput` ridotto; +3 tipi input; +`RuoliImmagini`, +`MappaPagine` |
| `duedgusto/src/components/pages/sito/proprietaCampiVetrina.tsx` | Nuovo | 🔴 `PROPRIETA_CAMPI: Record<keyof CampiScrivibiliVetrina, SchedaSito>` ([D3](#d3) ①) |
| `duedgusto/src/components/pages/sito/impostazioniVetrinaModulo.tsx` | Modifica | Si divide in 4 gruppi; il `superRefine` incrociato si spezza in due ([D2](#d2)) |
| `duedgusto/src/components/pages/sito/ImpostazioniVetrinaPage.tsx` | Modifica | Ridotta ai 20 campi trasversali; 5 sezioni editoriali migrano nelle schede |
| `duedgusto/src/components/pages/sito/pagine/SchedaPagina.tsx` | Nuovo | Il guscio condiviso: stato, immagini, testi propri, testi ereditati |
| `duedgusto/src/components/pages/sito/pagine/Pagina{Home,Menu,Aperitivo,Locale,Contatti}.tsx` | Nuovi | Le cinque schede. `PaginaMenu` e `PaginaContatti` senza modulo ([D10](#d10)) |
| `duedgusto/src/components/pages/sito/MediaLibrary.tsx` | Modifica | Ruoli attivi accanto a ogni immagine della galleria, da `vetrina { ruoliImmagini }` |
| `duedgusto/src/components/layout/sideBar/iconMapping.tsx` | Modifica | +5 icone ([D13](#d13)) |
| `duedgusto/src/graphql/vetrina/{queries,mutations,fragments}.tsx` | Modifica | 3 mutation nuove, 2 query nuove, fragment delle impostazioni ridotto |
| `sito/src/pages/{index,menu,locale,aperitivo}.astro` | Modifica | Lettura di `ruoli.*` al posto degli indici. `contatti.astro` **invariato** |
| `sito/src/lib/tipi.ts` | Modifica | `GalleriaPubblica` guadagna `ruoli` |
| `sito/src/lib/api.ts` | Modifica | `leggiGalleria` aggiunge `'ruoli'` alle chiavi riconosciute (riga 172-176) |
| `sito/src/lib/rotte.ts` | **Invariato** | 🔴 Resta la sorgente unica delle pagine: il pannello la rispecchia |
| `sito/test/mappa-pagine.test.mjs` | Nuovo | Verifica della mappa contro i `.astro` ([D9](#d9)) |
| `sito/test/immagini-ruoli.test.mjs` | Nuovo | Le stesse chiavi immagine di oggi, a slot vuoti |
| `openspec/specs/impostazioni-vetrina/`, `media-assets/`, `api-pubblica/`, `consumo-api-pubblica/` | Delta | Vedi la proposal, «Affected Areas» |

---

## Interfaces / Contracts

**GraphQL — mutation.** Quattro, disgiunte.

```graphql
type VetrinaMutations {
  mutateImpostazioniVetrina(input: ImpostazioniVetrinaInput!): ImpostazioniVetrina  # 20 campi
  mutatePaginaHome(input: PaginaHomeInput!): ImpostazioniVetrina
  mutatePaginaLocale(input: PaginaLocaleInput!): ImpostazioniVetrina
  mutatePaginaAperitivo(input: PaginaAperitivoInput!): ImpostazioniVetrina
}

input PaginaHomeInput {
  "Il paragrafo sotto il titolo della home. Vuoto: la home mostra solo il titolo."
  claimVetrina: String
  "🔴 Da 1 a 5, insieme a numeroRecensioniGoogle o nessuno dei due."
  punteggioGoogle: Decimal
  numeroRecensioniGoogle: Int
  urlProfiloGoogle: String
  "Vuoto: la home usa la prima immagine della galleria, e cambia se la galleria cambia."
  immagineEroeHomeId: Int
}

input PaginaLocaleInput {
  storiaTitolo: String
  "🔴 Vuoto: la pagina «Il locale» risponde 404 e sparisce dalla navigazione del sito."
  storiaTesto: String
  immagineRitrattoLocaleId: Int
}

input PaginaAperitivoInput {
  aperitivoTitolo: String
  "🔴 Vuoto: la pagina «Aperitivo» risponde 404 e sparisce dalla navigazione del sito."
  aperitivoTesto: String
  aperitivoPunti: String       # una voce per riga, al massimo sei pubblicate
  aperitivoCategorie: String   # una per riga, col nome esatto della categoria di vetrina
  immagineEroeAperitivoId: Int
}
```

⚠️ **Il tipo di ritorno resta `ImpostazioniVetrina`, uno solo.** La divisione è nella **scrittura**,
non nella lettura: dividere anche il tipo di output significherebbe quattro fragment, quattro
refetch e quattro copie in cache della stessa riga.

**GraphQL — query.**

```graphql
type VetrinaQueries {
  impostazioni: ImpostazioniVetrina        # invariata, +3 slot in lettura
  recensioni: [RecensioneVetrina]          # invariata
  ruoliImmagini: RuoliImmaginiVetrina      # nuova: chi ricopre cosa, e se per scelta o per posizione
  mappaPagine: [VocePagina]                # nuova: la mappa di D9, servita al pannello
}

enum OrigineRuolo { SLOT, POSIZIONE }
```

**REST pubblico.** Solo `/api/public/galleria` cambia, e in modo **additivo**:

```jsonc
GET /api/public/galleria      // Cache-Control: public,max-age=300 — invariato
{
  "immagini": [ /* …invariato, contratto pinnato dalla spec api-pubblica… */ ],
  "ruoli": {
    "eroeHome":       { /* immagine */ } | null,
    "grigliaHome":    [ /* ≤3 immagini */ ],
    "fotoMenu":       [ /* ≤3 */ ],
    "ritrattoLocale": { /* immagine */ } | null,
    "quadrateLocale": [ /* ≤3 */ ],
    "eroeAperitivo":  { /* immagine */ } | null
  }
}
```

**C# — la funzione che porta il peso.**

```csharp
public sealed record PianoImmagini(
    MediaAsset? EroeHome,       IReadOnlyList<MediaAsset> GrigliaHome,
    IReadOnlyList<MediaAsset> FotoMenu,
    MediaAsset? RitrattoLocale, IReadOnlyList<MediaAsset> QuadrateLocale,
    MediaAsset? EroeAperitivo,
    OrigineRuolo OrigineEroeHome, OrigineRuolo OrigineRitrattoLocale,
    OrigineRuolo OrigineEroeAperitivo);
```

---

<a id="testing-strategy"></a>
## Testing Strategy

| Livello | Cosa | Come | 🔴 |
|---|---|---|---|
| Unit (C#) | `RuoliImmaginiVetrina.Risolvi` | Matrice su gallerie da **0, 1, 2, 3, 5, 6** immagini × slot valorizzati/vuoti. **L'asserzione portante**: a slot tutti vuoti il piano coincide, chiave per chiave, con gli indici di oggi (`[0]`; `[1..4)`; `[0..3)`; `[1]??[0]`; `[2..5)`; `.at(-1)`) | 🔴 |
| Unit (C#) | La finestra salta i ruoli singoli | Con `EroeHome` = 3ª immagine, `GrigliaHome` non la contiene e ha comunque 3 elementi | |
| Unit (C#) | Partizione | Unione degli input = proprietà scrivibili del modello meno `NonScrivibiliDaGraphQL`; intersezione a coppie = ∅. **Verifica per mutazione**: togliendo un campo da un input il test nomina l'orfano | 🔴 |
| Integrazione (C#) | Nessun azzeramento incrociato | Per **ognuna** delle 4 mutation: si semina la riga con tutti i 33 campi a valori non di default, si salva la scheda, si asserisce che **ogni** campo fuori dal gruppo è invariato. Parametrizzato sulla definizione dei gruppi, non copiato quattro volte | 🔴 |
| Integrazione (C#) | Lo svuotamento continua a funzionare | `Mutation_ConUnCampoOpzionaleSvuotato_PersisteLAssenza` passa **senza modifiche di sostanza**, + un caso equivalente per ognuna delle 3 mutation nuove | 🔴 |
| Integrazione (C#) | Gli orari restano fuori | La `[Theory]` di oggi diventa 4 mutation × 6 campi vietati = 24 casi generati ([D14](#d14)) | 🔴 |
| Integrazione (C#) | Privilegi | Utente autenticato **non** amministratore respinto su tutte e 4 le mutation e sulle 2 query nuove. ⚠️ L'anonimo **non** richiede test nuovi ma per una ragione precisa: le `[Theory]` di `AutorizzazioneAnonimaTests` enumerano i **rami root** (`vetrina`), non i singoli campi, e il ramo porta già `this.Authorize()` di tipo — che copre ogni campo, compresi quelli nati oggi. Nessun ramo root nuovo, quindi `SchemaEspone_TuttiIRamiRootAttesi` resta verde | |
| Integrazione (C#) | Eliminazione media | `[Theory]` sui 4 slot: il rifiuto nomina il ruolo **e i file sono ancora sul filesystem**. La seconda asserzione è quella che conta ([D7](#d7)) | 🔴 |
| Unit (C#) | Superficie pubblica | `SuperficiePubblicaTests` attraversa `RuoliImmaginiDto` **senza modifiche** (BFS ricorsiva); `PublicControllerTests:611` resta verde | |
| Compilazione (TS) | Totalità della partizione | `Record<keyof CampiScrivibiliVetrina, SchedaSito>`: un campo non assegnato **non compila**. `npm run ts:check` in CI | 🔴 |
| Unit (TS) | Unione e disgiunzione a valle | Le 4 `inputDa…` producono insieme esattamente `CAMPI_SCRIVIBILI`, senza ripetizioni. **Scritto e visto fallire prima della divisione** ([D4](#d4)) | 🔴 |
| Unit (TS) | Icone del seed | Legge i sorgenti di `backend/SeedData/*.cs` e pretende che ogni `Icona` esista in `iconMapping`; asserisce anche il **conteggio** delle icone trovate ([D13](#d13)) | 🔴 |
| Componente (TS) | Nessun campo di orario | Replicato su Home, Contatti e Impostazioni sito: nessun `getByLabelText(/apertura|chiusura|fuso/)`, e il collegamento alle impostazioni della cassa presente | 🔴 |
| Componente (TS) | Stato in prima riga + conferma | Su Locale e Aperitivo: con il testo pieno lo stato dice «Pubblicata»; svuotandolo e salvando, `useConfirm` viene invocato **e** senza conferma nessuna mutation parte | 🔴 |
| Componente (TS) | Le schede senza modulo | `PaginaMenu` e `PaginaContatti` non rendono alcun pulsante «Salva» e non montano `Formik` | |
| Sito (node) | La mappa non mente | `mappa-pagine.test.mjs`: voci parsate ≥ N, ogni `sito.<percorso>` letto dai `.astro` è dichiarato, ogni voce dichiarata è letta ([D9](#d9)) | 🔴 |
| Sito (node) | Il sito non cambia | `immagini-ruoli.test.mjs`: con la galleria di prova e slot vuoti, `/`, `/menu`, `/locale`, `/aperitivo` rendono **le stesse chiavi** di prima del change | 🔴 |
| Sito (node) | Regressioni | `navigazione.test.mjs`, `menu.test.mjs:157`, `prefissi.test.mjs:50` restano verdi senza modifiche | |
| Manuale | Seed idempotente | Tre riavvii con `SEED_ON_STARTUP=true`: nessuna voce duplicata, `Posizione` 1-9 come da [D12](#d12), nessuna voce senza icona nella barra | |

⚠️ **Lacuna che questo change chiude e che va detta**: nessun test copre oggi l'indicizzazione della
galleria con 0, 1 o 2 immagini. Con una sola immagine caricata, **la stessa foto compare su tutte e
quattro le pagine** ed è contemporaneamente eroe della home, ritratto del locale ed eroe
dell'aperitivo. La copertura arriva al livello unitario di `RuoliImmaginiVetrina` — più preciso e
più economico che al livello Astro.

---

## Migration / Rollout

**Ordine di consegna**, e non è negoziabile ai punti 1 e 5:

1. 🔴 **La rete, con il modulo ancora intero** — `PROPRIETA_CAMPI`, `CAMPI_SCRIVIBILI`, il test
   riscritto e **visto fallire** ([D4](#d4)). Nessun comportamento cambia.
2. **`RuoliImmaginiVetrina` + i suoi test**, con gli slot che ancora non esistono (la funzione
   accetta `null` ovunque e produce il piano posizionale). Nessun comportamento cambia.
3. **Migrazione + slot + `EliminaMediaAssetAsync` a quattro referenti** ([D7](#d7), [D8](#d8)).
4. **`/api/public/galleria` guadagna `ruoli`; i quattro `.astro` lo leggono.** Il sito rende le
   stesse immagini: lo dimostra `immagini-ruoli.test.mjs`.
5. 🔴 **La partizione della scrittura** — 3 mutation nuove + `mutateImpostazioniVetrina` ridotta.
   **Backend e frontend nello stesso deploy**: fra i due il frontend vecchio invierebbe 30 campi a
   un input che ne accetta 20 e verrebbe **rifiutato dalla validazione dello schema** — rumoroso,
   non silenzioso, ma comunque un'interruzione.
6. **Le cinque schede, il seed, le icone** ([D12](#d12), [D13](#d13)).
7. **La mappa e la sua verifica** ([D9](#d9)).

**Rollback**, per punto e senza perdita di contenuti:

- **7 → 4**: revert puro, nessun dato coinvolto.
- **6**: `Visibile = false` sulle 5 voci nuove (o revoca di `AssegnaRuoli`) le fa sparire senza
  cancellare record; ripristinare le `Posizione` 1-4 delle esistenti riporta il sottomenu com'era;
  toglierle dal seed impedisce che rinascano al riavvio.
- 🔴 **5**: si torna all'input unico da 30 campi **prima** del revert del frontend, non dopo
  ([D15](#d15) punto 3).
- **3**: la migrazione è additiva e **lasciarla in produzione è innocuo**. ⚠️ Se qualcuno ha già
  usato gli slot, i valori vanno riportati nell'ordine della galleria **prima** del revert dei
  `.astro`, altrimenti la scelta editoriale si perde in silenzio. È l'**unico punto di non
  ritorno** del change.
- **Contenuti**: nessun rollback li tocca. Vivono nella riga singleton, che questo change non
  ricrea mai (`IdSingleton = 1`).

---

<a id="open-questions"></a>
## Open Questions

- [ ] 🔴 **L'etichetta «Menu» collide.** Il sottomenu diventerebbe «Sito → Menu», e il gestionale ha
      già una sezione «Menu» (anagrafica delle voci di navigazione,
      `components/pages/menu/MenuList.tsx`). [D12](#d12) sceglie di **tenere l'etichetta identica a
      `rotte.ts`**, perché rispecchiare il sito è il punto del change, e di disambiguare con
      l'annidamento e l'icona `UtensilsCrossed`. Se l'utente preferisce, l'alternativa è «Pagina
      Menu» — che però rompe la corrispondenza uno-a-uno con le etichette del sito.
- [ ] **Titolo e descrizione SEO per pagina.** `/menu` e `/contatti` non possiedono alcun testo, e
      la descrizione SEO di `/menu` è scritta a mano in `menu.astro:73`. È l'estensione naturale del
      change ed è **fuori scope** ([D10](#d10)): richiede due colonne per pagina o un'entità
      `SeoPagina`, e la scelta fra le due dipende da se le pagine diventeranno dati. Da decidere a
      parte.
- [ ] **Codegen dei tipi GraphQL per il frontend.** [D3](#d3) fa il meglio possibile senza, ma la
      doppia scrittura TS↔C# resta. Candidato dichiarato per un change dedicato: sarebbe un
      cambiamento di stack, non una correzione.
- [ ] **Conflitto di merge con `vetrina-redesign-mockup`.** Quel change tocca gli stessi quattro
      `.astro` (issue #14). Chi arriva secondo riscrive le letture della galleria nella forma di
      [D6](#d6); la sostituzione è meccanica ma va **fatta**, non assunta. Da coordinare prima del
      punto 4 del rollout.
- [ ] **Il ripiego dell'aperitivo resta `.at(-1)`**, cioè la regola peggiore delle sei, tenuta
      perché cambiarla violerebbe *«il sito non cambia comportamento a contenuti invariati»*.
      Se si accettasse una differenza visibile al primo deploy, `galleria[0]` sarebbe un ripiego
      migliore. Decisione dell'utente, non del design.
