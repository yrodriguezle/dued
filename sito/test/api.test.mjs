// I quattro motivi per cui un dato non c'è — e la prova che nessuno di essi lancia.
//
// 🔴 In SSR una `fetch` che fallisce nel frontmatter **fa fallire la pagina**: Astro
//    risponde 500 e in sviluppo mostra il proprio overlay. È il comportamento peggiore
//    possibile per una vetrina, ed è il DEFAULT. Questi test pinnano che qui non succeda.
//
// ⚠️ Nessun server viene spento per provare «il backend è giù»: si punta l'URL su una
//    porta libera, che produce lo stesso esito ed è deterministico.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { caricaApi } from './_ambiente-astro.mjs';

const { leggiSito, leggiMenu, TIMEOUT_LETTURA_MS, impostaApiInternaUrl } = await caricaApi();

/** Avvia un server locale che risponde sempre allo stesso modo. Restituisce la sua origine. */
function servitore(gestore) {
  return new Promise((risolvi) => {
    const server = createServer(gestore);
    server.listen(0, '127.0.0.1', () =>
      risolvi({ origine: `http://127.0.0.1:${server.address().port}`, server })
    );
  });
}

/** Esegue `azione` catturando le righe scritte sui log. */
async function conLog(azione) {
  const righe = [];
  const originale = console.log;
  console.log = (...pezzi) => righe.push(pezzi.join(' '));
  try {
    return { risultato: await azione(), righe };
  } finally {
    console.log = originale;
  }
}

let aperti = [];
after(() => aperti.forEach((s) => s.close()));

/**
 * Una porta **libera per davvero**: si apre un server per farsela assegnare dal sistema e
 * la si richiude subito.
 *
 * ⚠️ Non si scrive un numero a caso e nemmeno `:1`: le porte sotto la 1024 e una manciata
 *    di altre sono nell'elenco dei *bad ports* di `fetch`, che le rifiuta **prima** di
 *    provare a connettersi. Il risultato somiglia a «nessun ascoltatore» ma è un'altra
 *    cosa, e il test verificherebbe la lista di Node invece del nostro codice.
 */
function portaLibera() {
  return new Promise((risolvi) => {
    const s = createServer();
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => risolvi(port));
    });
  });
}

test('🔴 backend non in ascolto → motivo "rete", e non solleva', async () => {
  // Una porta su cui nessuno ascolta. Non si spegne niente.
  impostaApiInternaUrl(`http://127.0.0.1:${await portaLibera()}`);
  const { risultato, righe } = await conLog(() => leggiSito());

  assert.equal(risultato.stato, 'assente');
  assert.equal(risultato.motivo, 'rete');
  assert.equal(righe.length, 1, 'ogni assenza lascia esattamente una riga nei log');
  assert.match(righe[0], /motivo=rete/);
  // 🔴 Il dettaglio deve nominare la causa VERA, non il «fetch failed» che la avvolge:
  //    è la differenza fra un log che diagnostica e uno che dice solo che è andata male.
  assert.match(risultato.dettaglio, /ECONNREFUSED/);
});

test('risposta oltre il timeout → motivo "timeout"', async () => {
  const { origine, server } = await servitore((_, risposta) => {
    // Non risponde mai: il timeout deve scattare da solo.
    setTimeout(() => risposta.end('{}'), TIMEOUT_LETTURA_MS * 3).unref();
  });
  aperti.push(server);

  impostaApiInternaUrl(origine);
  const inizio = Date.now();
  const { risultato, righe } = await conLog(() => leggiSito());

  assert.equal(risultato.motivo, 'timeout');
  assert.ok(
    Date.now() - inizio < TIMEOUT_LETTURA_MS * 2,
    'ha aspettato più del timeout dichiarato: il segnale non sta scattando'
  );
  assert.match(righe[0], /motivo=timeout/);
});

test('risposta con codice di errore → motivo "http"', async () => {
  const { origine, server } = await servitore((_, risposta) => {
    risposta.writeHead(503, { 'content-type': 'application/json' });
    risposta.end('{"errore":"manutenzione"}');
  });
  aperti.push(server);

  impostaApiInternaUrl(origine);
  const { risultato, righe } = await conLog(() => leggiMenu());

  assert.equal(risultato.motivo, 'http');
  assert.equal(risultato.dettaglio, 'HTTP 503');
  assert.match(righe[0], /motivo=http/);
});

test('risposta 200 con corpo inatteso → motivo "formato"', async () => {
  // Il caso vero non è un corpo illeggibile: è un 200 che sembra a posto e non lo è —
  // un contratto cambiato, o una pagina di login di un proxy davanti al backend.
  const { origine, server } = await servitore((_, risposta) => {
    risposta.writeHead(200, { 'content-type': 'application/json' });
    risposta.end('{"qualcosa":"altro"}');
  });
  aperti.push(server);

  impostaApiInternaUrl(origine);
  const { risultato, righe } = await conLog(() => leggiSito());

  assert.equal(risultato.motivo, 'formato');
  assert.match(righe[0], /motivo=formato/);
});

test('corpo non JSON → motivo "formato"', async () => {
  const { origine, server } = await servitore((_, risposta) => {
    risposta.writeHead(200, { 'content-type': 'text/html' });
    risposta.end('<html>il proxy ha risposto lui</html>');
  });
  aperti.push(server);

  impostaApiInternaUrl(origine);
  const { risultato } = await conLog(() => leggiSito());
  assert.equal(risultato.motivo, 'formato');
});

test('🔴 Promise.all di due letture di cui una fallisce restituisce ENTRAMBI gli esiti', async () => {
  // È la proprietà su cui poggia la home: le due letture partono insieme, e un
  // fallimento parziale resta parziale. Se una delle due rifiutasse, `Promise.all`
  // cortocircuiterebbe e la pagina perderebbe anche il pezzo che era arrivato — cioè il
  // guasto di /menu porterebbe via l'identità del locale, che sta in un'altra risposta.
  const { origine, server } = await servitore((richiesta, risposta) => {
    if (richiesta.url.includes('/site')) {
      risposta.writeHead(200, { 'content-type': 'application/json' });
      risposta.end(
        JSON.stringify({
          insegna: '2D Gusto Bar',
          indirizzo: {},
          orari: {},
          oraInizioTemaSera: '18:00',
          testi: {},
          recensioni: [],
        })
      );
      return;
    }
    risposta.writeHead(500);
    risposta.end('{}');
  });
  aperti.push(server);

  impostaApiInternaUrl(origine);
  const { risultato } = await conLog(() => Promise.all([leggiSito(), leggiMenu()]));
  const [sito, menu] = risultato;

  assert.equal(sito.stato, 'ok', 'la lettura riuscita deve sopravvivere a quella fallita');
  assert.equal(sito.dati.insegna, '2D Gusto Bar');
  assert.equal(menu.stato, 'assente');
  assert.equal(menu.motivo, 'http');
});

test('il timeout è dichiarato una volta sola e vale 3 secondi', () => {
  assert.equal(TIMEOUT_LETTURA_MS, 3000);
});
