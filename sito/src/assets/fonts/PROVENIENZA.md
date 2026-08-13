# Provenienza dei caratteri

I quattro file `.woff2` di questa cartella **non sono stati convertiti**: sono scaricati così
come sono da Google Fonts, che serve già `woff2` spezzato per subset con l'`unicode-range`
esatto. La richiesta era «woff2 con subset latino, serviti in locale», e questo è esattamente
ciò che si ottiene — senza una toolchain Python che nessun altro pezzo del repository userebbe.

⚠️ **Questo file è ciò che rende l'operazione rifacibile invece che da riscoprire.** Il
rollback del change è `rm -rf sito/`, e porterebbe via i binari insieme all'unica traccia di
dove venivano. Le URL qui sotto sono opache (Google ci mette un hash nel percorso): senza
questa tabella non si ricostruiscono guardando i file.

**Scaricati il 2026-08-13**, con il redesign sul mockup «2D Gusto — Sito».

| File | Famiglia | Peso | Versione | Byte |
|---|---|---|---|---|
| `InstrumentSerif-latin.woff2` | Instrument Serif | 400 | v5 | 21 032 |
| `InstrumentSerif-italic-latin.woff2` | Instrument Serif *italic* | 400 | v5 | 22 128 |
| `Manrope-400-700-latin.woff2` | Manrope | 400–700 **variabile** | v20 | 24 836 |
| `JetBrainsMono-400-500-latin.woff2` | JetBrains Mono | 400–500 **variabile** | v24 | 31 432 |
| | | | **totale** | **99 428** |

## Perché due file variabili e non cinque statici

Manrope serve quattro pesi al mockup (400, 500, 600, 700) e JetBrains Mono due (400, 500).
Chiedendoli **a intervallo** (`wght@400..700`) Google risponde con **un solo file variabile**
per famiglia; chiedendo pesi singoli separati da `;` risponderebbe con un'istanza statica
ciascuno — sei file al posto di due, e più byte in totale.

⚠️ **Conseguenza da conoscere:** il `@font-face` deve dichiarare l'intervallo
(`font-weight: 400 700`), non un valore. Con un valore singolo il browser considera il file
un peso solo e **sintetizza** gli altri ingrassando le aste — cioè lo stesso grassetto finto
che `font-synthesis: none` esiste per impedire, ottenuto per la via opposta.

⚠️ Instrument Serif **non è variabile e non ha pesi**: ha un tondo e un corsivo, ed è tutto.
Il corsivo è un file a sé perché nel mockup lo porta l'`<em>aperitivo</em>` del titolo — e un
corsivo sintetizzato da un serif inclinandolo non somiglia a un corsivo, somiglia a un errore.

## URL sorgenti e impronte

Le URL sono quelle dentro il CSS che `fonts.googleapis.com/css2` restituisce a uno
**user-agent moderno** — con un UA vecchio la stessa richiesta risponde con `.ttf`, ed è il
motivo per cui `scarica-font.mjs` ne dichiara uno.

```
InstrumentSerif-latin.woff2
  https://fonts.gstatic.com/s/instrumentserif/v5/jizBRFtNs2ka5fXjeivQ4LroWlx-6zUTjg.woff2
  sha256  5eb09b5ac0e28b67c2f041c8ba6d244604ca0c0980d65912ab2d47fed84ddc31

InstrumentSerif-italic-latin.woff2
  https://fonts.gstatic.com/s/instrumentserif/v5/jizHRFtNs2ka5fXjeivQ4LroWlx-6zAjjH7M.woff2
  sha256  5a51946dfffa82972bc98745359c46761515641fda557c25116459a9f83da4a7

Manrope-400-700-latin.woff2
  https://fonts.gstatic.com/s/manrope/v20/xn7gYHE41ni1AdIRggexSg.woff2
  sha256  a30ddcd349703aff7464c34bef3fffdff405ee50c113440d7c8693c02d210972

JetBrainsMono-400-500-latin.woff2
  https://fonts.gstatic.com/s/jetbrainsmono/v24/tDbv2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKwBNntkaToggR7BYRbKPxDcwg.woff2
  sha256  83c005d49d8a6a50474c73a5a36ac0468076e9c4a29da7bdb14995d80560a5be
```

Le impronte sono **il contratto**: `npm run scarica-font` riscarica i quattro file e si ferma
se una non corrisponde, invece di sovrascrivere in silenzio. Se Google pubblica una revisione
nuova la versione nell'URL cambia, quindi un cambio d'impronta a URL invariata è un fatto da
guardare, non da accettare.

## I tre caratteri che sono usciti

Fino al 13 agosto 2026 qui stavano **Anton**, **Allura** e **Playfair Display 900**. Il
redesign sul mockup li sostituisce tutti e tre, e con essi vanno via due cose che erano state
scelte sul campo — vanno nominate, perché non sono state dimenticate:

- **Allura** portava lo slogan *«L'attesa del piacere è essa stessa il piacere»* ed era il
  carattere dello slogan sul Google Sites reale del locale. Il mockup non ha alcun tocco
  calligrafico e al suo posto mette una riga di corpo.
- **Playfair Display 900 stirato ×1.55** riproduceva l'insegna «Colazione Pranzo Aperitivo»,
  con un fattore *misurato* sull'insegna vera fra nove candidati. Nel mockup quelle tre parole
  restano — sono il titolo della home — ma in Instrument Serif, senza stiramento.

Le loro URL e impronte restano nella storia di git (commit `526a8a9` e precedenti), che è il
posto giusto: rimetterli sarebbe `git show` di questo file, non una riscoperta.

## L'intervallo Unicode

Tutti e quattro i file dichiarano lo **stesso** subset `latin` dei tre precedenti:

```
U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308,
U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD
```

Verificato che copra ciò che il sito scrive davvero:

| Serve | Codepoint | Coperto da |
|---|---|---|
| accentate italiane (à è é ì ò ù) | U+00E0–U+00F9 | `U+0000-00FF` ✅ |
| **€** — 🔴 senza, sarebbero i **prezzi** | U+20AC | `U+20AC` ✅ |
| apostrofo tipografico ’ e trattini – — | U+2018–U+2014 | `U+2000-206F` ✅ |
| · (il separatore del marquee e degli occhielli) | U+00B7 | `U+0000-00FF` ✅ |
| → (il link «Tutto il menu →») | U+2192 | ❌ **fuori range** — vedi sotto |

🔴 **La freccia `→` (U+2192) NON è nel subset latino**, e i tre codepoint vicini che ci sono
(`U+2191` ↑, `U+2193` ↓) rendono la cosa facile da dare per scontata. Un `→` scritto in una
riga di Manrope viene reso dal **carattere di ripiego del sistema**: cambia forma e allineamento
fra Windows, macOS e Android, e su qualche Android non c'è affatto. Nel sito le frecce sono
quindi **glifi disegnati in SVG** dentro il componente del link, non caratteri di testo.

⚠️ L'`unicode-range` va copiato **verbatim** nei `@font-face`: senza, il browser scarica il
carattere anche per testo che non ha alcun glifo in quel range — per esempio il nome di un
prodotto scritto in cirillico.

## Licenza

Tutte e quattro sotto **SIL Open Font License 1.1**, in [`OFL.txt`](./OFL.txt). Il corpo della
licenza è **identico** nelle tre famiglie, quindi è scritto una volta sola; le note di
copyright sono riportate tutte.

🔴 La licenza **richiede** che quel file accompagni i caratteri: non è documentazione, è una
condizione della redistribuzione.
