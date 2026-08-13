# Debiti aperti dopo l'apply di `vetrina-sito-astro`

Cose viste durante l'apply che **non** si aggiustano in fondo a un change: o perché toccano
file fuori dal perimetro, o perché sono giudizi che vanno guardati insieme invece che decisi
di corsa. Nessuna di queste blocca il change.

---

## 1. `docs/brand/README.md` dice ×1.55 e suggerisce `scaleX(1.5)` nella stessa riga

Il fattore di stiramento dell'insegna è **1.55**, misurato sull'artwork. Il README di marca lo
dichiara e due righe dopo suggerisce `transform: scaleX(1.5)` — lo stesso numero arrotondato
mentre si scriveva l'esempio. I due valori differiscono del 3,3%: su una riga di 600 px sono
20 px, visibilissimi in un confronto affiancato.

**Perché non è stato corretto qui**: `docs/brand/**` è dichiarato **invariato** in questo change
(Affected Areas), e `git diff --stat docs/brand/` vuoto è uno dei criteri di chiusura.

**Cosa fare**: un change di documentazione da un rigo, che punti al **token**
(`--stiramento-insegna`) invece di ripetere un numero — così la prossima volta non ci sono due
numeri da tenere allineati.

---

## 2. Le lavagne fotografate sono grigio freddo, la fascia del sito è carboncino caldo

La fascia «Aperitivo» usa `#251C19` (carboncino caldo) con gesso giallo `#FDDB5B`, campionati
dalla locandina «Aperitivo Apericosto». Le due lavagne che compaiono **nelle fotografie** di
`docs/` — il menu cubano dello spazio esterno e «Cocktail Cubani e Italiani» — sono invece
grigio **freddo** con gesso **bianco**.

**Perché non è stato cambiato**: i valori sono **misurati**, non scelti, e ritoccarli per farli
somigliare a due foto significherebbe sostituire una misura con un'impressione. La regola vale
in entrambe le direzioni.

**Cosa fare**: guardare le tre immagini insieme all'utente e decidere **quale** lavagna è quella
di riferimento. Se fosse quella fredda, cambiano due token — non il metodo.

---

## 3. L'apostrofo dello slogan in Allura è quasi invisibile

Lo slogan è *«L'attesa del piacere è essa stessa il piacere»*. Nella prima stesura era scritto
con l'apice dritto `'`, che in un corsivo inglese come Allura è un trattino verticale
sottilissimo: a schermo si legge «Lattesa». È stato sostituito con l'apostrofo tipografico
`’` (U+2019, dentro il subset latino, zero byte in più), che ha la forma di una virgola alta ed
è la scelta corretta.

⚠️ **Resta comunque delicato** alla misura attuale. Non è un difetto del testo, è la natura del
carattere.

**Cosa fare**: guardarlo su uno schermo vero prima del go-live. Se sparisce ancora, le strade
sono due — un corpo più grande per lo slogan, oppure riscriverlo senza elisione.

---

## 4. Prova B su un IP di rete: il certificato non lo nomina

La prova dei due prefissi divergenti (task 8.9) usa `https://192.168.1.232:4000` per i media, e
il certificato di sviluppo ASP.NET **non ha quell'IP fra i suoi SAN** — ha `localhost`,
`127.0.0.1` e qualche nome Docker. Nel browser questo produce un avviso di sicurezza da
accettare una volta; nella prova automatica è `ignoreHTTPSErrors: true`, cioè quel clic.

**Perché non è stato cambiato**: rigenerare il certificato di sviluppo con un SAN in più tocca
la macchina di chi sviluppa, non il repository, e serve a **una** prova che si esegue di rado.

**Cosa fare**: niente, finché resta una prova occasionale. Se diventasse abituale provare il
sito dal telefono sulla stessa rete, il comando è
`dotnet dev-certs https --export-path … ` con un certificato generato a parte che includa l'IP.
