# Asset di marca — 2D Gusto

Vettorializzati l'11 agosto 2026 da `docs/Logo Sfondo.pdf`, che si è rivelato **già
vettoriale**: i tracciati non sono stati ridisegnati a mano, sono quelli originali estratti
dal PDF. Il `viewBox` di ogni file è misurato con `getBBox()` in Chromium, non stimato.

Colori: inchiostro `#2B2417`, gesso `#F2EDE7`, arancio `#FD8502`.

> ⚠️ L'arancio del PDF è `#FF9003`, leggermente diverso dal `#FD8502` campionato dalle
> locandine. Qui si è usato **quello delle locandine**, per non avere due arancioni nel
> progetto. Se un giorno si stampa qualcosa, vale la pena riverificarlo sull'originale.

## Questa cartella è il master, non la cartella del sito

Qui sta **tutto** il marchio, comprese le cose che sul sito non vanno: l'insegna con le tre
parole disegnate serve a stampa e insegne, e questo README documenta il marchio, non le
pagine. Il sito ne prenderà un sottoinsieme quando nascerà `sito/` (Fase 2 del piano), in
**due posti diversi** — e la distinzione non è cosmetica:

| Destinazione | Cosa | Perché |
|---|---|---|
| `sito/public/` | `favicon.svg`, `apple-touch-icon.png`, `og-default.jpg` | servito verbatim, a URL fisse: i browser cerca­no queste risorse a percorsi precisi |
| `sito/src/assets/` | `logo-2dgusto.svg`, `monogramma-2d.svg` | processato da Astro e inserito **inline** nella pagina — l'unico modo perché `currentColor` funzioni e il logo segua il tema |

Le varianti a colori fissi servono solo dove il logo passa da `<img>` o da CSS. Se finisce
inline, si usa la versione con `currentColor` e se ne pilota il colore dal foglio di stile.

## Quale file usare

| File | Quando |
|---|---|
| `logo-2dgusto.svg` | **Inline nel DOM.** Inchiostro in `currentColor`, arancio in `--logo-arancio` |
| `logo-2dgusto-inchiostro.svg` | `<img>` o `background-image` **su fondo chiaro** |
| `logo-2dgusto-gesso.svg` | `<img>` o `background-image` **su fondo scuro** |
| `monogramma-2d*.svg` | Le stesse tre varianti, senza la parola "Gusto": header stretti, avatar |
| `monogramma-2d-monocromo.svg` | **Su arancio pieno**, dove il "2" a colori sparirebbe. Tutto in `currentColor` |
| `favicon.svg` | Scheda del browser. Si adatta da sé al tema chiaro/scuro |
| `apple-touch-icon.png` | 180×180, fondo crema pieno (iOS ignora la trasparenza) |
| `og-default.jpg` | 1200×630, anteprima quando il link viene condiviso |
| `insegna-bandiere-*.png` | Wordmark **con le bandiere**, raster — vedi sotto |

## 🔴 Due trappole, verificate sul campo

**`currentColor` non funziona con `<img src>`.** Un SVG caricato come immagine è un
documento isolato: non eredita il colore della pagina, `currentColor` si risolve al nero e
il logo sparisce su fondo scuro. È la ragione per cui esistono le varianti a colori fissi.
`currentColor` vale **solo** per l'SVG scritto inline nel DOM.

**Su arancio pieno il "2" svanisce**, perché è dello stesso colore del fondo. Là si usa la
variante monocroma, che porta tutto il segno in un colore unico.

## Il wordmark con le bandiere

Da `docs/Insegna 3+ lettere.pdf`, anch'esso vettoriale: monogramma, "Gusto" e perfino
"Colazione Pranzo Aperitivo" sono tracciati. **Solo le due bandiere sono raster** — nel
PDF sono pennellate dipinte, con la loro maschera alpha.

| File | Cosa contiene |
|---|---|
| `insegna-bandiere.svg` | wordmark, inchiostro in `currentColor` (uso inline) |
| `insegna-bandiere-inchiostro.svg` / `-gesso.svg` | le due varianti a colori fissi |
| `insegna-bandiere-inchiostro.png` / `-gesso.png` | 1800×355, fondo trasparente |
| `insegna-completa-inchiostro.svg` | **con** "Colazione Pranzo Aperitivo": per stampa e insegne |

> ⚠️ Nel sito le tre parole vanno scritte **come testo**, non prese da qui: devono poter
> essere lette, tradotte e indicizzate. La versione disegnata serve dove il testo non è
> selezionabile comunque — stampa, adesivi, l'insegna vera.

### 🔴 Il bianco non si toglie a posteriori

La prima versione di questi PNG nasceva dal ritaglio di un JPEG, con il bianco reso
trasparente per soglia di saturazione. Il risultato aveva **frange chiare e bordi
frastagliati** attorno alle pennellate delle bandiere: residui di compressione che nessuna
soglia sa distinguere dal fondo, evidentissimi sul tema scuro.

La versione buona rende l'SVG con `omitBackground`. Non c'è nessun bianco da togliere,
perché **non viene mai dipinto** — e il bianco *vero* delle bandiere (le strisce cubane, la
banda italiana) resta intatto, perché quello è disegnato.

Regola: quando esiste il vettoriale, si riparte da lì. Ripulire i pixel è sempre il piano B.

## Come sono stati fatti

Gli script sono nello scratchpad della sessione (`costruisci-logo.js`, `genera-raster.js`,
`trasparenza.ps1`). I raster derivano dagli stessi SVG via Playwright, quindi non c'è una
copia che possa divergere dai tracciati sorgente.

La scritta **"Colazione Pranzo Aperitivo"** dell'insegna è **Playfair Display Black stirato
in orizzontale ×1.55** — identificato per confronto contro nove candidati. Non è un font
esteso: è un didone deformato nel software di grafica, e la firma sono le aste verticali
spessissime accanto a grazie filiformi. In CSS si riproduce con `transform: scaleX(1.5)`.
