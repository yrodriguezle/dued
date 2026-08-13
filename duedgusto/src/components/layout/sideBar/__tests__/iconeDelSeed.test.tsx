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

  it("le cinque icone delle pagine del sito sono distinte fra loro e dalle risorse della sezione", () => {
    // Due voci con la stessa icona nella navigazione sono indistinguibili: è la stessa regola
    // per cui «Impostazioni sito» non riusa `Settings`, già occupata dalla cassa.
    const dellaSezioneSito = ["House", "UtensilsCrossed", "Martini", "Armchair", "MapPin", "Images", "ShoppingBag", "Star", "Store"];

    expect(new Set(dellaSezioneSito).size).toBe(dellaSezioneSito.length);
    expect(dellaSezioneSito.filter((nome) => !(nome in iconMapping))).toEqual([]);

    // Le nove sono davvero quelle che il seed assegna alla sezione Sito, non un elenco a parte.
    const nelSeedDelSito = iconeNominateDalSeed()
      .filter((nominata) => nominata.file === "SeedMenusSito.cs")
      .map((nominata) => nominata.icona);
    expect([...new Set(nelSeedDelSito)].sort()).toEqual([...dellaSezioneSito, "Globe"].sort());
  });
});
