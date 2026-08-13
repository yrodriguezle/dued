import { useCallback } from "react";
import { useMutation } from "@apollo/client";

import SchedaEditoriale from "./SchedaEditoriale";
import { ValoriImpostazioniVetrina, inputLocale, validaPaginaLocale } from "../impostazioniVetrinaModulo";
import FormikTextField from "../../../common/form/FormikTextField";
import { getImpostazioniVetrina, getRuoliImmaginiVetrina } from "../../../../graphql/vetrina/queries";
import { mutationMutatePaginaLocale } from "../../../../graphql/vetrina/mutations";

/**
 * La scheda della pagina **«Il locale»** del sito.
 *
 * 🔴 **È una delle due pagine che possono non esistere.** Senza il testo della storia,
 *    `/locale` risponde 404 e sparisce da intestazione, piè di pagina e sitemap. Lo stato lo
 *    dichiara la **prima riga** della scheda, e svuotare il testo chiede conferma **prima** di
 *    salvare: è l'unico punto del prodotto in cui salvare cancella un indirizzo.
 *
 * ⚠️ **Il titolo da solo non fa esistere la pagina**, perché il server guarda soltanto il corpo
 *    del testo. La scheda lo dice invece di lasciarlo scoprire pubblicando.
 *
 * 🔴 **Quattro posti immagine**: un ritratto verticale scelto da qui più tre quadrate che
 *    arrivano dalla galleria.
 */
function PaginaLocale() {
  const [mutatePaginaLocale] = useMutation(mutationMutatePaginaLocale, {
    refetchQueries: [{ query: getImpostazioniVetrina }, { query: getRuoliImmaginiVetrina }],
    awaitRefetchQueries: true,
  });

  const salva = useCallback((valori: ValoriImpostazioniVetrina) => mutatePaginaLocale({ variables: { input: inputLocale(valori) } }), [mutatePaginaLocale]);

  return (
    <SchedaEditoriale
      pagina="locale"
      valida={validaPaginaLocale}
      salva={salva}
      campoSlot="immagineRitrattoLocaleId"
      campoDiEsistenza={{ chiave: "storiaTesto", nome: "Storia del locale" }}
      testiPropri={
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 sm:col-span-8">
            <FormikTextField
              name="storiaTitolo"
              label="Titolo della storia"
              helperText="Il titolo in cima alla pagina. Da solo NON fa esistere la pagina: è il testo a farlo."
              fullWidth
            />
          </div>
          <div className="col-span-12">
            <FormikTextField
              name="storiaTesto"
              label="Storia del locale"
              helperText="🔴 È questo testo a far esistere la pagina «Il locale». Svuotandolo, /locale risponde 404 e sparisce dal menu del sito."
              fullWidth
              multiline
              minRows={6}
            />
          </div>
        </div>
      }
    />
  );
}

export default PaginaLocale;
