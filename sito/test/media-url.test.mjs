// La composizione degli URL dei media — pura, senza rete.
//
// 🔴 Tutti i casi usano un'immagine PICCOLA, con meno varianti della scala completa. Con
//    la sola immagine grande questi test resterebbero verdi anche con la regola rotta —
//    perché una scala fissa 400/800/1200/1600 e le larghezze reali coinciderebbero. È il
//    motivo per cui l'immagine di prova ha due varianti e non quattro.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { caricaMediaUrl } from './_ambiente-astro.mjs';

const { mediaUrl, srcSet, impostaMediaOrigine } = await caricaMediaUrl();

const ORIGINE = 'https://media.esempio.invalid';
impostaMediaOrigine(ORIGINE);

/** Un'immagine come la restituisce l'API, con solo le varianti che esistono davvero. */
function immagine(larghezzeDisponibili) {
  return {
    chiave: '2026/08/foto-abc123',
    larghezzeDisponibili,
    larghezza: 800,
    altezza: 600,
    testoAlternativo: null,
    didascalia: null,
    focale: null,
    placeholder: null,
  };
}

test('composizione di un URL di variante', () => {
  assert.equal(
    mediaUrl('2026/08/foto-abc123', 400),
    `${ORIGINE}/media/2026/08/foto-abc123/400.webp`
  );
  assert.equal(
    mediaUrl('2026/08/foto-abc123', 800, 'jpg'),
    `${ORIGINE}/media/2026/08/foto-abc123/800.jpg`
  );
});

test("l'origine è assoluta, mai vuota e mai relativa", () => {
  // `""` è anche ciò che si ottiene DIMENTICANDO la variabile: con il prefisso vuoto un
  // errore di configurazione e una scelta deliberata diventano indistinguibili, e
  // og:image — che deve essere assoluta — sarebbe rotta senza che nulla lo dica.
  const url = mediaUrl('x', 400);
  assert.ok(url.startsWith('https://'), `URL non assoluto: ${url}`);
  assert.ok(!url.startsWith('/media/'), 'URL relativo: og:image sarebbe rotta');
});

test('🔴 immagine con meno varianti della costante: due sorgenti, non quattro', () => {
  const sorgenti = srcSet(immagine([400, 800])).split(', ');
  assert.equal(sorgenti.length, 2);
  assert.deepEqual(sorgenti, [
    `${ORIGINE}/media/2026/08/foto-abc123/400.webp 400w`,
    `${ORIGINE}/media/2026/08/foto-abc123/800.webp 800w`,
  ]);
  // 🔴 La prova che nessuna larghezza è stata dedotta: la pipeline non fa upscaling, e
  //    /1200.webp risponderebbe 404 — proprio la sorgente che il browser sceglie sugli
  //    schermi densi, cioè su quasi tutti i telefoni.
  assert.ok(!srcSet(immagine([400, 800])).includes('1200'));
  assert.ok(!srcSet(immagine([400, 800])).includes('1600'));
});

test('immagine con tutte le varianti: quattro sorgenti', () => {
  const sorgenti = srcSet(immagine([400, 800, 1200, 1600])).split(', ');
  assert.equal(sorgenti.length, 4);
  assert.ok(sorgenti[3].endsWith('1600.webp 1600w'));
});

test('una sola variante: una sola sorgente', () => {
  assert.equal(srcSet(immagine([400])), `${ORIGINE}/media/2026/08/foto-abc123/400.webp 400w`);
});

test('elenco di larghezze vuoto: stringa vuota, e non solleva', () => {
  // Il markup degrada all'immagine singola: un peggioramento accettabile, non una pagina
  // rotta. `srcset=""` è ignorato dal browser, che usa `src`.
  assert.doesNotThrow(() => srcSet(immagine([])));
  assert.equal(srcSet(immagine([])), '');
});

test('il formato si propaga a tutte le sorgenti', () => {
  const sorgenti = srcSet(immagine([400, 800]), 'jpg').split(', ');
  assert.ok(sorgenti.every((s) => s.includes('.jpg ')));
});
