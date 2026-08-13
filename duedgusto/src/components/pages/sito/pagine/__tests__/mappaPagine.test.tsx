import { describe, it, expect } from "vitest";

import { DESTINAZIONI, PAGINA_MAPPA, chiaveDelCampo, testiDellaPagina, valoreDellaVoce } from "../mappaPagine";

/**
 * Il pannello e la mappa del server parlano la **stessa lingua**, e la proprietà dei campi è
 * onorata dai moduli.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * 🔴 **Le due divergenze che questo file rende rumorose, e che nient'altro vedrebbe.**
 *
 *    ① I due enum vivono in C# e le due union in TypeScript. Aggiungere un valore in C# —
 *       una sesta pagina, una settima sede in cui si modifica un valore — non produce alcun
 *       errore di compilazione qui: `DESTINAZIONI[voce.scheda]` diventerebbe `undefined` e la
 *       scheda **esploderebbe a runtime**, o peggio mostrerebbe un collegamento vuoto. Non è un
 *       caso teorico: è il modo normale in cui questo repository fa crescere un enum, perché i
 *       tipi TypeScript sono scritti a mano per tutti i domini.
 *
 *    ② La mappa dice quali campi una scheda **possiede**; il modulo di quella scheda è scritto a
 *       mano, campo per campo. Un campo dichiarato di proprietà e senza alcun campo nel modulo
 *       sarebbe **invisibile**: la mappa lo elencherebbe fra i testi «che si modificano qui», e
 *       lì non ci sarebbe niente da modificare. È il verso che la fase precedente non copriva —
 *       i testi *ereditati* vengono dalla mappa, quelli *propri* no, perché un modulo non si
 *       genera da un elenco di nomi.
 *
 * ⚠️ Si legge il sorgente C# con `import.meta.glob(..., '?raw')`, l'idioma già usato da
 *    `iconeDelSeed.test.tsx`: il gestionale non ha `@types/node`, quindi `node:fs` non
 *    compilerebbe sotto `ts:check`. E come là, si asserisce **quanto** si è trovato: una regex
 *    che smette di riconoscere la forma del file renderebbe questi test ciechi invece che rossi.
 * ─────────────────────────────────────────────────────────────────────────────────────────
 */

