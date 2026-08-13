import { useCallback } from "react";
import { useMutation } from "@apollo/client";
import { Link as RouterLink } from "react-router";
import Alert from "@mui/material/Alert";
import Link from "@mui/material/Link";

import SchedaEditoriale from "./SchedaEditoriale";
import { SezioneScheda } from "./SchedaPagina";
import { PERCORSI_PANNELLO } from "./ruoliPagine";
import { ValoriImpostazioniVetrina, inputAperitivo, validaPaginaAperitivo } from "../impostazioniVetrinaModulo";
import FormikTextField from "../../../common/form/FormikTextField";
import { getImpostazioniVetrina, getRuoliImmaginiVetrina } from "../../../../graphql/vetrina/queries";
import { mutationMutatePaginaAperitivo } from "../../../../graphql/vetrina/mutations";

/**
 * La scheda della pagina **«Aperitivo»** del sito.
 *
 * 🔴 **La scheda esiste sempre, anche quando la pagina non esiste.** Nasconderla finché il
 *    testo è vuoto toglierebbe l'unico posto da cui quel testo si può scrivere: è la scheda a
 *    **creare** la pagina, non il suo riflesso.
 *
 * 🔴 **Un posto immagine soltanto, e senza ripiego.** È l'unico punto del sito in cui un posto
 *    vuoto non mostra niente: prima di questo change la pagina prendeva «l'ultima foto della
 *    galleria», quindi caricare una foto qualsiasi — anche per un'altra pagina — cambiava di
 *    nascosto l'immagine di testata. La scheda lo dichiara a chiare lettere, perché è l'unico
 *    punto in cui il sito mostra **meno** di prima ed è una scelta, non un guasto.
 *
 * ⚠️ I quattro testi sono **letti anche dalla home** e restano di proprietà di questa scheda.
 */
function PaginaAperitivo() {
  const [mutatePaginaAperitivo] = useMutation(mutationMutatePaginaAperitivo, {
    refetchQueries: [{ query: getImpostazioniVetrina }, { query: getRuoliImmaginiVetrina }],
    awaitRefetchQueries: true,
  });

  const salva = useCallback((valori: ValoriImpostazioniVetrina) => mutatePaginaAperitivo({ variables: { input: inputAperitivo(valori) } }), [mutatePaginaAperitivo]);

  return (
    <SchedaEditoriale
      pagina="aperitivo"
      valida={validaPaginaAperitivo}
      salva={salva}
      campoSlot="immagineEroeAperitivoId"
      campoDiEsistenza={{ chiave: "aperitivoTesto", nome: "Testo dell'aperitivo" }}
      testiPropri={
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12">
            <Alert severity="warning">
              Questa pagina ha <strong>un solo posto immagine e nessun ripiego</strong>: se non scegli un&apos;immagine qui sopra, la pagina esce <strong>senza</strong> immagine di testata. È voluto — prima bastava caricare una foto qualsiasi in galleria per
              cambiarla senza accorgersene.
            </Alert>
          </div>
          <div className="col-span-12 sm:col-span-8">
            <FormikTextField
              name="aperitivoTitolo"
              label="Titolo dell'aperitivo"
              helperText="Da solo NON fa esistere la pagina: è il testo a farlo."
              fullWidth
            />
          </div>
          <div className="col-span-12">
            <FormikTextField
              name="aperitivoTesto"
              label="Testo dell'aperitivo"
              helperText="🔴 È questo testo a far esistere la pagina «Aperitivo». Svuotandolo, /aperitivo risponde 404 e sparisce dal menu del sito. Lo legge anche la home."
              fullWidth
              multiline
              minRows={5}
            />
          </div>
          <div className="col-span-12 sm:col-span-6">
            <FormikTextField
              name="aperitivoPunti"
              label="Cosa è compreso"
              helperText="Una voce per riga. Ne vengono pubblicate al massimo sei."
              fullWidth
              multiline
              minRows={4}
            />
          </div>
          <div className="col-span-12 sm:col-span-6">
            <FormikTextField
              name="aperitivoCategorie"
              label="Categorie di vetrina mostrate"
              helperText="Una per riga, col nome ESATTO della categoria di vetrina: il sito non indovina per somiglianza."
              fullWidth
              multiline
              minRows={4}
            />
          </div>
        </div>
      }
      altreSorgenti={() => (
        <SezioneScheda
          titolo="Altre sorgenti che la pagina mostra"
          descrizione="Non sono testi e non si modificano da qui."
        >
          <Alert severity="info">
            I <strong>piatti e i cocktail</strong> elencati arrivano dal listino, filtrati per le categorie scritte qui sopra: si curano da{" "}
            <Link
              component={RouterLink}
              to="/gestionale/sito/prodotti"
            >
              Prodotti vetrina
            </Link>
            . Il richiamo all&apos;aperitivo che compare sulla{" "}
            <Link
              component={RouterLink}
              to={PERCORSI_PANNELLO.home}
            >
              home
            </Link>{" "}
            usa questi stessi testi.
          </Alert>
        </SezioneScheda>
      )}
    />
  );
}

export default PaginaAperitivo;
