import { ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import { Form, Formik, FormikProps } from "formik";
import { toast } from "react-toastify";

import SchedaPagina from "./SchedaPagina";
import { useDatiScheda } from "./datiScheda";
import { faNascereLaPagina, faSparireLaPagina, ePubblicata, StatoPubblicazione } from "./pubblicazionePagina";
import { ETICHETTE_PAGINE, PERCORSI_SITO, PaginaSito } from "./ruoliPagine";
import MediaPickerDialog from "../MediaPickerDialog";
import SitoGuard from "../SitoGuard";
import { ValoriImpostazioniVetrina, valoriDaImpostazioni } from "../impostazioniVetrinaModulo";
import FormikToolbar from "../../../common/form/toolbar/FormikToolbar";
import useConfirm from "../../../common/confirm/useConfirm";
import PageTitleContext from "../../../layout/headerBar/PageTitleContext";
import { formStatuses } from "../../../../common/globals/constants";

/**
 * La parte **comune** alle tre schede che possiedono dei campi — Home, Il locale, Aperitivo.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * 🔴 **Una sola implementazione della conferma di sparizione.** Due pagine su cinque
 *    scompaiono dal sito quando il loro testo si svuota, e la conferma che lo annuncia è
 *    l'unico punto del prodotto in cui salvare **cancella un URL**. Scritta due volte,
 *    divergerebbe: la prima correzione andrebbe su una sola delle due e nessuno se ne
 *    accorgerebbe, perché una conferma mancata non lascia traccia.
 *
 * 🔴 **La condizione guarda il valore letto DAL SERVER**, non quello iniziale del modulo: la
 *    domanda è «la pagina è online adesso?», non «l'utente l'ha già toccata?».
 *
 * ⚠️ **Il titolo non entra nella condizione**, perché non entra nella regola del server: un
 *    titolo svuotato non fa sparire nulla, e una conferma che scattasse anche lì insegnerebbe
 *    una regola falsa. Ed estenderla a «ogni campo che si svuota» annegherebbe l'unico caso in
 *    cui svuotare cancella un indirizzo.
 * ─────────────────────────────────────────────────────────────────────────────────────────
 */

interface SchedaEditorialeProps {
  pagina: PaginaSito;
  /** La validazione della scheda: contiene il grappolo incrociato, se ne ha uno. */
  valida: (valori: ValoriImpostazioniVetrina) => Record<string, string> | undefined;
  /**
   * Esegue la scrittura. Quando viene chiamata, l'eventuale conferma è già stata data.
   * 🔴 Gli errori **si propagano**: il messaggio del server è già la spiegazione di cosa fare.
   */
  salva: (valori: ValoriImpostazioniVetrina) => Promise<unknown>;
  /** Il campo del modulo che porta lo slot immagine di questa pagina. */
  campoSlot: "immagineEroeHomeId" | "immagineRitrattoLocaleId" | "immagineEroeAperitivoId";
  /**
   * Il campo il cui **corpo** decide se la pagina esiste. Assente: la pagina esiste sempre.
   * `nome` è come si chiama il campo in pagina, non il nome della colonna.
   */
  campoDiEsistenza?: { chiave: "storiaTesto" | "aperitivoTesto"; nome: string };
  testiPropri: ReactNode;
  testiEreditati: (impostazioni: ImpostazioniVetrina | null) => ReactNode;
  altreSorgenti?: (impostazioni: ImpostazioniVetrina | null) => ReactNode;
}

function SchedaEditoriale({ pagina, valida, salva, campoSlot, campoDiEsistenza, testiPropri, testiEreditati, altreSorgenti }: SchedaEditorialeProps) {
  const { setTitle } = useContext(PageTitleContext);
  const onConfirm = useConfirm();
  const formRef = useRef<FormikProps<ValoriImpostazioniVetrina>>(null);
  const [sceltaImmagineAperta, setSceltaImmagineAperta] = useState(false);

  const { impostazioni, piano, caricamento, caricamentoPiano, errore } = useDatiScheda();

  const nomePagina = ETICHETTE_PAGINE[pagina];
  const percorsoSito = PERCORSI_SITO[pagina];

  useEffect(() => {
    setTitle(`Sito — ${nomePagina}`);
  }, [nomePagina, setTitle]);

  const initialValues = useMemo(() => valoriDaImpostazioni(impostazioni), [impostazioni]);

  const stato: StatoPubblicazione = useMemo(() => {
    if (!campoDiEsistenza) {
      return { tipo: "sempre" };
    }
    return { tipo: "condizionata", pubblicata: ePubblicata(impostazioni?.[campoDiEsistenza.chiave]), nomeCampo: campoDiEsistenza.nome };
  }, [campoDiEsistenza, impostazioni]);

  const handleResetForm = useCallback(
    async (haModifiche: boolean) => {
      const confermato =
        !haModifiche ||
        (await onConfirm({
          title: `Sito — ${nomePagina}`,
          content: "Sei sicuro di voler annullare le modifiche?",
          acceptLabel: "Si",
          cancelLabel: "No",
        }));
      if (!confermato) {
        return;
      }
      formRef.current?.resetForm();
    },
    [nomePagina, onConfirm]
  );

  const handleSubmit = useCallback(
    async (valori: ValoriImpostazioniVetrina) => {
      const dalServer = campoDiEsistenza ? impostazioni?.[campoDiEsistenza.chiave] : null;
      const dalModulo = campoDiEsistenza ? valori[campoDiEsistenza.chiave] : null;

      if (campoDiEsistenza && faSparireLaPagina(dalServer, dalModulo)) {
        // 🔴 Prima del salvataggio, non dopo: dopo, l'URL è già sparito e un avviso a cose
        //    fatte non è una scelta, è una notifica.
        const confermato = await onConfirm({
          title: `La pagina «${nomePagina}» sparisce dal sito`,
          content: `Salvando senza «${campoDiEsistenza.nome}», la pagina «${nomePagina}» sparisce dal sito: ${percorsoSito} risponderà «pagina non trovata» e la voce sparirà dal menu del sito e dalla sitemap. Procedo?`,
          acceptLabel: "Salva e ritira la pagina",
          cancelLabel: "Annulla",
        });
        if (!confermato) {
          return;
        }
      }

      const nasce = Boolean(campoDiEsistenza) && faNascereLaPagina(dalServer, dalModulo);
      const sparisce = Boolean(campoDiEsistenza) && faSparireLaPagina(dalServer, dalModulo);

      try {
        await salva(valori);
        if (nasce) {
          // Un indirizzo appena diventato raggiungibile non si ricava da nessun'altra parte.
          toast.success(`Salvato. La pagina «${nomePagina}» è ora pubblicata e raggiungibile su ${percorsoSito}.`);
        } else if (sparisce) {
          toast.success(`Salvato. La pagina «${nomePagina}» non è più sul sito: ${percorsoSito} risponde «pagina non trovata».`);
        } else {
          toast.success(`Pagina «${nomePagina}» aggiornata`);
        }
      } catch (erroreSalvataggio) {
        // Il server spiega già cosa non va (immagine non pubblicata, reputazione incoerente,
        // URL non valido): il messaggio si mostra così com'è.
        toast.error(erroreSalvataggio instanceof Error ? erroreSalvataggio.message : "Errore durante il salvataggio");
      }
    },
    [campoDiEsistenza, impostazioni, nomePagina, onConfirm, percorsoSito, salva]
  );

  const handleScegliImmagine = useCallback(
    (mediaAssetId: number | null) => {
      setSceltaImmagineAperta(false);
      formRef.current?.setFieldValue(campoSlot, mediaAssetId);
    },
    [campoSlot]
  );

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
          <Alert severity="error">Errore nel caricamento della scheda «{nomePagina}»: {errore.message}</Alert>
        </Box>
      </SitoGuard>
    );
  }

  return (
    <SitoGuard>
      <Formik
        validateOnChange
        validateOnBlur={false}
        innerRef={formRef}
        initialValues={initialValues}
        enableReinitialize
        validate={valida}
        onSubmit={handleSubmit}
        initialStatus={{ formStatus: formStatuses.UPDATE, isFormLocked: true }}
      >
        {({ values, status }) => (
          <Form style={{ display: "flex", flexDirection: "column", height: "calc(100dvh - 48px)" }}>
            <FormikToolbar
              onFormReset={handleResetForm}
              hideNewButton
              hideDeleteButton
              permissions={{ insertDenied: false, updateDenied: false, deleteDenied: true }}
            />
            <SchedaPagina
              pagina={pagina}
              stato={stato}
              piano={piano}
              caricamentoPiano={caricamentoPiano}
              azioneSlot={
                <Button
                  size="small"
                  variant="outlined"
                  disabled={Boolean(status?.isFormLocked)}
                  onClick={() => setSceltaImmagineAperta(true)}
                >
                  Scegli immagine
                </Button>
              }
              testiPropri={testiPropri}
              testiEreditati={testiEreditati(impostazioni)}
              altreSorgenti={altreSorgenti?.(impostazioni)}
            />
            <MediaPickerDialog
              open={sceltaImmagineAperta}
              selezionatoId={values[campoSlot]}
              onClose={() => setSceltaImmagineAperta(false)}
              onSelect={handleScegliImmagine}
            />
          </Form>
        )}
      </Formik>
    </SitoGuard>
  );
}

export default SchedaEditoriale;
