// Fixture condivise per i test di parità delle formule di cassa
// (aggregaRegistri.test.tsx + test degli hook dashboard).
// La shape replica integralmente il RegistroCassaFragment GraphQL, così le
// stesse fixture sono riutilizzabili nei mock Apollo (MockedProvider).

export const ANNO_FIXTURE = 2026;

export function creaRegistroFixture(overrides: Record<string, unknown>): RegistroCassa {
  return {
    __typename: "RegistroCassa",
    id: 1,
    data: `${ANNO_FIXTURE}-03-01T00:00:00.000Z`,
    utenteId: 1,
    totaleApertura: 0,
    totaleChiusura: 0,
    venditeContanti: 0,
    incassoContanteTracciato: 0,
    incassiElettronici: 0,
    incassiFattura: 0,
    totaleVendite: 0,
    speseFornitori: 0,
    speseGiornaliere: 0,
    contanteAtteso: 0,
    differenza: 0,
    contanteNetto: 0,
    importoIva: 0,
    breakdownIva: [],
    breakdownIvaCredito: [],
    note: null,
    stato: "CLOSED",
    createdAt: `${ANNO_FIXTURE}-03-01T08:00:00Z`,
    updatedAt: `${ANNO_FIXTURE}-03-01T08:00:00Z`,
    utente: {
      __typename: "Utente",
      id: 1,
      nomeUtente: "admin",
      nome: "Admin",
      cognome: "User",
      descrizione: "",
      disabilitato: false,
      ruoloId: 1,
      ruolo: { __typename: "Ruolo", id: 1, nome: "Admin", descrizione: "", menuIds: [] },
      menus: [],
    },
    conteggiApertura: [],
    conteggiChiusura: [],
    spese: [],
    pagamentiFornitori: [],
    ...overrides,
  } as unknown as RegistroCassa;
}

// --- Registri di marzo (mese misto: chiusi + bozza + campi null) ---

/** Registro chiuso con valori al centesimo. */
export const registroMarzoChiuso = creaRegistroFixture({
  id: 1,
  data: `${ANNO_FIXTURE}-03-05T00:00:00.000Z`,
  stato: "CLOSED",
  totaleApertura: 100,
  totaleChiusura: 500.4, // movimento fisico = 400.40
  incassoContanteTracciato: 200.1,
  incassiElettronici: 150.25,
  incassiFattura: 50.05,
  totaleVendite: 600.7, // valore server (nessun fallback)
  speseFornitori: 30.3,
  speseGiornaliere: 20.2,
});

/** Bozza (DRAFT) con totaleVendite null: scatta il fallback movimento + elettronici + fatture. */
export const registroMarzoBozza = creaRegistroFixture({
  id: 2,
  data: `${ANNO_FIXTURE}-03-12T00:00:00.000Z`,
  stato: "DRAFT",
  totaleApertura: 200,
  totaleChiusura: 450, // movimento fisico = 250
  incassoContanteTracciato: 100,
  incassiElettronici: 80,
  incassiFattura: 0,
  totaleVendite: null, // fallback: 250 + 80 + 0 = 330
  speseFornitori: 0,
  speseGiornaliere: 15,
});

/** Registro con tutti i campi monetari null: deve contribuire con zeri, mai NaN. */
export const registroMarzoNull = creaRegistroFixture({
  id: 3,
  data: `${ANNO_FIXTURE}-03-20T00:00:00.000Z`,
  stato: "CLOSED",
  totaleApertura: null,
  totaleChiusura: null,
  incassoContanteTracciato: null,
  incassiElettronici: null,
  incassiFattura: null,
  totaleVendite: null,
  speseFornitori: null,
  speseGiornaliere: null,
});

// --- Registro di luglio: ricavo non tracciato negativo ---

/** Contante tracciato > movimento fisico → ricavo non tracciato negativo (-150). */
export const registroLuglioNegativo = creaRegistroFixture({
  id: 4,
  data: `${ANNO_FIXTURE}-07-10T00:00:00.000Z`,
  stato: "RECONCILED",
  totaleApertura: 300,
  totaleChiusura: 400, // movimento fisico = 100
  incassoContanteTracciato: 250, // > movimento → non tracciato = -150
  incassiElettronici: 100,
  incassiFattura: 0,
  totaleVendite: 200,
  speseFornitori: 500,
  speseGiornaliere: 0,
});

// --- Registro di un altro anno: deve essere escluso dall'aggregazione ---

export const registroAltroAnno = creaRegistroFixture({
  id: 5,
  data: "2025-05-15T00:00:00.000Z",
  stato: "CLOSED",
  totaleApertura: 0,
  totaleChiusura: 999,
  incassoContanteTracciato: 999,
  incassiElettronici: 999,
  incassiFattura: 999,
  totaleVendite: 999,
  speseFornitori: 999,
  speseGiornaliere: 999,
});

/** Dataset completo dell'anno fixture (con l'intruso 2025 da escludere). */
export const registriFixture: RegistroCassa[] = [registroMarzoChiuso, registroMarzoBozza, registroMarzoNull, registroLuglioNegativo, registroAltroAnno];

/** Solo i registri di marzo (per la parità con la vista mensile). */
export const registriMarzo: RegistroCassa[] = [registroMarzoChiuso, registroMarzoBozza, registroMarzoNull];

// --- Valori attesi calcolati a mano con le formule normative della spec ---

export const attesoMarzo = {
  totaleVendite: 930.7, // 600.70 + 330 + 0
  ricavoTracciato: 580.4, // (200.10+150.25+50.05) + (100+80+0) + 0
  ricavoNonTracciato: 350.3, // (400.40-200.10) + (250-100) + 0
  speseTracciate: 30.3,
  speseNonTracciate: 35.2, // 20.20 + 15
  incassoContanteTracciato: 300.1,
  incassiElettronici: 230.25,
  incassiFattura: 50.05,
  registri: 3,
  chiusi: 2,
  bozze: 1,
  totaleSpese: 65.5,
  differenza: 865.2, // 930.70 - 65.50
};

export const attesoLuglio = {
  totaleVendite: 200,
  ricavoTracciato: 350, // 250 + 100 + 0
  ricavoNonTracciato: -150, // 100 - 250
  speseTracciate: 500,
  speseNonTracciate: 0,
  incassoContanteTracciato: 250,
  incassiElettronici: 100,
  incassiFattura: 0,
  registri: 1,
  chiusi: 1,
  bozze: 0,
  totaleSpese: 500,
  differenza: -300,
};

export const attesoTotaliAnno = {
  totaleVendite: 1130.7,
  ricavoTracciato: 930.4,
  ricavoNonTracciato: 200.3,
  speseTracciate: 530.3,
  speseNonTracciate: 35.2,
  incassoContanteTracciato: 550.1,
  incassiElettronici: 330.25,
  incassiFattura: 50.05,
  registri: 4,
  chiusi: 3,
  bozze: 1,
  totaleSpese: 565.5,
  differenza: 565.2,
};
