import { Link as RouterLink } from "react-router";
import Alert from "@mui/material/Alert";
import Link from "@mui/material/Link";

/**
 * Dove si modificano gli orari — **una frase sola, in un file solo**.
 *
 * 🔴 Gli orari hanno una sorgente unica (`BusinessSettings`, le impostazioni della cassa) e
 *    nessuna scheda del sito ne offre un campo: il modello non li possiede, nessuno dei quattro
 *    input li accetta e una `[Theory]` su quattro mutation × sei campi lo pretende. Ma **tre**
 *    schede li mostrano — Home, Contatti e Impostazioni sito — e in tutte e tre qualcuno li
 *    cercherà: dirlo dove li cerca costa una riga, non dirlo costa un sito che dice «aperto
 *    fino alle 21» e una cassa che dice 19.
 *
 * ⚠️ Sta in un componente proprio e non ricopiato in tre pagine perché una frase in tre copie
 *    si corregge in una sola: il giorno in cui il percorso delle impostazioni cambia, due
 *    schede porterebbero a un collegamento morto.
 */
function AvvisoOrari() {
  return (
    <Alert severity="info">
      Gli orari di apertura e chiusura, i giorni di apertura e il fuso orario non si modificano da qui: il sito li legge dalle{" "}
      <Link
        component={RouterLink}
        to="/gestionale/settings"
      >
        impostazioni della cassa
      </Link>
      , che ne sono l&apos;unica sorgente.
    </Alert>
  );
}

export default AvvisoOrari;
