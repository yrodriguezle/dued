import { describe, it, expect } from "vitest";

import {
  ETICHETTE_PAGINE,
  PaginaSito,
  RUOLI_IMMAGINI,
  etichettaRuoloRicoperto,
  immaginiDelRuolo,
  occupatiDellaPagina,
  postiDelRuolo,
  postiDellaPagina,
  ruoliDellaPagina,
  ruoliDiUnImmagine,
} from "../ruoliPagine";

/**
 * La dichiarazione dei ruoli immagine è **una sola**, e la leggono due consumatori.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * 🔴 **Che cosa dimostra questo file.** Le cinque schede di pagina contano i posti immagine da
 *    `RUOLI_IMMAGINI`; la libreria media scrive da lì i ruoli accanto a ogni fotografia. Se
 *    fossero due elenchi, cambiando un ruolo se ne muoverebbe uno solo — la scheda direbbe «3
 *    foto» e la libreria ne segnerebbe due — e nessuno dei due segnalerebbe l'altro. Qui le due
 *    grandezze si calcolano dalle **due funzioni che i due consumatori usano davvero**
 *    (`occupatiDellaPagina` per le schede, `ruoliDiUnImmagine` per la libreria) e si pretende
 *    che coincidano.
 *
 * 🔴 **Capacità e riempimento sono grandezze diverse, e i test le separano.** «Quanti posti»
 *    non cambia mai; «quanti occupati» dipende da quante fotografie ci sono. Confonderle è il
 *    modo in cui un pannello finisce per promettere quattro immagini su una galleria che ne ha
 *    una.
 *
 * ⚠️ **L'autorità dei numeri attesi è ESTERNA alla dichiarazione**: la tabella delle capacità è
 *    scritta a mano qui, e il piano di prova è ricostruito con l'aritmetica che i quattro
 *    `.astro` usavano prima del change. Derivarli da `RUOLI_IMMAGINI` renderebbe questi test
 *    veri per costruzione, cioè inutili.
 * ─────────────────────────────────────────────────────────────────────────────────────────
 */

function foto(id: number): MediaAsset {
  return {
    mediaAssetId: id,
    chiave: `2026/08/foto-${id}`,
    nomeOriginale: `foto-${id}.jpg`,
    mimeType: "image/jpeg",
    larghezza: 1600,
    altezza: 1200,
    larghezzeDisponibili: [400, 800],
    cartella: "galleria",
    ordinamento: id,
    pubblicato: true,
    byteTotali: 1000,
    createdAt: "2026-08-13T00:00:00Z",
    updatedAt: "2026-08-13T00:00:00Z",
  };
}

function galleriaDa(quante: number): MediaAsset[] {
  return Array.from({ length: quante }, (_, indice) => foto(indice + 1));
}

/**
 * Il piano che il server produrrebbe **a slot vuoti**, ricostruito con gli indici che i `.astro`
 * usavano prima del change: `[0]`; `[1..4)`; `[0..3)`; `[1] ?? [0]`; `[2..5)`; e **niente** per
 * l'aperitivo, che è l'unico ruolo singolo senza ripiego.
 */
function pianoASlotVuoti(galleria: MediaAsset[], ampiezzaGriglia = 3): RuoliImmaginiVetrina {
  const eroeHome = galleria[0] ?? null;
  const ritratto = galleria[1] ?? galleria[0] ?? null;
  return {
    eroeHome: { mediaAssetId: eroeHome?.mediaAssetId ?? null, immagine: eroeHome, origine: "POSIZIONE" },
    grigliaHome: galleria.slice(1, 4),
    fotoMenu: galleria.slice(0, 3),
    ritrattoLocale: { mediaAssetId: ritratto?.mediaAssetId ?? null, immagine: ritratto, origine: "POSIZIONE" },
    quadrateLocale: galleria.slice(2, 5),
    eroeAperitivo: { mediaAssetId: null, immagine: null, origine: "POSIZIONE" },
    eroePiatto: { mediaAssetId: null, immagine: null, origine: "POSIZIONE" },
    // 🔴 L'ampiezza è un **parametro** del piano, non una costante del pannello: è il server a
    //    dichiararla, e questi test la variano proprio per dimostrare che il pannello la segue.
    ampiezzaGriglia,
  };
}

const PAGINE: PaginaSito[] = ["home", "menu", "aperitivo", "piatto", "locale", "contatti"];

