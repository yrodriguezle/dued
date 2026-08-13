import { useContext, useEffect } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";

import SchedaPagina, { SezioneScheda, TestoEreditato } from "./SchedaPagina";
import { useDatiScheda } from "./datiScheda";
import AvvisoOrari from "../AvvisoOrari";
import SitoGuard from "../SitoGuard";
import PageTitleContext from "../../../layout/headerBar/PageTitleContext";

const IMPOSTAZIONI = "/gestionale/sito/impostazioni";

/**
 * La scheda della pagina **Contatti** del sito.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * 🔴 **Zero immagini, e lo dice.** È l'unica pagina del sito che non ne ospita nessuna, e
 *    l'assenza della sezione non sarebbe una risposta: sarebbe la stessa mancanza di
 *    informazione da cui questo pannello nasce. `SchedaPagina` scrive «zero posti» per esteso.
 *
 * 🔴 **Nessun modulo e nessun «Salva»**: questa pagina non possiede alcun testo proprio. Tutto
 *    ciò che mostra — indirizzo, posizione, contatti, social, orari — vive altrove e da lì si
 *    cambia, una volta sola per tutte le pagine che lo usano.
 * ─────────────────────────────────────────────────────────────────────────────────────────
 */
function PaginaContatti() {
  const { setTitle } = useContext(PageTitleContext);
  const { impostazioni, piano, caricamento, caricamentoPiano, errore } = useDatiScheda();

  useEffect(() => {
    setTitle("Sito — Contatti");
  }, [setTitle]);

  if (caricamento) {
    return (
      <SitoGuard>
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "50dvh" }}>
          <CircularProgress />
        </Box>
      </SitoGuard>
    );
  }

  if (errore) {
    return (
      <SitoGuard>
        <Box sx={{ p: 2 }}>
          <Alert severity="error">Errore nel caricamento della scheda «Contatti»: {errore.message}</Alert>
        </Box>
      </SitoGuard>
    );
  }

  const indirizzo = [impostazioni?.via, [impostazioni?.cap, impostazioni?.citta].filter(Boolean).join(" "), impostazioni?.provincia, impostazioni?.paese].filter((parte) => parte && String(parte).trim() !== "").join(" · ");
  const coordinate = impostazioni?.latitudine !== null && impostazioni?.latitudine !== undefined && impostazioni?.longitudine !== null && impostazioni?.longitudine !== undefined ? `${impostazioni.latitudine}, ${impostazioni.longitudine}` : "";

  return (
    <SitoGuard>
      <Box sx={{ display: "flex", flexDirection: "column", height: "calc(100dvh - 48px)" }}>
        <SchedaPagina
          pagina="contatti"
          stato={{ tipo: "sempre" }}
          piano={piano}
          caricamentoPiano={caricamentoPiano}
          senzaTestiPropri={
            <Alert severity="info">
              Questa pagina <strong>non possiede alcun testo</strong>: non c&apos;è nulla da compilare qui, ed è la ragione per cui questa scheda non ha un pulsante «Salva». È una mappa di ciò che la governa, e tutto ciò che mostra è elencato qui sotto con il
              collegamento a dove si cambia.
            </Alert>
          }
          testiEreditati={
            <>
              <TestoEreditato
                etichetta="Insegna pubblica"
                valore={impostazioni?.insegnaPubblica}
                percorso={IMPOSTAZIONI}
                etichettaPercorso="Impostazioni sito"
              />
              <TestoEreditato
                etichetta="Indirizzo"
                valore={indirizzo}
                percorso={IMPOSTAZIONI}
                etichettaPercorso="Impostazioni sito"
                nota="Scomposto in via, CAP, città, provincia e paese: è la forma che i motori di ricerca leggono."
              />
              <TestoEreditato
                etichetta="Posizione sulla mappa"
                valore={coordinate}
                percorso={IMPOSTAZIONI}
                etichettaPercorso="Impostazioni sito"
                nota="Servono entrambe le coordinate o nessuna: senza, la pagina non mostra la mappa."
              />
              <TestoEreditato
                etichetta="Telefono"
                valore={impostazioni?.telefono}
                percorso={IMPOSTAZIONI}
                etichettaPercorso="Impostazioni sito"
              />
              <TestoEreditato
                etichetta="Email"
                valore={impostazioni?.email}
                percorso={IMPOSTAZIONI}
                etichettaPercorso="Impostazioni sito"
              />
              <TestoEreditato
                etichetta="Instagram"
                valore={impostazioni?.urlInstagram}
                percorso={IMPOSTAZIONI}
                etichettaPercorso="Impostazioni sito"
              />
              <TestoEreditato
                etichetta="Facebook"
                valore={impostazioni?.urlFacebook}
                percorso={IMPOSTAZIONI}
                etichettaPercorso="Impostazioni sito"
              />
            </>
          }
          altreSorgenti={
            <SezioneScheda
              titolo="Gli orari"
              descrizione="La pagina li mostra, ma non hanno alcun campo in nessuna scheda del sito."
            >
              <AvvisoOrari />
            </SezioneScheda>
          }
        />
      </Box>
    </SitoGuard>
  );
}

export default PaginaContatti;
