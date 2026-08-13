// La formattazione dei numeri che finiscono in pagina. Un posto solo.
//
// Stava inline in `SchedaProdotto.astro`, dove era corretta. Ora i prezzi compaiono in sei
// punti diversi — listino, momenti della home, lavagna, cocktail, card dell'apericosto — e
// sei copie di un `Intl.NumberFormat` sono sei occasioni perché una diverga dalle altre.

/**
 * Il prezzo, in euro, come lo scrive un italiano: `1,20 €`.
 *
 * 🔴 **`0` è un OMAGGIO, non un'assenza.** Il prezzo arriva già risolto dal backend, dove
 *    la regola condivisa distingue i due casi: solo `null` sarebbe assenza, e il DTO lo
 *    direbbe. Chi scrive `prezzo || '—'` o `prezzo > 0 ? … : …` trasforma in silenzio un
 *    omaggio in un prezzo mancante — è il bug che la regola del backend esiste per evitare,
 *    riportato dal consumatore.
 *
 * ⚠️ Lo spazio prima di `€` che `Intl` produce è **U+00A0**, non uno spazio normale: è ciò
 *    che impedisce al simbolo di andare a capo da solo in fondo a una riga stretta. Sta nel
 *    subset latino dei caratteri, quindi non costa un byte né manca un glifo.
 */
const formattatore = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
});

export function euro(importo: number): string {
  return formattatore.format(importo);
}

/**
 * L'ora `"HH:mm"` così com'è. Esiste per una ragione sola: **non** trasformarla.
 *
 * ⚠️ La tentazione è passarla per `Date` e formattarla. Sarebbe un baco: `new Date("20:00")`
 *    non è una data, e ogni ricostruzione (`new Date(\`1970-01-01T${ora}\`)`) reintroduce
 *    il fuso del lettore proprio nel dato che il progetto tiene ancorato a Roma.
 *    Il backend manda già la forma di destinazione.
 */
export function ora(hhmm: string): string {
  return hhmm;
}

/** I sette giorni, indice 0 = lunedì, come `orari.giorniOperativi` del DTO pubblico. */
export const GIORNI_ESTESI = [
  'Lunedì',
  'Martedì',
  'Mercoledì',
  'Giovedì',
  'Venerdì',
  'Sabato',
  'Domenica',
] as const;

/** Le abbreviazioni per gli spazi stretti. Stesso indice. */
export const GIORNI_BREVI = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'] as const;

/**
 * I giorni di apertura in una riga: `lun—sab`, `lun—ven · dom`, `mar`.
 *
 * ⚠️ Comprime **solo le sequenze davvero contigue**, e non presume che l'unica chiusura sia
 *    la domenica. Un locale che chiude il lunedì esiste, e un `lun—sab` scritto a mano
 *    diventerebbe falso senza che nessun test lo veda: è testo, non calcolo.
 *
 * ⚠️ Restituisce `null` quando `giorniOperativi` è `null` — il DTO lo prevede, quando il
 *    JSON persistito non è leggibile come sette booleani. In quel caso **si omette la riga
 *    dei giorni**, invece di dichiararne di sbagliati.
 */
export function riassumiGiorni(giorniOperativi: boolean[] | null | undefined): string | null {
  if (!giorniOperativi || giorniOperativi.length !== 7) return null;
  if (!giorniOperativi.some(Boolean)) return null;

  const blocchi: string[] = [];
  let inizio = -1;

  for (let i = 0; i <= 7; i++) {
    const aperto = i < 7 && giorniOperativi[i];
    if (aperto && inizio === -1) inizio = i;
    if (!aperto && inizio !== -1) {
      const fine = i - 1;
      // Due giorni contigui si scrivono per esteso: `lun—mar` non è più corto di `lun · mar`
      // e si legge come un intervallo lungo.
      blocchi.push(
        fine - inizio >= 2
          ? `${GIORNI_BREVI[inizio]}—${GIORNI_BREVI[fine]}`
          : Array.from({ length: fine - inizio + 1 }, (_, k) => GIORNI_BREVI[inizio + k]).join(' · ')
      );
      inizio = -1;
    }
  }

  return blocchi.join(' · ');
}
