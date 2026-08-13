// L'attrezzatura per provare le pagine: un backend finto e il sito costruito che lo legge.
//
// Perché un backend finto e non quello vero: i casi che contano — menu troncato, listino
// vuoto, backend irraggiungibile — a database non esistono e crearli richiederebbe 301
// prodotti, o di svuotare la vetrina di un locale vero. Qui sono tre righe di JSON.
//
// ⚠️ Il backend VERO resta la prova di §8.6 e §9.x, che si fa con un browser: questo
//    attrezzo serve ai casi che il dato reale non contiene, non a sostituirlo.

import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { radiceSito } from './_scansione.mjs';

export function portaLibera() {
  return new Promise((risolvi) => {
    const s = createServer();
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => risolvi(port));
    });
  });
}

/** L'identità minima che `leggiSito` riconosce come ben formata. */
export const SITO_FINTO = {
  insegna: '2D Gusto Bar',
  indirizzo: { via: 'Via del Costo 99', cap: '36016', citta: 'Thiene', provincia: 'VI', paese: 'IT' },
  geo: null,
  contatti: { telefono: null, email: null },
  social: { instagram: null, facebook: null },
  orari: {
    apertura: '07:00',
    chiusura: '20:00',
    giorniOperativi: [true, true, true, true, true, true, false],
    timezone: 'Europe/Rome',
  },
  seo: { titoloDefault: null, descrizioneDefault: null, immagineOg: null },
  oraInizioTemaSera: '18:00',
  // ⚠️ `testi` e `recensioni` sono fra le chiavi che `leggiSito` PRETENDE, quindi non sono
  //    facoltative nemmeno qui: senza, ogni pagina di ogni test cadrebbe in degradazione e i
  //    fallimenti direbbero «manca la striscia dei consigli» invece di «manca una chiave».
  //    Tutti i testi sono `null` di proposito — è lo stato di un'installazione nuova, ed è
  //    quello in cui le sezioni editoriali NON devono rendersi.
  testi: { claim: null, storia: null, aperitivo: null },
  reputazione: null,
  recensioni: [],
};

/** L'identità con i testi editoriali compilati, per i casi che li esercitano. */
export const SITO_FINTO_CON_TESTI = {
  ...SITO_FINTO,
  testi: {
    claim: 'Espresso alle sette, mojito al tramonto.',
    storia: { titolo: 'Due mani italiane', testo: 'Primo capoverso.\n\nSecondo capoverso.' },
    aperitivo: {
      titolo: 'Apericosto',
      testo: 'Un cocktail e il tagliere del giorno.',
      punti: ['Un cocktail a scelta', 'Il tagliere del giorno'],
      categorie: ['Cocktail'],
    },
  },
  reputazione: { punteggio: 4.7, numero: 180, urlProfilo: null },
  recensioni: [
    { id: 1, autore: 'Recensione Google', testo: 'Il mojito è fatto come si deve.', fonte: 'Google', punteggio: 5 },
  ],
};

export function immagineFinta(chiave = '2026/08/foto-prova', larghezze = [400, 800]) {
  return {
    chiave,
    larghezzeDisponibili: larghezze,
    larghezza: 800,
    altezza: 600,
    testoAlternativo: 'una foto di prova',
    didascalia: null,
    focale: null,
    placeholder: null,
  };
}

/**
 * La risposta di `/api/public/galleria` **completa**: l'elenco e i ruoli.
 *
 * 🔴 **Questo è un backend finto, non una seconda sede della regola.** La regola vera vive in
 *    `backend/Services/Vetrina/RuoliImmaginiVetrina.cs` ed è pinnata là da una matrice su
 *    gallerie da 0, 1, 2, 3, 5 e 6 immagini. Qui se ne rispecchia il comportamento **a slot
 *    vuoti**, che è l'unico stato che i test del sito esercitano, per la stessa ragione per cui
 *    `SITO_FINTO` rispecchia `SitoPubblicoDto`: senza, ogni pagina di ogni test cadrebbe in
 *    degradazione e i fallimenti direbbero «manca la griglia» invece di «manca una chiave».
 *
 * ⚠️ `eroeAperitivo` è `null` anche a galleria piena, e **non è una dimenticanza**: quel ruolo
 *    non ha ripiego posizionale. Prima del change era `galleria.at(-1)`.
 */
export function galleriaFinta(immagini = [], ruoli = {}) {
  return {
    immagini,
    ruoli: {
      eroeHome: immagini[0] ?? null,
      grigliaHome: immagini.slice(1, 4),
      fotoMenu: immagini.slice(0, 3),
      ritrattoLocale: immagini[1] ?? immagini[0] ?? null,
      quadrateLocale: immagini.slice(2, 5),
      eroeAperitivo: null,
      ...ruoli,
    },
  };
}

export function prodottoFinto(id, nome, extra = {}) {
  return {
    id,
    nome,
    descrizione: null,
    prezzo: 1.5,
    allergeni: null,
    novita: false,
    consigliato: false,
    immagine: null,
    ...extra,
  };
}