describe("la dichiarazione dei ruoli immagine", () => {
  it("copre esattamente i sette ruoli che il server rende, né uno di più né uno di meno", () => {
    // Un ruolo nuovo sul server e non qui sarebbe invisibile al pannello: la scheda conterebbe
    // in difetto e la libreria non lo nominerebbe. Uno qui e non sul server sarebbe un posto
    // annunciato che non esiste.
    // ⚠️ `ampiezzaGriglia` non è un ruolo: è la **capacità** delle griglie, che il piano porta
    //    accanto ai sei ruoli perché quel numero abbia una sola scrittura. Va tolta dal
    //    confronto, non aggiunta alla dichiarazione.
    const nelPiano = Object.keys(pianoASlotVuoti(galleriaDa(6)))
      .filter((chiave) => chiave !== "ampiezzaGriglia")
      .sort();
    const dichiarati = RUOLI_IMMAGINI.map((ruolo) => ruolo.chiave).sort();
    expect(dichiarati).toEqual(nelPiano);
  });

  it("🔴 dichiara la CAPACITÀ di ogni pagina, e per «Contatti» dichiara zero", () => {
    // ⚠️ Numeri scritti a mano: è il «prima» contro cui la dichiarazione si misura.
    const piano = pianoASlotVuoti(galleriaDa(6));
    expect(Object.fromEntries(PAGINE.map((pagina) => [pagina, postiDellaPagina(pagina, piano)]))).toEqual({
      home: 4, // 1 in evidenza + 3 in griglia
      menu: 3, // in coda al listino
      aperitivo: 1, // in evidenza, senza ripiego
      piatto: 1, // la fotografia del piatto, senza ripiego
      locale: 4, // 1 ritratto + 3 quadrate
      contatti: 0, // 🔴 zero è una risposta, e va dichiarata
    });
  });

  it("🔴 la capacità delle griglie viene dal SERVER, non da una costante del pannello", () => {
    // È la prova che il numero è scritto **una volta sola**. Fino alla fase precedente il 3
    // viveva anche qui, e allargando la finestra sul server il sito avrebbe reso quattro
    // fotografie mentre la scheda continuava a dichiararne tre — con sicurezza e senza errori.
    // Adesso basta che il piano dica un altro numero perché la scheda lo segua.
    const piano = pianoASlotVuoti(galleriaDa(9), 4);
    expect(Object.fromEntries(PAGINE.map((pagina) => [pagina, postiDellaPagina(pagina, piano)]))).toEqual({
      home: 5, // 1 in evidenza + 4 in griglia
      menu: 4,
      aperitivo: 1, // un ruolo singolo resta uno: non dipende dalla finestra
      piatto: 1, // idem
      locale: 5,
      contatti: 0,
    });
  });

  it("senza il piano la capacità delle griglie NON si dichiara, e zero resta una risposta", () => {
    // 🔴 Un ripiego scritto qui («tanto è sempre 3») sarebbe la seconda scrittura reintrodotta
    //    dalla porta di servizio: meglio dire «non lo so ancora» che dire un numero non chiesto
    //    a nessuno. Le pagine senza griglie, invece, si conoscono comunque.
    expect(postiDellaPagina("home", null)).toBeNull();
    expect(postiDellaPagina("menu", null)).toBeNull();
    expect(postiDellaPagina("aperitivo", null)).toBe(1);
    expect(postiDellaPagina("piatto", null)).toBe(1);
    expect(postiDellaPagina("contatti", null)).toBe(0);
  });

  it("i ruoli singoli senza ripiego sono l'eroe dell'aperitivo e la fotografia del piatto", () => {
    // 🔴 Due, e per due ragioni diverse. L'aperitivo è l'unico punto in cui il sito mostra MENO
    //    di prima, ed è una decisione: il ripiego precedente («l'ultima foto della galleria»)
    //    faceva cambiare quell'immagine ogni volta che si caricava una foto qualsiasi, anche per
    //    un'altra pagina. Il piatto non ha mai avuto un ripiego e non deve averne: quella pagina
    //    promette UN piatto, e una foto per posizione ne mostrerebbe un altro.
    const singoliSenzaRipiego = RUOLI_IMMAGINI.filter((ruolo) => ruolo.singolo && ruolo.ripiego === null).map((ruolo) => ruolo.chiave);
    expect(singoliSenzaRipiego).toEqual(["eroeAperitivo", "eroePiatto"]);
  });

  it("nessun ruolo è dichiarato su due pagine", () => {
    const perPagina = PAGINE.flatMap((pagina) => ruoliDellaPagina(pagina).map((ruolo) => ruolo.chiave));
    expect(new Set(perPagina).size).toBe(perPagina.length);
    expect(perPagina.length).toBe(RUOLI_IMMAGINI.length);
  });
});

