import { describe, it, expect } from "vitest";

import { iconMapping } from "../iconMapping";

/**
 * Ogni icona che il seed nomina esiste davvero nella mappa del frontend.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * 🔴 **PERCHÉ QUESTO TEST ESISTE.** `getLazyIcon` restituisce `undefined` per un nome
 *    sconosciuto: la voce di menu compare **senza icona, senza alcun errore**, né a compilazione
 *    né a runtime né nei log. Le voci vivono a database e il seed le nomina come **stringhe**,
 *    quindi le due liste — i nomi in `backend/SeedData/*.cs` e le chiavi di `iconMapping.tsx` —
 *    sono tenute allineate a mano. Il guasto si scopre guardando la barra laterale, cioè mai.
 *    Questo test è l'unico punto in cui quel silenzio diventa rumore.
 *
 * ⚠️ **Si leggono TUTTI i sorgenti del seed, non un elenco scritto a mano.** Un file di seed
 *    nuovo che nomini un'icona deve entrare da solo: un elenco fisso coprirebbe ciò che
 *    copriva ieri, e il primo file aggiunto dopo passerebbe senza controllo.
 *
 * 🔴 **La modalità di guasto peggiore di un test di scansione è diventare CIECO, non rosso.**
 *    Se la regex smette di trovare le occorrenze — perché il seed cambia forma, o perché
 *    qualcuno ne semplifica un ramo — il test resta verde e rassicurante mentre non verifica
 *    più niente. Per questo qui si asserisce anche **quante** occorrenze si sono trovate, e che
 *    **entrambe** le forme sintattiche siano rappresentate.
 * ─────────────────────────────────────────────────────────────────────────────────────────
 */

/**
 * Tutti i sorgenti del seed, letti come testo.
 *
 * ⚠️ Si usa il glob di Vite e non `node:fs` per una ragione concreta: il progetto del
 *    gestionale non ha `@types/node` fra le dipendenze, quindi `node:fs` non compila sotto
 *    `npm run ts:check` — che è il controllo che gira in CI. Il glob è già l'idioma con cui
 *    questo repository legge sorgenti a tempo di build (`dynamicComponentLoader`), è tipizzato
 *    da `vite/client`, ed enumera la cartella da solo: un file di seed nuovo entra senza che
 *    nessuno debba ricordarsene.
 */
const SORGENTI_SEED = import.meta.glob("../../../../../../backend/SeedData/*.cs", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

/**
 * Le due forme sintattiche in cui un'icona compare nel seed.
 *
 * ⚠️ Sono davvero due, e vanno coperte entrambe:
 *   ① inizializzatore di oggetto — `Icona = "Globe"`, quando la voce viene creata;
 *   ② argomento posizionale — `…, "Globe", true, 9, …`, quando la voce esistente viene
 *      allineata da `UpdateMenuIfNeeded` o da `UpsertVoceSitoAsync`. Il `true` che segue è
 *      `visibile`, ed è ciò che distingue l'icona dagli altri argomenti stringa.
 *
 * Una voce nuova ha SEMPRE entrambe le forme, una per ramo dell'idempotenza: coprirne una sola
 * lascerebbe passare un nome sbagliato scritto nell'altro ramo — cioè quello che si esercita a
 * ogni riavvio, non solo alla prima installazione.
 */
const FORME = [
  { nome: "inizializzatore di oggetto", regex: /Icona\s*=\s*"([^"]+)"/g },
  { nome: "argomento posizionale", regex: /,\s*"([A-Z][A-Za-z0-9_]*)",\s*true,/g },
];

type IconaNominata = { file: string; icona: string; forma: string };

function iconeNominateDalSeed(): IconaNominata[] {
  return Object.entries(SORGENTI_SEED).flatMap(([percorso, sorgente]) => {
    const file = percorso.split("/").pop() ?? percorso;
    return FORME.flatMap((forma) => [...sorgente.matchAll(forma.regex)].map((trovata) => ({ file, icona: trovata[1], forma: forma.nome })));
  });
}

