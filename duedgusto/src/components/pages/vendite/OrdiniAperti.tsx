import { ReactNode } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Drawer from "@mui/material/Drawer";

import ElencoOrdiniAperti from "./ElencoOrdiniAperti";

interface OrdiniApertiProps {
  aperto: boolean;
  /**
   * Limita l'elenco a un registro. **Omesso, li mostra tutti** — ed è il caso normale al banco:
   * un ordine aperto ieri sera è ancora aperto stamattina, e nasconderlo lo renderebbe
   * irraggiungibile proprio mentre blocca la chiusura di ieri.
   */
  registroCassaId?: number | null;
  onChiudi: () => void;
  /** Assente, l'azione «riprendi» non compare: fuori dal punto vendita non c'è dove riprenderlo. */
  onRiprendi?: (ordine: Ordine) => void;
  /** Chiamato dopo ogni incasso o annullo riuscito, per far riallineare chi sta intorno. */
  onRisolto?: () => Promise<void> | void;
  titolo?: string;
  descrizione?: ReactNode;
}

/**
 * Gli ordini aperti **in un cassetto che sale dal basso**: è la forma con cui l'elenco compare
 * da dentro il punto vendita e dalla scheda del registro quando la guardia blocca la chiusura.
 *
 * <p>🔴 <b>Qui non c'è più alcuna logica.</b> Query, mutation e dialog di conferma vivono in
 * <c>ElencoOrdiniAperti</c>, che la pagina «Ordini» monta senza guscio. Questo componente è il
 * solo <i>contenitore</i>, ed è ciò che i due chiamanti storici continuano a usare senza
 * cambiare una riga.</p>
 *
 * <p>⚠️ <b>Il pulsante «Chiudi» sta qui e non nel corpo</b>, ed è la ragione per cui i due si
 * separano: chiude il cassetto, e da una pagina non avrebbe un chiamante a cui tornare.</p>
 */
function OrdiniAperti({ aperto, registroCassaId, onChiudi, onRiprendi, onRisolto, titolo, descrizione }: OrdiniApertiProps) {
  return (
    <Drawer
      anchor="bottom"
      open={aperto}
      onClose={onChiudi}
      slotProps={{ paper: { sx: { borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: "88dvh" } } }}
    >
      <Box sx={{ maxWidth: 640, mx: "auto", width: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
        <ElencoOrdiniAperti
          attivo={aperto}
          registroCassaId={registroCassaId}
          onRiprendi={onRiprendi}
          onRisolto={onRisolto}
          titolo={titolo}
          descrizione={descrizione}
        />

        <Button
          fullWidth
          onClick={onChiudi}
          sx={{ mx: "auto", mb: 2, width: "calc(100% - 32px)", minHeight: 44 }}
        >
          Chiudi
        </Button>
      </Box>
    </Drawer>
  );
}

export default OrdiniAperti;
