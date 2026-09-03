import { useCallback } from "react";
import { useMutation } from "@apollo/client";
import { Link as RouterLink } from "react-router";
import { useField } from "formik";
import Alert from "@mui/material/Alert";
import Link from "@mui/material/Link";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";

import SchedaEditoriale from "./SchedaEditoriale";
import { SezioneScheda } from "./SchedaPagina";
import { PERCORSI_PANNELLO } from "./ruoliPagine";
import { ValoriImpostazioniVetrina, inputPiatto, validaPaginaPiatto } from "../impostazioniVetrinaModulo";
import FormikTextField from "../../../common/form/FormikTextField";
import { getImpostazioniVetrina, getRuoliImmaginiVetrina } from "../../../../graphql/vetrina/queries";
import { mutationMutatePaginaPiatto } from "../../../../graphql/vetrina/mutations";

/**
 * I sette giorni, **indice 0 = lunedì**.
 *
 * 🔴 La stessa indicizzazione di `OperatingDaysSection` e di `orari.giorniOperativi`, e **non**
 *    quella di `date.tsx`, che parte dalla domenica perché rispecchia `Date.getDay()`. È il
 *    fuori-di-uno più facile da introdurre in questo repository, e l'unico sintomo sarebbe una
 *    pagina pubblica che di mercoledì si intitola «Piatto del giovedì».
 */
const GIORNI = [
  { indice: 0, nome: "Lunedì" },
  { indice: 1, nome: "Martedì" },
  { indice: 2, nome: "Mercoledì" },
  { indice: 3, nome: "Giovedì" },
  { indice: 4, nome: "Venerdì" },
  { indice: 5, nome: "Sabato" },
  { indice: 6, nome: "Domenica" },
];

/**
 * La tendina del giorno.
 *
 * ⚠️ **Non** `FormikTextField`: quello scrive nel modulo il valore grezzo dell'evento, cioè una
 *    **stringa**, e `piattoGiorno` è un `number` — a database, nell'input GraphQL e nello schema
 *    di validazione. Un `"2"` al posto di `2` non darebbe alcun errore visibile qui e sarebbe
 *    rifiutato dallo schema al momento del salvataggio, con un messaggio che parla del giorno
 *    invece che del tipo. La conversione sta quindi in un posto solo, qui.
 */
function SceltaGiorno() {
  const [campo, meta, helper] = useField<number>("piattoGiorno");
  const errore = meta.touched ? meta.error : undefined;

  return (
    <TextField
      select
      fullWidth
      name={campo.name}
      value={campo.value}
      onBlur={campo.onBlur}
      onChange={(evento) => helper.setValue(Number(evento.target.value))}
      label="Giorno della settimana"
      error={Boolean(errore)}
      helperText={errore ?? "Dà il nome alla voce di menu del sito: «Piatto del mercoledì». L'indirizzo della pagina NON cambia — resta /piatto-del-giorno — così i link già condivisi continuano a funzionare."}
    >
      {GIORNI.map((giorno) => (
        <MenuItem
          key={giorno.indice}
          value={giorno.indice}
        >
          {giorno.nome}
        </MenuItem>
      ))}
    </TextField>
  );
}

/**
 * La scheda della pagina **«Piatto della settimana»** del sito.
 *
 * 🔴 **La scheda esiste sempre, anche quando la pagina non esiste.** Come per l'aperitivo:
 *    nasconderla finché la descrizione è vuota toglierebbe l'unico posto da cui quella
 *    descrizione si può scrivere.
 *
 * 🔴 **Un posto immagine soltanto, e senza ripiego** — e qui la ragione è più forte che
 *    sull'aperitivo: la pagina promette *un* piatto, e una foto pescata dalla galleria per
 *    posizione ne mostrerebbe un altro. Non sarebbe un'immagine mancante, sarebbe un'immagine
 *    che mente.
 *
 * ⚠️ **Nessun prezzo**, ed è una scelta del contratto: sarebbe un secondo prezzo accanto a
 *    quello di listino che la cassa aggiorna. Chi lo vuole mette il piatto a menu.
 */
function PaginaPiatto() {
  const [mutatePaginaPiatto] = useMutation(mutationMutatePaginaPiatto, {
    refetchQueries: [{ query: getImpostazioniVetrina }, { query: getRuoliImmaginiVetrina }],
    awaitRefetchQueries: true,
  });

  const salva = useCallback((valori: ValoriImpostazioniVetrina) => mutatePaginaPiatto({ variables: { input: inputPiatto(valori) } }), [mutatePaginaPiatto]);

  return (
    <SchedaEditoriale
      pagina="piatto"
      valida={validaPaginaPiatto}
      salva={salva}
      campoSlot="immagineEroePiattoId"
      campoDiEsistenza={{ chiave: "piattoTesto", nome: "Descrizione del piatto" }}
      testiPropri={
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12">
            <Alert severity="warning">
              Questa pagina ha <strong>un solo posto immagine e nessun ripiego</strong>: se non scegli una fotografia qui sopra, la pagina esce <strong>senza</strong>. È voluto — una foto presa dalla
              galleria mostrerebbe al cliente un piatto diverso da quello che stai descrivendo.
            </Alert>
          </div>
          <div className="col-span-12 sm:col-span-8">
            <FormikTextField
              name="piattoTitolo"
              label="Nome del piatto"
              helperText="Da solo NON fa esistere la pagina: è la descrizione a farlo. Vuoto, la pagina si intitola col solo giorno."
              fullWidth
            />
          </div>
          <div className="col-span-12 sm:col-span-4">
            <SceltaGiorno />
          </div>
          <div className="col-span-12">
            <FormikTextField
              name="piattoTesto"
              label="Descrizione del piatto"
              helperText="🔴 È questa descrizione a far esistere la pagina. Svuotandola, /piatto-del-giorno risponde 404 e sparisce dal menu del sito. Le righe vuote separano i capoversi."
              fullWidth
              multiline
              minRows={6}
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
            Questa pagina <strong>non mostra il prezzo</strong>, ed è deliberato: sarebbe un secondo prezzo accanto a quello di listino che la cassa aggiorna, e i due divergerebbero. Se vuoi che il
            piatto abbia un prezzo pubblico, mettilo a listino da{" "}
            <Link
              component={RouterLink}
              to="/gestionale/sito/prodotti"
            >
              Prodotti vetrina
            </Link>
            : la pagina rimanda già al{" "}
            <Link
              component={RouterLink}
              to={PERCORSI_PANNELLO.menu}
            >
              menu
            </Link>
            .
          </Alert>
        </SezioneScheda>
      )}
    />
  );
}

export default PaginaPiatto;
