import { coloreCategoria, coloreProdotto, indiciPerCategoria } from "../coloriProdotto";

/** Estrae i tre canali HSL da una stringa `hsl(h, s%, l%)`. */
const canali = (colore: string) => {
  const trovati = colore.match(/hsl\((-?\d+(?:\.\d+)?), (\d+(?:\.\d+)?)%, (\d+(?:\.\d+)?)%\)/);
  if (!trovati) {
    throw new Error(`colore non riconosciuto: ${colore}`);
  }
  return { tinta: Number(trovati[1]), saturazione: Number(trovati[2]), luminosita: Number(trovati[3]) };
};

const prodotto = (prodottoId: number, codice: string, categoria: string | null): ProdottoVendibile => ({
  prodottoId,
  codice,
  nome: codice,
  prezzo: 1,
  categoria,
  aliquotaIva: 10,
});

describe("coloreProdotto", () => {
  it("da alle categorie diverse tinte distanti", () => {
    const tinte = ["BRIOCHES", "CAFFETTERIA", "BIRRA", "VINO", "CUCINA", "BIBITE"].map(
      (nome) => canali(coloreProdotto(nome, 0, "light").banda).tinta
    );

    expect(new Set(tinte).size).toBe(tinte.length);
  });

  // ⚠️ Aperitivo (8°) e caffetteria (25°) sono i due piu vicini della mappa: se un giorno
  //    qualcuno li avvicina ancora, e qui che deve accorgersene.
  it("tiene aperitivo e caffetteria separati almeno dalla saturazione", () => {
    const aperitivo = canali(coloreProdotto("APERITIVO", 0, "light").banda);
    const caffetteria = canali(coloreProdotto("CAFFETTERIA", 0, "light").banda);

    expect(Math.abs(aperitivo.saturazione - caffetteria.saturazione)).toBeGreaterThanOrEqual(25);
  });

  it("resta nella famiglia della categoria al variare dell'articolo", () => {
    const primo = canali(coloreProdotto("BIRRA", 0, "light").banda);
    const quinto = canali(coloreProdotto("BIRRA", 5, "light").banda);

    // Lo scarto di tinta e +/-10 gradi: abbastanza per staccare due vicini, non tanto da far
    // sembrare la birra un'altra categoria.
    expect(Math.abs(primo.tinta - quinto.tinta)).toBeLessThanOrEqual(10);
    expect(primo.saturazione).toBe(quinto.saturazione);
  });

  it("non ripete il colore fra due articoli adiacenti", () => {
    const colori = Array.from({ length: 12 }, (_, indice) => coloreProdotto("CAFFETTERIA", indice, "light").banda);

    colori.forEach((colore, indice) => {
      if (indice > 0) {
        expect(colore).not.toBe(colori[indice - 1]);
      }
    });
  });

  // 🔴 Con 30 voci in CAFFETTERIA i 12 accostamenti si ripetono, ed e voluto: quello che conta
  //    e che la ripetizione cada lontano nella griglia, non che ogni voce sia unica.
  it("ricicla gli accostamenti con periodo 12", () => {
    expect(coloreProdotto("CAFFETTERIA", 0, "light")).toEqual(coloreProdotto("CAFFETTERIA", 12, "light"));
    expect(coloreProdotto("CAFFETTERIA", 3, "light")).not.toEqual(coloreProdotto("CAFFETTERIA", 6, "light"));
  });

  it("scurisce lo sfondo nel tema scuro e lo schiarisce nel chiaro", () => {
    const chiaro = canali(coloreProdotto("VINO", 0, "light").sfondo);
    const scuro = canali(coloreProdotto("VINO", 0, "dark").sfondo);

    expect(chiaro.luminosita).toBeGreaterThan(80);
    expect(scuro.luminosita).toBeLessThan(30);
  });

  it("tiene lo sfondo meno saturo della banda, per non mangiarsi il testo", () => {
    const { sfondo, banda } = coloreProdotto("APERITIVO", 0, "light");

    expect(canali(sfondo).saturazione).toBeLessThan(canali(banda).saturazione);
  });

  it("lascia grigio un prodotto senza categoria", () => {
    expect(canali(coloreProdotto(null, 0, "light").banda).saturazione).toBe(0);
    expect(canali(coloreProdotto("   ", 3, "dark").banda).saturazione).toBe(0);
  });

  it("da una tinta stabile a una categoria fuori mappa", () => {
    const primo = coloreProdotto("GRAPPA", 0, "light");
    const secondo = coloreProdotto("grappa", 0, "light");

    expect(primo).toEqual(secondo);
    expect(canali(primo.banda).saturazione).toBeGreaterThan(0);
  });

  it("non esplode su un indice assurdo", () => {
    expect(() => coloreProdotto("BIRRA", -4, "light")).not.toThrow();
    expect(coloreProdotto("BIRRA", -4, "light")).toEqual(coloreProdotto("BIRRA", 0, "light"));
    expect(() => coloreProdotto("BIRRA", Number.NaN, "light")).not.toThrow();
  });
});

