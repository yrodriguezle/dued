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
  // ⚠️ Vuoto è lo stato di quasi tutto l'anno, ed è anche una chiave che `leggiSito`
  //    PRETENDE: senza, ogni pagina di ogni test cadrebbe in degradazione.
  chiusure: [],
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

/**
 * L'identità con una chiusura in corso: le ferie del 10–22 agosto 2026, che è il caso reale
 * da cui è nato il campo.
 *
 * ⚠️ Le date sono FISSE e nel passato rispetto a quando questi test gireranno, ed è
 *    deliberato: il server manda ciò che ha in pancia e il sito lo rende, quindi non serve
 *    che «oggi» ci caschi dentro per provare che la fascia compare. Che la finestra cominci
 *    da oggi lo decide il backend, ed è provato di là.
 */
export const SITO_FINTO_IN_FERIE = {
  ...SITO_FINTO,
  chiusure: Array.from({ length: 13 }, (_, indice) => ({
    data: `2026-08-${String(10 + indice).padStart(2, '0')}`,
    descrizione: 'Ferie',
    motivo: 'FERIE',
  })),
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
      '/api/public/galleria': { immagini: [] },
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
    risposta.end(JSON.stringify(corpo));
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
