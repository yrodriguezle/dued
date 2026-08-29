import { useCallback, useContext, useEffect } from "react";
import Box from "@mui/material/Box";
import { useNavigate } from "react-router";

import ElencoOrdiniAperti from "./ElencoOrdiniAperti";
import PageTitleContext from "../../layout/headerBar/PageTitleContext";

/**
 * Il percorso del punto vendita, così com'è seminato in `SeedMenusVendita`.
 *
 * ⚠️ Costante e non stringa sparsa: è l'unico punto in cui questa pagina sa dell'altra, e
 * cambiarlo in un posto solo è ciò che rende il refuso una riga da correggere invece che una
 * navigazione che non porta da nessuna parte.
 */
const PERCORSO_PUNTO_VENDITA = "/gestionale/cassa/vendita";

/**
 * Gli **ordini aperti come pagina**, sorella di «Vendita» al primo livello della sidebar.
 *
 * <p>🔴 <b>Perché esiste.</b> Lo stesso elenco si raggiungeva soltanto da due posti — da dentro
 * il punto vendita e dalla scheda del registro quando la guardia blocca la chiusura di cassa —
 * cioè sempre <i>di reazione</i>, mai di proposito. Con più ordini aperti insieme, che al banco
 * è la norma e non l'eccezione, l'elenco è il posto da cui si guarda la giornata: quanti conti
 * sono in piedi, per quanto, da quando. Un rimedio a un blocco non è una risposta a quella
 * domanda.</p>
 *
 * <p>⚠️ <b>Nessun filtro sul registro di oggi</b>, e non è una dimenticanza: un ordine aperto
 * alle 23:50 sta sul registro di ieri e alle 00:05 è ancora lì. Filtrare su oggi lo renderebbe
 * invisibile proprio mentre blocca la chiusura di ieri — la trappola della mezzanotte, che
 * `ordiniAperti` evita rendendo il registro un argomento <b>opzionale</b>.</p>
 *
 * <p>🔴 <b>«Riprendi» porta al punto vendita con l'ordine scelto</b>, passandolo nello `state`
 * della navigazione. L'alternativa era non offrire l'azione qui — da una pagina non c'è un
 * bancone a cui consegnare l'ordine — ma «riprendi» è esattamente il gesto per cui si apre
 * questo elenco quando due conti sono in piedi. Lasciarlo fuori avrebbe reso la pagina un posto
 * da cui guardare senza poter agire.</p>
 */
function Ordini() {
  const { setTitle } = useContext(PageTitleContext);
  const navigate = useNavigate();

  useEffect(() => {
    setTitle("Ordini");
  }, [setTitle]);

  const handleRiprendi = useCallback(
    (ordine: Ordine) => {
      navigate(PERCORSO_PUNTO_VENDITA, { state: { ordineDaRiprendere: ordine.ordineId } });
    },
    [navigate]
  );

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "calc(100dvh - 64px)", overflow: "auto" }}>
      <ElencoOrdiniAperti
        attivo
        onRiprendi={handleRiprendi}
        titolo="Ordini aperti"
        descrizione={null}
      />
    </Box>
  );
}

export default Ordini;