/**
 * Le stesse due forme, lette però come **coppie titolo → icona** invece che come occorrenze sciolte.
 *
 * ⚠️ Serve una scansione a parte, e non basta contare i nomi di `iconeNominateDalSeed`: ogni voce
 *    compare **due volte** nel seed, una per ramo dell'idempotenza (creazione + allineamento).
 *    Contare le occorrenze farebbe risultare duplicata *ogni* icona, e il test sarebbe rosso
 *    sempre — cioè inutile. L'unità di misura è la **voce di menu**, non l'occorrenza, e il
 *    `Titolo` è ciò che le dà un nome leggibile nel messaggio di errore.
 *
 * ⚠️ La forma ① usa un «tempered token» — `(?:(?!Titolo\s*=)[\s\S])*?` — e non un `[\s\S]*?`
 *    qualunque: fra `Titolo` e `Icona` ci sono commenti lunghi, ma **non** deve mai attraversare
 *    il `Titolo` della voce successiva. Senza quel freno, una voce con `Icona = string.Empty`
 *    (ce ne sono sei: i figli di Utenti, Ruoli e Menù) si accoppierebbe all'icona della voce
 *    *dopo*, e il test comincerebbe a lamentare collisioni inventate.
 *
 * ⚠️ La forma ② accetta `true|false` mentre `FORME` accetta il solo `true`: «Gestione ddt» è
 *    `Visibile = false` in sidebar ma compare comunque nella griglia di `MenuList.tsx`, con la
 *    sua icona. Escluderla vorrebbe dire non accorgersi di una collisione visibile a schermo.
 */
const FORME_ACCOPPIATE = [
  { nome: "inizializzatore di oggetto", regex: /Titolo\s*=\s*"([^"]+)"\s*,(?:(?!Titolo\s*=)[\s\S])*?Icona\s*=\s*"([^"]+)"/g },
  { nome: "argomento posizionale", regex: /"([^"]+)",\s*(?:"[^"]*"|null|string\.Empty),\s*"([A-Z][A-Za-z0-9_]*)",\s*(?:true|false),/g },
];

type VoceConIcona = { file: string; titolo: string; icona: string; forma: string };

function vociConIconaDalSeed(): VoceConIcona[] {
  return Object.entries(SORGENTI_SEED).flatMap(([percorso, sorgente]) => {
    const file = percorso.split("/").pop() ?? percorso;
    return FORME_ACCOPPIATE.flatMap((forma) => [...sorgente.matchAll(forma.regex)].map((trovata) => ({ file, titolo: trovata[1], icona: trovata[2], forma: forma.nome })));
  });
}

