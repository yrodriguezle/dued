import { useCallback } from "react";
import { useMutation } from "@apollo/client";
import { Link as RouterLink } from "react-router";
import Alert from "@mui/material/Alert";
import Link from "@mui/material/Link";

import SchedaEditoriale from "./SchedaEditoriale";
import { SezioneScheda, TestoEreditato } from "./SchedaPagina";
import { PERCORSI_PANNELLO } from "./ruoliPagine";
import AvvisoOrari from "../AvvisoOrari";
import { ValoriImpostazioniVetrina, inputHome, validaPaginaHome } from "../impostazioniVetrinaModulo";
import FormikTextField from "../../../common/form/FormikTextField";
import { getImpostazioniVetrina, getRuoliImmaginiVetrina } from "../../../../graphql/vetrina/queries";
import { mutationMutatePaginaHome } from "../../../../graphql/vetrina/mutations";

/**
 * La scheda della pagina **Home** del sito.
 *
 * 🔴 **Quattro posti immagine** — uno grande in cima più tre in griglia — e in più fino a tre
 *    fotografie che arrivano dai **prodotti** e non dalla galleria: sono dichiarate a parte da
 *    `SchedaPagina`, perché chi conta le foto della home le vede lo stesso e un conteggio che
 *    le tacesse mentirebbe in difetto.
 *
 * ⚠️ **I testi dell'aperitivo compaiono qui in sola lettura.** La home li rende — il richiamo
 *    all'aperitivo sta sulla home — ma appartengono alla scheda «Aperitivo»: la regola non è
 *    «un campo, una pagina», è **un campo, un proprietario**. Due schede che li scrivessero
 *    sarebbero due verità, e vincerebbe l'ultima che salva.
 *
 * ⚠️ La home **esiste sempre**: nessun campo di questa scheda può farla sparire, quindi non ha
 *    alcuno stato condizionato e nessuna conferma di sparizione al salvataggio.
 */
function PaginaHome() {
  const [mutatePaginaHome] = useMutation(mutationMutatePaginaHome, {
    // Il refetch riporta la riga salvata **e** il piano dei ruoli: cambiare lo slot cambia
    // quale foto la pagina usa, e il conteggio della scheda deve accorgersene subito.
    refetchQueries: [{ query: getImpostazioniVetrina }, { query: getRuoliImmaginiVetrina }],
    awaitRefetchQueries: true,
  });

  const salva = useCallback((valori: ValoriImpostazioniVetrina) => mutatePaginaHome({ variables: { input: inputHome(valori) } }), [mutatePaginaHome]);

  return (
    <SchedaEditoriale
      pagina="home"
      valida={validaPaginaHome}
      salva={salva}
      campoSlot="immagineEroeHomeId"
      testiPropri={
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12">
            <FormikTextField
              name="claimVetrina"
              label="Frase sotto il titolo"
              helperText="Il paragrafo che si legge in cima alla home, sotto l'insegna. Vuoto: la home mostra solo il titolo."
              fullWidth
              multiline
              minRows={2}
            />
          </div>
          <div className="col-span-12">
            {/* 🔴 I tre della reputazione stanno insieme perché il sito li mostra insieme: il
                punteggio senza il conteggio nasconde che le recensioni potrebbero essere tre. */}
            <Alert severity="info">Punteggio e numero di recensioni vanno inseriti <strong>insieme</strong>, oppure lasciati entrambi vuoti: il sito mostra i due numeri insieme o non li mostra affatto.</Alert>
          </div>
          <div className="col-span-6 sm:col-span-3">
            <FormikTextField
              name="punteggioGoogle"
              label="Punteggio Google"
              placeholder="4.7"
              fullWidth
            />
          </div>
          <div className="col-span-6 sm:col-span-3">
            <FormikTextField
              name="numeroRecensioniGoogle"
              label="Numero di recensioni"
              placeholder="180"
              fullWidth
            />
          </div>
          <div className="col-span-12 sm:col-span-6">
            <FormikTextField
              name="urlProfiloGoogle"
              label="Profilo Google"
              placeholder="https://www.google.com/maps/place/..."
              fullWidth
            />
          </div>
        </div>
      }
      testiEreditati={(impostazioni) => (
        <>
          <TestoEreditato
            etichetta="Insegna pubblica"
            valore={impostazioni?.insegnaPubblica}
            percorso="/gestionale/sito/impostazioni"
            etichettaPercorso="Impostazioni sito"
            nota="La legge ogni pagina del sito."
          />
          {/* ⚠️ Letti dalla home, POSSEDUTI dall'aperitivo. */}
          <TestoEreditato
            etichetta="Titolo dell'aperitivo"
            valore={impostazioni?.aperitivoTitolo}
            percorso={PERCORSI_PANNELLO.aperitivo}
            etichettaPercorso="Sito → Aperitivo"
            nota="La home lo mostra nel richiamo all'aperitivo, ma appartiene alla scheda dell'aperitivo."
          />
          <TestoEreditato
            etichetta="Testo dell'aperitivo"
            valore={impostazioni?.aperitivoTesto}
            percorso={PERCORSI_PANNELLO.aperitivo}
            etichettaPercorso="Sito → Aperitivo"
            nota="È anche il testo che decide se la pagina «Aperitivo» esiste."
          />
          <TestoEreditato
            etichetta="Cosa è compreso nell'aperitivo"
            valore={impostazioni?.aperitivoPunti}
            percorso={PERCORSI_PANNELLO.aperitivo}
            etichettaPercorso="Sito → Aperitivo"
          />
        </>
      )}
      altreSorgenti={() => (
        <SezioneScheda
          titolo="Altre sorgenti che la home mostra"
          descrizione="Non sono testi e non si modificano da qui: la home li legge da dove vivono."
        >
          <Alert
            severity="info"
            sx={{ mb: 2 }}
          >
            Le <strong>citazioni dei clienti</strong> sotto i numeri delle recensioni si aggiungono e si riordinano da{" "}
            <Link
              component={RouterLink}
              to="/gestionale/sito/recensioni"
            >
              Recensioni sito
            </Link>
            . I <strong>piatti</strong> dei tre «momenti» arrivano dal listino: si curano da{" "}
            <Link
              component={RouterLink}
              to="/gestionale/sito/prodotti"
            >
              Prodotti vetrina
            </Link>
            .
          </Alert>
          <AvvisoOrari />
        </SezioneScheda>
      )}
    />
  );
}

export default PaginaHome;
