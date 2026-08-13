// Da un elenco di DATE a una frase che una persona legge.
//
// L'API manda le chiusure una per giorno, ed è la forma giusta per lo script («sono chiuso
// oggi?» è un confronto di stringhe). Ma tredici righe «10 agosto, 11 agosto, 12 agosto…» non
// sono un avviso: l'avviso è «dal 10 al 22 agosto», ed è questo modulo a comporlo.
//
// 🔴 Nessuna aritmetica su oggetti Date, e nessuna stringa con l'ora dentro. `new Date('2026-08-10')`
//    è mezzanotte UTC, `new Date('2026-08-10T00:00:00')` è mezzanotte LOCALE, e la differenza si
//    manifesta come un giorno di scarto solo per i visitatori a est di Greenwich. Qui le date si
//    spezzano nei tre numeri e si ricompongono con `Date.UTC`: un solo fuso, quello di nessuno,
//    usato unicamente per contare i giorni e per dare un nome ai mesi.

/**
 * Come schema.org scrive «chiuso»: un intervallo di durata nulla.
 *
 * 🔴 **Non è un orario del locale, ed è l'unica ragione per cui questa stringa ha diritto di
 *    esistere in un sorgente.** Il test `orari-sorgenti.test.mjs` vieta gli orari scritti a
 *    mano perché hanno una sorgente sola — il database che la cassa legge e scrive — e questo
 *    non ne è uno: è la convenzione con cui `specialOpeningHoursSpecification` codifica un
 *    giorno di chiusura, e vale `00:00`–`00:00` a Thiene come ovunque. Il test lo sa: è
 *    dichiarato fra le sue due eccezioni, con questa ragione.
 *
 * ⚠️ Senza, i dati strutturati continuerebbero a dichiarare il locale aperto durante le ferie
 *    — cioè lo stesso guasto della pagina, nella copia che leggono i motori e che finisce
 *    nella scheda del locale. È la metà che nessuno guarda finché non è in giro da settimane.
 */
export const ORARIO_CHIUSO_SCHEMA = '00:00';

/** Un blocco di giorni contigui chiusi per la stessa ragione. */
export interface PeriodoChiuso {
  /** `"yyyy-MM-dd"`. */
  inizio: string;
  /** `"yyyy-MM-dd"`. Uguale a `inizio` quando il periodo è di un giorno solo. */
  fine: string;
  giorni: number;
  descrizione: string;
  motivo: string;
}

/** Una chiusura come arriva dall'API. */
interface Chiusura {
  data: string;
  descrizione: string;
  motivo: string;
}

const MILLISECONDI_AL_GIORNO = 86_400_000;

/** I tre numeri di `"yyyy-MM-dd"` come istante UTC. Mai un parse di stringa. */
function istante(data: string): number {
  const [anno, mese, giorno] = data.split('-').map(Number);
  return Date.UTC(anno, mese - 1, giorno);
}

/**
 * I giorni contigui con la stessa descrizione diventano **un** periodo.
 *
 * ⚠️ Si raggruppa sulla descrizione e non sul motivo: due chiusure di seguito con lo stesso
 *    codice ma testi diversi («Ferie» e poi «Riapertura ritardata») sono due cose da dire, e
 *    fonderle ne farebbe sparire una. Il motivo si porta dietro quello del primo giorno.
 *
 * ⚠️ La contiguità si misura in giorni, non «l'indice successivo»: l'elenco può avere buchi —
 *    chiuso lunedì e mercoledì, aperto martedì — e trattarli come un blocco unico direbbe al
 *    visitatore che il bar è chiuso in un giorno in cui è aperto.
 */
export function raggruppa(chiusure: readonly Chiusura[]): PeriodoChiuso[] {
  return chiusure.reduce<PeriodoChiuso[]>((periodi, chiusura) => {
    const ultimo = periodi[periodi.length - 1];
    const contiguo =
      ultimo !== undefined &&
      ultimo.descrizione === chiusura.descrizione &&
      istante(chiusura.data) - istante(ultimo.fine) === MILLISECONDI_AL_GIORNO;

    if (contiguo) {
      ultimo.fine = chiusura.data;
      ultimo.giorni += 1;
      return periodi;
    }

    return [
      ...periodi,
      {
        inizio: chiusura.data,
        fine: chiusura.data,
        giorni: 1,
        descrizione: chiusura.descrizione,
        motivo: chiusura.motivo,
      },
    ];
  }, []);
}

function parti(data: string, opzioni: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('it-IT', { timeZone: 'UTC', ...opzioni }).format(
    new Date(istante(data))
  );
}

/**
 * Il periodo in italiano: `"giovedì 13 agosto"`, `"dal 10 al 22 agosto"`,
 * `"dal 28 dicembre al 3 gennaio"`.
 *
 * ⚠️ Il mese si ripete solo quando cambia. «dal 10 agosto al 22 agosto» si legge peggio, e
 *    «dal 28 al 3 gennaio» sarebbe sbagliato: il 28 è di dicembre.
 *
 * ⚠️ Nessun anno, deliberatamente: la finestra che l'API manda è di due mesi, quindi non c'è
 *    ambiguità da risolvere e l'anno sarebbe rumore in una fascia che si legge di sfuggita.
 */
export function descrivi(periodo: PeriodoChiuso): string {
  if (periodo.inizio === periodo.fine) {
    return parti(periodo.inizio, { weekday: 'long', day: 'numeric', month: 'long' });
  }

  const stessoMese = periodo.inizio.slice(0, 7) === periodo.fine.slice(0, 7);
  const dal = stessoMese
    ? parti(periodo.inizio, { day: 'numeric' })
    : parti(periodo.inizio, { day: 'numeric', month: 'long' });

  return `dal ${dal} al ${parti(periodo.fine, { day: 'numeric', month: 'long' })}`;
}