describe("indiciPerCategoria", () => {
  it("numera ogni categoria da zero, per codice", () => {
    const indici = indiciPerCategoria([
      prodotto(3, "CAF-CAPPUCCINO", "CAFFETTERIA"),
      prodotto(1, "BRI-BRIOCHE-CREMA", "BRIOCHES"),
      prodotto(2, "CAF-ESPRESSO", "CAFFETTERIA"),
    ]);

    expect(indici.get(1)).toBe(0);
    expect(indici.get(3)).toBe(0);
    expect(indici.get(2)).toBe(1);
  });

  // 🔴 Il cuore della cosa: filtrare la griglia non deve muovere un colore. Se gli indici si
  //    calcolassero sulla lista visibile, cercare "esp" ridipingerebbe le tessere e la mano
  //    perderebbe il bersaglio che aveva gia imparato.
  it("non dipende dall'ordine di consegna della lista", () => {
    const listino = [
      prodotto(1, "CAF-ESPRESSO", "CAFFETTERIA"),
      prodotto(2, "CAF-CAPPUCCINO", "CAFFETTERIA"),
      prodotto(3, "CAF-MAROCCHINO", "CAFFETTERIA"),
    ];

    const diretto = indiciPerCategoria(listino);
    const rovesciato = indiciPerCategoria([...listino].reverse());

    expect([...diretto.entries()].sort()).toEqual([...rovesciato.entries()].sort());
  });

  it("tiene i prodotti senza categoria in un secchio a parte", () => {
    const indici = indiciPerCategoria([prodotto(1, "AAA", null), prodotto(2, "BBB", "BIRRA"), prodotto(3, "CCC", null)]);

    expect(indici.get(1)).toBe(0);
    expect(indici.get(2)).toBe(0);
    expect(indici.get(3)).toBe(1);
  });

  it("non altera la lista che riceve", () => {
    const listino = [prodotto(2, "ZZZ", "BIRRA"), prodotto(1, "AAA", "BIRRA")];
    indiciPerCategoria(listino);

    expect(listino.map((voce) => voce.codice)).toEqual(["ZZZ", "AAA"]);
  });
});

describe("coloreCategoria", () => {
  it("coincide con la banda del primo articolo della categoria", () => {
    expect(coloreCategoria("BIRRA", "light")).toBe(coloreProdotto("BIRRA", 0, "light").banda);
  });
});

describe("il colore esplicito", () => {
  // 🔴 Il generato deriva la tinta dalla categoria e distingue le voci per sola luminosità:
  //    dentro un gruppo di varianti non basta, perché lì il colore È il modo in cui si
  //    riconosce lo spritz giusto senza leggere l'etichetta.
  it("vince su quello generato dalla categoria", () => {
    const esplicito = coloreProdotto("APERITIVO", 0, "light", "#F4801A");

    expect(esplicito.banda).toBe("#F4801A");
    expect(esplicito.sfondo).toContain("#F4801A");
  });

  it("assente, il colore generato resta identico a prima", () => {
    // ⚠️ La proprietà che rende il campo additivo: nessuna tessera cambia colore finché
    //    qualcuno non gliene assegna uno.
    const senza = coloreProdotto("APERITIVO", 2, "light");
    const conNull = coloreProdotto("APERITIVO", 2, "light", null);
    const conVuoto = coloreProdotto("APERITIVO", 2, "light", "   ");

    expect(conNull).toEqual(senza);
    expect(conVuoto).toEqual(senza);
  });

  it("lo sfondo è una sfumatura del colore, diversa fra chiaro e scuro", () => {
    // Al buio una tinta satura pesa di più e ruberebbe contrasto al testo: la percentuale
    // cambia, per la stessa ragione per cui cambia nel colore generato.
    const chiaro = coloreProdotto(null, 0, "light", "#B02A37");
    const scuro = coloreProdotto(null, 0, "dark", "#B02A37");

    expect(chiaro.banda).toBe(scuro.banda);
    expect(chiaro.sfondo).not.toBe(scuro.sfondo);
    expect(chiaro.sfondo).toContain("white");
    expect(scuro.sfondo).toContain("black");
  });
});
