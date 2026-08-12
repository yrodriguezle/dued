# Provenienza dei caratteri

I tre file `.woff2` di questa cartella **non sono stati convertiti**: sono scaricati così come
sono da Google Fonts, che serve già `woff2` spezzato per subset con l'`unicode-range` esatto.
La richiesta era «woff2 con subset latino, serviti in locale», e questo è esattamente ciò che
si ottiene — senza una toolchain Python che nessun altro pezzo del repository userebbe, e con
un risultato migliore: Anton `latin` pesa **18 kB** contro i **161 kB** del `.ttf` da cui una
conversione sarebbe partita.

⚠️ **Questo file è ciò che rende l'operazione rifacibile invece che da riscoprire.** Il
rollback del change è `rm -rf sito/`, e porterebbe via i binari insieme all'unica traccia di
dove venivano. Le URL qui sotto sono opache (Google ci mette un hash nel percorso): senza
questa tabella non si ricostruiscono guardando i file.

**Scaricati il 2026-08-12.**

| File | Famiglia | Peso | Versione | Byte |
|---|---|---|---|---|
| `Anton-latin.woff2` | Anton | 400 | v27 | 18 612 |
| `Allura-latin.woff2` | Allura | 400 | v23 | 26 488 |
| `PlayfairDisplay-900-latin.woff2` | Playfair Display | 900 | v40 | 22 372 |
| | | | **totale** | **67 472** |

⚠️ Playfair Display è chiesto con **un peso singolo** (`wght@900`): a quella richiesta Google
risponde con un'**istanza statica**, non con il file variabile. Chiedere `wght@400..900` darebbe
un file solo per tutti i pesi, e ne serve uno.

## URL sorgenti e impronte

Le URL sono quelle dentro il CSS che `fonts.googleapis.com/css2` restituisce a uno
**user-agent moderno** — con un UA vecchio la stessa richiesta risponde con `.ttf`, ed è il
motivo per cui `scarica-font.mjs` ne dichiara uno.

```
Anton-latin.woff2
  https://fonts.gstatic.com/s/anton/v27/1Ptgg87LROyAm3Kz-C8.woff2
  sha256  d0fa07ff63dd60cbc0e2f58e29c802dca2a5ae0276c999f59c6111ab7bbaec3b

Allura-latin.woff2
  https://fonts.gstatic.com/s/allura/v23/9oRPNYsQpS4zjuA_iwgW.woff2
  sha256  203583457d9c8cc90309f580dbf27a5fa9ed2893f06b8404ebb4c05e909c18e5

PlayfairDisplay-900-latin.woff2
  https://fonts.gstatic.com/s/playfairdisplay/v40/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKfsunDXbtM.woff2
  sha256  2772c56b28bec10f310634732b0554dd6cced8ad0f723bbdf73f6abc53829ad0
```

Le impronte sono **il contratto**: `npm run scarica-font` riscarica i tre file e si ferma se
una non corrisponde, invece di sovrascrivere in silenzio. Se Google pubblica una revisione
nuova la versione nell'URL cambia, quindi un cambio d'impronta a URL invariata è un fatto da
guardare, non da accettare.

## L'intervallo Unicode

Il subset `latin` di Google dichiara:

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
| ° | U+00B0 | `U+0000-00FF` ✅ |

⚠️ L'`unicode-range` va copiato **verbatim** nei `@font-face`: senza, il browser scarica il
carattere anche per testo che non ha alcun glifo in quel range — per esempio il nome di un
prodotto scritto in cirillico.

## Licenza

Tutte e tre sotto **SIL Open Font License 1.1**, in [`OFL.txt`](./OFL.txt). Il corpo della
licenza è **identico** nelle tre (verificato: differiscono solo per i fine riga), quindi è
scritto una volta sola; le tre note di copyright sono riportate tutte.

🔴 La licenza **richiede** che quel file accompagni i caratteri: non è documentazione, è una
condizione della redistribuzione.