/**
 * 🔴 **Il finto backend risponde nella forma del contratto CORRENTE, non nella forma in cui il
 *    test l'ha scritta.** Un caso che assegna `{ immagini: [foto] }` sta dicendo «una galleria
 *    con questa foto», non «una risposta senza il campo `ruoli`»: completarla qui è ciò che
 *    permette ai test che parlano d'altro — `menu`, `prefissi` — di non essere riscritti a ogni
 *    campo additivo, e di restare la prova che quel campo **è** additivo.
 *
 * ⚠️ Chi vuole davvero una risposta monca — per provare la degradazione contro un backend più
 *    vecchio del sito — dichiara `ruoli` esplicitamente a `undefined`... e non può: il modo di
 *    provare quel caso è un codice HTTP o un corpo di un'altra forma, che questo helper lascia
 *    passare intatti. Qui si completa **solo** ciò che è già una galleria ben formata.
 */
function completa(percorso, corpo) {
  const eUnaGalleriaSenzaRuoli =
    percorso === '/api/public/galleria' &&
    corpo !== null &&
    typeof corpo === 'object' &&
    Array.isArray(corpo.immagini) &&
    corpo.ruoli === undefined;

  return eUnaGalleriaSenzaRuoli ? galleriaFinta(corpo.immagini) : corpo;
}

/**
 * Un backend finto. Le risposte si cambiano fra un caso e l'altro assegnando `.risposte`,
 * senza riavviare niente.
 */
export async function backendFinto(risposteIniziali = {}) {
  const stato = {
    risposte: {
      '/api/public/site': SITO_FINTO,
      // `lavagna` è anch'essa fra le chiavi pretese da `leggiMenu`: vuota è lo stato normale.
      '/api/public/menu': {
        categorie: [],
        totaleProdottiPubblicati: 0,
        limiteApplicato: 300,
        troncato: false,
        lavagna: [],
      },
      '/api/public/galleria': galleriaFinta(),
      ...risposteIniziali,
    },
  };

  const porta = await portaLibera();
  const server = createServer((richiesta, risposta) => {
    const percorso = richiesta.url.split('?')[0];
    const corpo = stato.risposte[percorso];
    if (corpo === undefined) {
      risposta.writeHead(404).end('{}');
      return;
    }
    if (typeof corpo === 'number') {
      risposta.writeHead(corpo).end('{}');
      return;
    }
    risposta.writeHead(200, { 'content-type': 'application/json' });
    risposta.end(JSON.stringify(completa(percorso, corpo)));
  });
  await new Promise((r) => server.listen(porta, '127.0.0.1', r));

  return {
    origine: `http://127.0.0.1:${porta}`,
    stato,
    chiudi: () => server.close(),
  };
}

/**
 * Costruisce il sito.
 *
 * 🔴 **ENTRAMBI i prefissi sono variabili di BUILD, non di runtime** — anche
 *    `API_INTERNA_URL`, che è di contesto *server*. `astro:env` inlina nel bundle ogni
 *    variabile con `access: 'public'`, di qualunque contesto; solo i `secret` restano
 *    lette a runtime. Misurato il 12 agosto 2026, e confermato dalla documentazione:
 *    *«Public server variables are in the server bundle»*.
 *
 * ⚠️ Il modo in cui questo inganna: passare `API_INTERNA_URL` all'AMBIENTE del server
 *    costruito non produce alcun errore e non ha alcun effetto — il sito continua a
 *    leggere l'origine con cui è stato costruito. In una suite che punta a un backend
 *    finto, i test diventano verdi leggendo il backend VERO, e sembrano funzionare.
 *    È successo qui, e i primi due test passavano per quel motivo.
 */
export function costruisci(ambiente = {}) {
  execFileSync('npx', ['astro', 'build'], {
    cwd: radiceSito,
    shell: true,
    stdio: 'pipe',
    env: { ...process.env, ...ambiente },
  });
}

/** Avvia il bundle costruito e attende che risponda. */
export async function avviaSito(ambiente = {}) {
  const porta = await portaLibera();
  const processo = spawn(process.execPath, ['dist/server/entry.mjs'], {
    cwd: radiceSito,
    env: {
      ...process.env,
      PORT: String(porta),
      HOST: '127.0.0.1',
      NODE_EXTRA_CA_CERTS: join(radiceSito, '..', 'backend', '.certs', 'aspnet-dev.pem'),
      ...ambiente,
    },
    stdio: 'ignore',
  });

  const base = `http://127.0.0.1:${porta}`;
  for (let i = 0; i < 80; i++) {
    try {
      const r = await fetch(base + '/');
      if (r.status < 500 || r.status === 503) {
        return { base, processo, ferma: () => processo.kill() };
      }
    } catch {
      /* non ancora in ascolto */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  processo.kill();
  throw new Error(`il sito di prova non ha risposto su ${base}`);
}
