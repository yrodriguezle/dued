import { ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import { Form, Formik, FormikProps } from "formik";
import { toast } from "react-toastify";

import SchedaPagina from "./SchedaPagina";
import { useDatiScheda } from "./datiScheda";
import { faNascereLaPagina, faSparireLaPagina, ePubblicata, StatoPubblicazione } from "./pubblicazionePagina";
import { ETICHETTE_PAGINE, PERCORSI_SITO, PaginaSito } from "./ruoliPagine";
import MediaPickerDialog from "../MediaPickerDialog";
import SitoGuard from "../SitoGuard";
import { larghezzaAnteprima, mediaUrl } from "../mediaUrl";
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
  /**
   * ⚠️ **Non c'è alcun `testiEreditati`**, e l'assenza è il punto: i testi ereditati arrivano
   * dalla mappa del server. Una prop per passarli sarebbe l'invito a riscriverli a mano dentro
   * ogni scheda — che è esattamente com'erano prima, e come divergevano dai sorgenti del sito.
   */
  altreSorgenti?: (impostazioni: ImpostazioniVetrina | null) => ReactNode;
}

/**
 * L'immagine appena scelta e non ancora salvata, accanto al pulsante che l'ha scelta.
 *
 * ⚠️ È volutamente **distinta** dalle anteprime della sezione: quelle dicono «ecco cosa il sito
 *    rende adesso», questa dice «ecco cosa renderà se salvi». Fonderle vorrebbe dire mostrare
 *    come pubblicato qualcosa che non lo è ancora, che è il difetto opposto e peggiore.
 */
function AnteprimaScelta({ scelta, daSalvare }: { scelta: { asset: MediaAsset | null } | null; daSalvare: boolean }) {
  if (!scelta || !daSalvare) {
    return null;
  }
  const larghezza = scelta.asset ? larghezzaAnteprima(scelta.asset.larghezzeDisponibili) : null;
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
      {scelta.asset && larghezza ? (
        <Box
          component="img"
          src={mediaUrl(scelta.asset.chiave, larghezza)}
          alt={scelta.asset.testoAlternativo || scelta.asset.nomeOriginale}
          title={scelta.asset.nomeOriginale}
          sx={{ width: 72, height: 40, objectFit: "cover", borderRadius: 0.5, display: "block" }}
        />
      ) : (
        <Typography
          variant="caption"
          color="text.secondary"
        >
          {scelta.asset ? scelta.asset.nomeOriginale : "Nessuna immagine"}
        </Typography>
      )}
      <Chip
        size="small"
        color="warning"
        label="da salvare"
      />
    </Box>
  );
}

function SchedaEditoriale({ pagina, valida, salva, campoSlot, campoDiEsistenza, testiPropri, altreSorgenti }: SchedaEditorialeProps) {
  const { setTitle } = useContext(PageTitleContext);
  const onConfirm = useConfirm();
  const formRef = useRef<FormikProps<ValoriImpostazioniVetrina>>(null);
  const [sceltaImmagineAperta, setSceltaImmagineAperta] = useState(false);
  /**
   * L'immagine scelta in questa sessione di modifica e **non ancora salvata**.
   *
   * 🔴 Serve perché le anteprime della scheda arrivano dal **piano del server**, che di una
   *    scelta non ancora scritta non sa niente: senza questo stato la modale si chiudeva e la
   *    pagina restava identica — stessa miniatura, stesso «1 posto · 1 occupato», stesso testo
   *    di provenienza. Un clic senza risposta è indistinguibile da un clic perduto, ed è la
   *    ragione per cui la scelta sembrava non funzionare.
   *
   * ⚠️ `null` = nessuna scelta fatta adesso; `{ asset: null }` = scelto «nessuna immagine», che
   *    è una decisione e non un'assenza di decisione. Le due cose non possono collassare in un
   *    solo `null`, altrimenti staccare un'immagine tornerebbe a non dare alcun riscontro.
   */
  const [sceltaPendente, setSceltaPendente] = useState<{ asset: MediaAsset | null } | null>(null);

  const { impostazioni, piano, mappa, caricamento, caricamentoPiano, errore } = useDatiScheda();

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
      // Annullare le modifiche annulla anche la scelta dell'immagine: è una modifica come le
      // altre, e lasciarne il riscontro acceso direbbe che c'è ancora qualcosa da salvare.
      setSceltaPendente(null);
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
        // Salvato: da qui in poi l'anteprima autorevole è quella del piano, appena riletto dal
        // server. Tenere acceso «da salvare» dopo il salvataggio sarebbe una bugia.
        setSceltaPendente(null);
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
    (mediaAssetId: number | null, asset?: MediaAsset) => {
      setSceltaImmagineAperta(false);
      setSceltaPendente({ asset: asset ?? null });
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
              mappa={mappa}
              impostazioni={impostazioni}
              azioneSlot={
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  {/* 🔴 Il riscontro immediato della scelta. Si mostra SOLO quando il valore del
                      modulo si discosta da quello salvato: scegliere di nuovo l'immagine che
                      c'era già non è una modifica, e annunciarla come tale insegnerebbe a
                      ignorare l'avviso. */}
                  <AnteprimaScelta
                    scelta={sceltaPendente}
                    daSalvare={(values[campoSlot] ?? null) !== (impostazioni?.[campoSlot] ?? null)}
                  />
                  <Button
                    size="small"
                    variant="outlined"
                    disabled={Boolean(status?.isFormLocked)}
                    onClick={() => setSceltaImmagineAperta(true)}
                  >
                    Scegli immagine
                  </Button>
                </Box>
              }
              testiPropri={testiPropri}
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