describe("capacità e riempimento sono grandezze diverse", () => {
  it("🔴 con UNA sola fotografia in galleria — lo stato della produzione — i posti restano quelli e gli occupati no", () => {
    const piano = pianoASlotVuoti(galleriaDa(1));

    // La capacità non si muove…
    expect(Object.fromEntries(PAGINE.map((pagina) => [pagina, postiDellaPagina(pagina, piano)]))).toEqual({ home: 4, menu: 3, aperitivo: 1, piatto: 1, locale: 4, contatti: 0 });

    // …il riempimento sì: la home dichiara 1 in evidenza e 0 in griglia.
    expect(Object.fromEntries(PAGINE.map((pagina) => [pagina, occupatiDellaPagina(piano, pagina)]))).toEqual({ home: 1, menu: 1, aperitivo: 0, piatto: 0, locale: 1, contatti: 0 });

    expect(immaginiDelRuolo(piano, RUOLI_IMMAGINI.find((ruolo) => ruolo.chiave === "grigliaHome")!)).toEqual([]);
  });

  it("🔴 quella stessa unica fotografia ricopre TRE ruoli, e la libreria li elenca tutti con il nome della pagina", () => {
    const piano = pianoASlotVuoti(galleriaDa(1));
    const ricoperti = ruoliDiUnImmagine(piano, 1);

    expect(ricoperti.map((ricoperto) => ricoperto.ruolo.chiave).sort()).toEqual(["eroeHome", "fotoMenu", "ritrattoLocale"]);
    // 🔴 Mai un numero di posizione: «la seconda foto» significa tre cose diverse su tre pagine,
    //    ed è esattamente il difetto che gli slot esistono per togliere.
    const etichette = ricoperti.map(etichettaRuoloRicoperto);
    expect(etichette.some((etichetta) => etichetta.startsWith(`${ETICHETTE_PAGINE.home}:`))).toBe(true);
    expect(etichette.some((etichetta) => etichetta.startsWith(`${ETICHETTE_PAGINE.menu}:`))).toBe(true);
    expect(etichette.some((etichetta) => etichetta.startsWith(`${ETICHETTE_PAGINE.locale}:`))).toBe(true);
    expect(etichette.some((etichetta) => /\b(prima|seconda|terza|ultima|\d+ª)\b/i.test(etichetta))).toBe(false);
  });

  it("🔴 il conteggio delle schede e i ruoli della libreria vengono dalla STESSA dichiarazione", () => {
    // Se fossero due elenchi, questi due numeri divergerebbero al primo ritocco di uno solo dei
    // due — e divergerebbero in silenzio.
    [0, 1, 2, 3, 5, 6].forEach((quante) => {
      const galleria = galleriaDa(quante);
      const piano = pianoASlotVuoti(galleria);

      // Il lato **libreria**: per ogni fotografia, i ruoli che ricopre.
      const dallaLibreria = galleria.flatMap((immagine) => ruoliDiUnImmagine(piano, immagine.mediaAssetId));

      PAGINE.forEach((pagina) => {
        const dallaLibreriaPerQuestaPagina = dallaLibreria.filter((ricoperto) => ricoperto.ruolo.pagina === pagina).length;
        // Il lato **scheda**: quante immagini la pagina mostra adesso.
        expect(occupatiDellaPagina(piano, pagina), `galleria da ${quante}: la scheda «${pagina}» e la libreria non contano la stessa cosa`).toBe(dallaLibreriaPerQuestaPagina);
      });
    });
  });

  it("il riempimento non supera mai la capacità dichiarata, per nessun ruolo", () => {
    // ⚠️ Restava, alla fase precedente, la sola rete sull'ampiezza scritta due volte. Adesso la
    //    scrittura è una sola e questo test verifica un'altra proprietà, non meno vera: che il
    //    piano non attribuisca a un ruolo più immagini di quante ne dichiari.
    [0, 1, 2, 3, 5, 6, 9].forEach((quante) => {
      const piano = pianoASlotVuoti(galleriaDa(quante));
      RUOLI_IMMAGINI.forEach((ruolo) => {
        expect(immaginiDelRuolo(piano, ruolo).length, `galleria da ${quante}: il ruolo «${ruolo.chiave}» rende più immagini dei posti dichiarati`).toBeLessThanOrEqual(postiDelRuolo(ruolo, piano)!);
      });
    });
  });

  it("la pagina «Contatti» non ha alcun ruolo, e nessuna fotografia può finirci", () => {
    const piano = pianoASlotVuoti(galleriaDa(6));
    expect(ruoliDellaPagina("contatti")).toEqual([]);
    expect(occupatiDellaPagina(piano, "contatti")).toBe(0);
    expect(ruoliDiUnImmagine(piano, 1).some((ricoperto) => ricoperto.ruolo.pagina === "contatti")).toBe(false);
  });
});

describe("scelta e posizione si distinguono", () => {
  it("uno slot valorizzato si dichiara «scelto», un ripiego posizionale no", () => {
    const galleria = galleriaDa(6);
    const piano = pianoASlotVuoti(galleria);
    const scelto: RuoliImmaginiVetrina = {
      ...piano,
      eroeHome: { mediaAssetId: 3, immagine: galleria[2], origine: "SLOT" },
    };

    expect(ruoliDiUnImmagine(scelto, 3).find((ricoperto) => ricoperto.ruolo.chiave === "eroeHome")?.scelto).toBe(true);
    // La stessa foto, senza scelta: il ruolo c'è ma è dovuto alla posizione, e cambierà.
    expect(ruoliDiUnImmagine(piano, 1).find((ricoperto) => ricoperto.ruolo.chiave === "eroeHome")?.scelto).toBe(false);
  });
});