const SORGENTE_MAPPA = import.meta.glob("../../../../../../../backend/Services/Vetrina/MappaPagineVetrina.cs", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

const SORGENTI_SCHEDE = import.meta.glob("../Pagina*.tsx", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

function sorgenteMappa(): string {
  const testi = Object.values(SORGENTE_MAPPA);
  expect(testi, "MappaPagineVetrina.cs non è stato letto: il percorso del glob non punta più al file").toHaveLength(1);
  return testi[0];
}

/** I membri di un enum C#, dal blocco `public enum <nome> { … }`. */
function membriEnum(nome: string): string[] {
  const blocco = new RegExp(`public enum ${nome}\\s*\\{([^}]*)\\}`).exec(sorgenteMappa());
  expect(blocco, `il blocco «public enum ${nome}» non si trova più in MappaPagineVetrina.cs`).not.toBeNull();
  return [...blocco![1].matchAll(/^\s{4}(\w+),/gm)].map(([, membro]) => membro);
}

/** `ImpostazioniCassa` → `IMPOSTAZIONI_CASSA`: la conversione che GraphQL.NET applica agli enum. */
function costantePerGraphQL(pascal: string): string {
  return pascal.replace(/(?<!^)([A-Z])/g, "_$1").toUpperCase();
}

/**
 * Le voci dichiarate, con la stessa forma vincolata che legge il test del sito.
 *
 * ⚠️ `pagina` e `scheda` si normalizzano subito nella forma CONSTANT_CASE con cui viaggiano su
 *    GraphQL: confrontare `Home` con `HOME` non produce un errore, produce un test **vacuo** —
 *    nessuna voce corrisponde mai, il filtro resta vuoto e l'asserzione passa senza aver
 *    guardato niente. È successo alla prima stesura di questo file.
 */
function vociDellaMappa() {
  return [...sorgenteMappa().matchAll(/new\(PaginaVetrina\.(\w+),[ \t]*"([^"]+)",[ \t]*"([^"]+)",[ \t]*SchedaVetrina\.(\w+),/g)].map(([, pagina, campo, percorso, scheda]) => ({
    pagina: costantePerGraphQL(pagina),
    campo,
    percorso,
    scheda: costantePerGraphQL(scheda),
  }));
}

function sorgenteDellaScheda(nome: string): string {
  const trovato = Object.entries(SORGENTI_SCHEDE).find(([percorso]) => percorso.endsWith(`/${nome}.tsx`));
  expect(trovato, `il sorgente di ${nome}.tsx non è stato letto`).toBeTruthy();
  return trovato![1];
}

/** I nomi dei campi che un modulo espone davvero, letti dagli attributi `name="…"`. */
function campiDelModulo(nome: string): string[] {
  return [...sorgenteDellaScheda(nome).matchAll(/name="([A-Za-z0-9_]+)"/g)].map(([, campo]) => campo);
}

describe("il pannello e la mappa del server parlano la stessa lingua", () => {
  it("🔴 ogni pagina dell'enum C# ha una corrispondenza nel pannello", () => {
    const membri = membriEnum("PaginaVetrina");
    expect(membri.length, "l'enum PaginaVetrina non si legge più: questo test è CIECO invece che rosso").toBeGreaterThanOrEqual(6);

    // `CORNICE` non è una pagina del pannello — non ha una scheda — ma deve comunque essere un
    // valore che la union TypeScript conosce, altrimenti la scheda non saprebbe filtrarlo.
    const attesi = [...Object.values(PAGINA_MAPPA), "CORNICE"].sort();
    expect(membri.map(costantePerGraphQL).sort()).toEqual(attesi);
  });

  it("🔴 ogni sede dell'enum C# ha una destinazione nel pannello, con un indirizzo", () => {
    const membri = membriEnum("SchedaVetrina");
    expect(membri.length, "l'enum SchedaVetrina non si legge più: questo test è CIECO invece che rosso").toBeGreaterThanOrEqual(6);

    // 🔴 Una sede senza destinazione non è un errore di compilazione: è `undefined` a runtime,
    //    cioè una scheda che esplode o un collegamento che non porta da nessuna parte.
    expect(membri.map(costantePerGraphQL).sort()).toEqual(Object.keys(DESTINAZIONI).sort());

    Object.entries(DESTINAZIONI).forEach(([sede, destinazione]) => {
      expect(destinazione.percorso.startsWith("/gestionale/"), `la destinazione «${sede}» non punta a una pagina del gestionale`).toBe(true);
      expect(destinazione.etichetta.length).toBeGreaterThan(0);
    });
  });

  it("i nomi dei campi si traducono in chiavi del tipo TypeScript", () => {
    expect(chiaveDelCampo("InsegnaPubblica")).toBe("insegnaPubblica");
    expect(chiaveDelCampo("Via")).toBe("via");
    expect(chiaveDelCampo("ImmagineOgId")).toBe("immagineOgId");
  });
});

describe("🔴 la proprietà dichiarata dalla mappa è onorata dai moduli delle schede", () => {
  const MODULI: Record<string, string> = {
    HOME: "PaginaHome",
    LOCALE: "PaginaLocale",
    APERITIVO: "PaginaAperitivo",
  };

  it("ogni campo dichiarato «di proprietà» ha un campo nel modulo di quella scheda", () => {
    const voci = vociDellaMappa();
    expect(voci.length, "la scansione della mappa non trova più le voci: questo test è CIECO").toBeGreaterThan(50);

    const propri = Object.keys(MODULI).flatMap((sede) => voci.filter((voce) => voce.scheda === sede && voce.pagina === sede));

    // 🔴 Senza questa riga il test è **vacuo** e non rosso: se i nomi non corrispondessero — la
    //    mappa li scrive in PascalCase e GraphQL in CONSTANT_CASE — il filtro resterebbe vuoto e
    //    l'asserzione passerebbe senza aver guardato nulla. È successo alla prima stesura.
    expect(propri.length, "nessun campo «di proprietà» trovato: il confronto fra i nomi delle sedi non funziona più, e questo test non verifica niente").toBe(10);

    const mancanti = Object.entries(MODULI).flatMap(([sede, modulo]) => {
      const campi = campiDelModulo(modulo);
      return propri
        .filter((voce) => voce.scheda === sede)
        .map((voce) => chiaveDelCampo(voce.campo))
        .filter((chiave) => !campi.includes(chiave))
        .map((chiave) => `${modulo}: la mappa dichiara «${chiave}» modificabile qui, ma il modulo non ha quel campo`);
    });

    expect([...new Set(mancanti)], "un testo dichiarato «si modifica qui» e senza campo nel modulo è invisibile: la scheda lo elenca fra i propri e non c'è niente da compilare").toEqual([]);
  });

  it("nessuna scheda offre un campo che la mappa attribuisce a un'altra sede", () => {
    // 🔴 È il verso opposto, e ha una conseguenza peggiore: due schede che scrivono lo stesso
    //    testo sono due verità, e vince l'ultima che salva. La partizione lo impedisce già sul
    //    server; qui si verifica che il **modulo** non prometta ciò che la mutation rifiuterebbe.
    const voci = vociDellaMappa();

    const intrusi = Object.entries(MODULI).flatMap(([sede, modulo]) => {
      const campi = campiDelModulo(modulo);
      return voci
        .filter((voce) => voce.scheda !== sede)
        .map((voce) => chiaveDelCampo(voce.campo))
        .filter((chiave) => campi.includes(chiave))
        .map((chiave) => `${modulo}: offre «${chiave}», che la mappa attribuisce a un'altra sede`);
    });

    expect([...new Set(intrusi)]).toEqual([]);
  });

  it("le due schede senza campi propri non hanno alcun campo nel modulo", () => {
    expect(campiDelModulo("PaginaMenu")).toEqual([]);
    expect(campiDelModulo("PaginaContatti")).toEqual([]);
  });
});

describe("la divisione in gruppi è derivata, non dichiarata", () => {
  const MAPPA: VocePaginaVetrina[] = [
    { pagina: "CORNICE", campo: "InsegnaPubblica", percorso: "insegna", scheda: "IMPOSTAZIONI", etichetta: "Insegna pubblica", nota: null },
    { pagina: "HOME", campo: "ClaimVetrina", percorso: "testi.claim", scheda: "HOME", etichetta: "Frase sotto il titolo", nota: null },
    { pagina: "HOME", campo: "AperitivoTesto", percorso: "testi.aperitivo.testo", scheda: "APERITIVO", etichetta: "Testo dell'aperitivo", nota: null },
    { pagina: "MENU", campo: "InsegnaPubblica", percorso: "insegna", scheda: "IMPOSTAZIONI", etichetta: "Insegna pubblica", nota: null },
  ];

  it("«di proprietà» significa che la scheda di questa pagina è anche la sede in cui si modifica", () => {
    const home = testiDellaPagina(MAPPA, "home");

    expect(home.propri.map((voce) => voce.campo)).toEqual(["ClaimVetrina"]);
    // 🔴 Letto dalla home, POSSEDUTO dall'aperitivo: la regola non è «un campo, una pagina», è
    //    «un campo, un proprietario».
    expect(home.ereditati.map((voce) => voce.campo)).toEqual(["AperitivoTesto"]);
    expect(home.cornice.map((voce) => voce.campo)).toEqual(["InsegnaPubblica"]);
  });

  it("una scheda senza campi propri non ne inventa", () => {
    const menu = testiDellaPagina(MAPPA, "menu");

    expect(menu.propri).toEqual([]);
    expect(menu.ereditati.map((voce) => voce.campo)).toEqual(["InsegnaPubblica"]);
    expect(menu.cornice.map((voce) => voce.campo)).toEqual(["InsegnaPubblica"]);
  });

  it("un riferimento a un'immagine non si mostra come numero", () => {
    // Mostrare «12» accanto a «Immagine di anteprima social» sarebbe un dettaglio interno
    // spacciato per contenuto.
    const voce: VocePaginaVetrina = { pagina: "CORNICE", campo: "ImmagineOgId", percorso: "seo.immagineOg", scheda: "IMPOSTAZIONI", etichetta: "Immagine di anteprima social", nota: null };
    expect(valoreDellaVoce(voce, { immagineOgId: 12 } as unknown as ImpostazioniVetrina)).toBe("Scelta.");
    expect(valoreDellaVoce(voce, { immagineOgId: null } as unknown as ImpostazioniVetrina)).toBeNull();
  });
});