describe("le icone del seed", () => {
  it("🔴 ogni icona nominata dal seed esiste in iconMapping", () => {
    const nominate = iconeNominateDalSeed();

    // ① La scansione ha funzionato. Senza, un test che non trova più nulla è verde.
    expect(nominate.length, "la scansione dei sorgenti del seed non ha trovato quasi nulla: la regex non riconosce più la forma del seed, e questo test è CIECO invece che verde").toBeGreaterThan(20);

    // ② Entrambe le forme sintattiche sono rappresentate. Un ramo della regex che smette di
    //    trovare occorrenze è la stessa cecità, solo parziale — e la parte persa sarebbe
    //    proprio quella che gira a ogni riavvio.
    FORME.forEach((forma) => {
      expect(
        nominate.filter((nominata) => nominata.forma === forma.nome).length,
        `nessuna icona trovata nella forma «${forma.nome}»: quel ramo della scansione non copre più niente`
      ).toBeGreaterThan(0);
    });

    // ③ E finalmente la proprietà: nessun nome sconosciuto alla mappa.
    const mancanti = nominate.filter((nominata) => !(nominata.icona in iconMapping)).map((nominata) => `${nominata.file}: "${nominata.icona}" (${nominata.forma})`);
    expect(
      [...new Set(mancanti)],
      "icone nominate dal seed e assenti da iconMapping: la voce di menu comparirebbe SENZA ICONA e senza alcun errore. Aggiungerle a iconMapping.tsx nello stesso commit."
    ).toEqual([]);
  });

  /**
   * 🔴 **PERCHÉ QUESTO SECONDO TEST ESISTE.** Il primo verifica che un'icona *esista*; niente
   *    verificava che fosse *sua*. Due voci con lo stesso nome di icona passavano indisturbate, ed
   *    è così che «Vendita» e «Cassa» sono arrivate fino allo screenshot con lo stesso carrello.
   *
   * 🔴 **La severità scelta è l'unicità GLOBALE**, non l'unicità fra voci visibili insieme. La
   *    regola più permissiva sarebbe stata difendibile — `NestedList` tiene aperto **un solo**
   *    gruppo alla volta (`openIndex` è un indice singolo), quindi i figli di due padri diversi non
   *    sono mai a schermo insieme. Si è scelta la globale per tre ragioni, in ordine di peso:
   *
   *    ① **La voce spostata.** Una regola che guarda il padre cambia verdetto quando una voce viene
   *       *ri-appesa*. È esattamente ciò che è appena successo: l'icona di «Vendita» non l'ha
   *       toccata nessuno, è la voce a essere salita al primo livello — e la collisione è comparsa
   *       da sola, in un commit che di icone non parlava. Una regola che sarebbe stata verde prima
   *       della promozione e rossa dopo si accorge del guasto nel momento sbagliato: dopo che è
   *       stato introdotto, non quando l'icona è stata scelta.
   *    ② **A cassetto chiuso l'icona È la voce.** `NestedList` mette `opacity: 0` sulle etichette e
   *       smonta i figli (`Collapse in={isOpen && drawerOpen}` con `unmountOnExit`): restano i soli
   *       bottoni di primo livello, senza testo. Lì un'icona condivisa non rende due voci «simili»,
   *       le rende **lo stesso bottone**. Ed è il caso di Vendita/Cassa.
   *    ③ **La barra non è l'unico posto dove le icone si vedono insieme.** `MenuList.tsx` disegna
   *       tutte le voci in **una griglia piatta**, con la colonna «Icona» renderizzata da
   *       `IconFactory`: lì i duplicati stanno uno sotto l'altro qualunque sia il ramo.
   *
   *    Il costo dell'unicità globale è reale ma piccolo — `iconMapping` ha più chiavi delle voci che
   *    il seed nomina — e in cambio la regola non va ricalcolata ogni volta che l'albero cambia
   *    forma. Se un giorno le voci supereranno le icone disponibili, il modo giusto di allentarla è
   *    aggiungere un'icona alla mappa, non ammettere due voci che si somigliano.
   *
   * ⚠️ **Le voci SENZA icona non sono in collisione fra loro.** Sei voci (i figli di Utenti, Ruoli
   *    e Menù) hanno `Icona = string.Empty` e condividono il nulla: è una scelta preesistente e
   *    diversa — nessuna icona non è un'icona sbagliata, e la voce si legge dall'etichetta. Le
   *    regex non le raccolgono perché `string.Empty` non è un letterale fra virgolette, ed è
   *    voluto, non una svista.
   */
  it("🔴 due voci di menu non condividono la stessa icona", () => {
    const voci = vociConIconaDalSeed();

    // ① La scansione accoppiata ha funzionato. Vale qui la stessa paura del test sopra: una regex
    //    che non trova più niente non produce collisioni, e il verde sembra una promozione.
    expect(voci.length, "la scansione accoppiata titolo→icona non ha trovato quasi nulla: le regex non riconoscono più la forma del seed, e questo test è CIECO invece che verde").toBeGreaterThan(40);

    FORME_ACCOPPIATE.forEach((forma) => {
      expect(voci.filter((voce) => voce.forma === forma.nome).length, `nessuna coppia trovata nella forma «${forma.nome}»: quel ramo della scansione non copre più niente`).toBeGreaterThan(0);
    });

    // ② Le due scansioni si controllano a vicenda. Sono indipendenti e devono vedere le stesse
    //    icone: se una perde un ramo del seed, l'altra lo dice. È l'unica guardia che regge anche
    //    quando *entrambe* le forme di una scansione trovano ancora qualcosa, ma di meno.
    const daOccorrenze = [...new Set(iconeNominateDalSeed().map((nominata) => nominata.icona))].sort();
    const daCoppie = [...new Set(voci.map((voce) => voce.icona))].sort();
    expect(daCoppie, "le due scansioni del seed non vedono le stesse icone: una delle due ha smesso di coprire un ramo, e la differenza è ciò che non viene più controllato").toEqual(daOccorrenze);

    // ③ Ogni voce ha UNA icona sola. Se l'accoppiamento slittasse di una voce — il guasto naturale
    //    di una regex che salta un `Icona = string.Empty` — comincerebbe a produrre collisioni
    //    inventate: meglio fallire qui, dicendo che è rotto lo strumento, che là, accusando il seed.
    const iconePerVoce = new Map<string, Set<string>>();
    voci.forEach((voce) => iconePerVoce.set(voce.titolo, (iconePerVoce.get(voce.titolo) ?? new Set()).add(voce.icona)));
    const vociAmbigue = [...iconePerVoce].filter(([, icone]) => icone.size > 1).map(([titolo, icone]) => `${titolo}: ${[...icone].join(" / ")}`);
    expect(vociAmbigue, "una stessa voce risulta con due icone diverse: o i due rami dell'idempotenza del seed sono disallineati (la voce cambierebbe icona al riavvio), o l'accoppiamento titolo→icona di questo test è slittato").toEqual([]);

    // ④ E finalmente la proprietà: nessuna icona su più di una voce.
    const vociPerIcona = new Map<string, Set<string>>();
    voci.forEach((voce) => vociPerIcona.set(voce.icona, (vociPerIcona.get(voce.icona) ?? new Set()).add(voce.titolo)));
    const collisioni = [...vociPerIcona]
      .filter(([, titoli]) => titoli.size > 1)
      .map(([icona, titoli]) => `"${icona}" su ${[...titoli].sort().join(", ")}`)
      .sort();
    expect(collisioni, "due voci di menu condividono la stessa icona: a cassetto chiuso sono lo stesso bottone, e nella griglia di MenuList sono due righe indistinguibili. Cambiare l'icona della voce più RECENTE — quella che nessuno ha ancora imparato — scegliendone una già in iconMapping.tsx e non usata da alcuna voce.").toEqual([]);
  });

  it("le sei icone delle pagine del sito sono distinte fra loro e dalle risorse della sezione", () => {
    // Due voci con la stessa icona nella navigazione sono indistinguibili: è la stessa regola
    // per cui «Impostazioni sito» non riusa `Settings`, già occupata dalla cassa.
    const dellaSezioneSito = ["House", "UtensilsCrossed", "Martini", "ChefHat", "Armchair", "MapPin", "Images", "ShoppingBag", "Star", "Store"];

    expect(new Set(dellaSezioneSito).size).toBe(dellaSezioneSito.length);
    expect(dellaSezioneSito.filter((nome) => !(nome in iconMapping))).toEqual([]);

    // Le dieci sono davvero quelle che il seed assegna alla sezione Sito, non un elenco a parte.
    const nelSeedDelSito = iconeNominateDalSeed()
      .filter((nominata) => nominata.file === "SeedMenusSito.cs")
      .map((nominata) => nominata.icona);
    expect([...new Set(nelSeedDelSito)].sort()).toEqual([...dellaSezioneSito, "Globe"].sort());
  });
});
