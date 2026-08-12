// Nessun sorgente di `sito/` spegne la verifica dei certificati.
//
// 🔴 Il divieto è senza riserve (§D3). `NODE_TLS_REJECT_UNAUTHORIZED=0` è globale al
//    processo — disattiva la verifica per OGNI connessione TLS, non solo per quella verso
//    il backend di sviluppo — e vive in una variabile d'ambiente che si copia-incolla fra
//    macchine finché non finisce in un compose di produzione.
//
//    Anche la forma "circoscritta" è vietata: un `rejectUnauthorized: false` passato a una
//    singola `fetch` e protetto da `import.meta.env.DEV` è molto meglio, e resta codice
//    versionato che spegne TLS. Chi lo legge fra sei mesi vede la riga e non sa più quale
//    `if` la proteggeva.
//
//    La soluzione è NODE_EXTRA_CA_CERTS, che AGGIUNGE un'autorità all'ambiente invece di
//    togliere una difesa: la macchina non si fida di quella CA, e il codice non ne sa nulla.
//
// ⚠️ La scansione ignora i commenti: `scripts/dev.mjs` nomina la variabile proprio per dire
//    che è vietata, e senza quella cura questo test sarebbe rosso per la ragione sbagliata.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sorgenti, sorgentiCheContengono } from './_scansione.mjs';

const VIETATE = ['NODE_TLS_REJECT_UNAUTHORIZED', 'rejectUnauthorized'];

test('la scansione guarda davvero qualcosa', () => {
  // Senza questo, i due test sotto sarebbero verdi anche con un albero vuoto o con un
  // filtro rotto — e nessuno se ne accorgerebbe finché non serve.
  assert.ok(
    sorgenti().length > 0,
    'nessun sorgente trovato in src/ o scripts/: il filtro della scansione è rotto, ' +
      'e i test di questo file sono verdi perché non guardano nulla'
  );
});

for (const vietata of VIETATE) {
  test(`nessun sorgente contiene "${vietata}"`, () => {
    const colpevoli = sorgentiCheContengono(vietata);
    assert.deepEqual(
      colpevoli,
      [],
      `${colpevoli.join(', ')} spegne la verifica TLS. La soluzione è NODE_EXTRA_CA_CERTS ` +
        'in scripts/dev.mjs, che aggiunge la CA di sviluppo invece di disattivare il controllo.'
    );
  });
}
