import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { Link as RouterLink } from "react-router";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Link from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { Form, Formik, FormikProps } from "formik";
import { toast } from "react-toastify";

import MediaPickerDialog from "./MediaPickerDialog";
import SitoGuard from "./SitoGuard";
import { larghezzaAnteprima, mediaUrl } from "./mediaUrl";
import {
  META_DESCRIZIONE_CONSIGLIATA,
  META_TITOLO_CONSIGLIATO,
  ValoriImpostazioniVetrina,
  inputDaValori,
  validaImpostazioniVetrina,
  valoriDaImpostazioni,
} from "./impostazioniVetrinaModulo";
import FormikCheckbox from "../../common/form/FormikCheckbox";
import FormikNumberField from "../../common/form/FormikNumberField";
import FormikTextField from "../../common/form/FormikTextField";
import FormikToolbar from "../../common/form/toolbar/FormikToolbar";
import useConfirm from "../../common/confirm/useConfirm";
import PageTitleContext from "../../layout/headerBar/PageTitleContext";
import { formStatuses } from "../../../common/globals/constants";
import { getImpostazioniVetrina } from "../../../graphql/vetrina/queries";
import { mutationMutateImpostazioniVetrina } from "../../../graphql/vetrina/mutations";

function SezioneImpostazioni({ titolo, descrizione, children }: { titolo: string; descrizione?: string; children: React.ReactNode }) {
  return (
    <Paper
      variant="outlined"
      sx={{ p: 2.5 }}
    >
      <Typography
        variant="subtitle1"
        fontWeight={600}
        sx={{ mb: descrizione ? 0.5 : 2 }}
      >
        {titolo}
      </Typography>
      {descrizione && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", mb: 2 }}
        >
          {descrizione}
        </Typography>
      )}
      {children}
    </Paper>
  );
}

/**
 * Le impostazioni del sito vetrina, compilabili da chi possiede i dati invece che da chi sa
 * scrivere una mutation.
 *
 * 🔴 **Nessun campo di orario.** Apertura, chiusura, giorni operativi e fuso si modificano dalle
 * impostazioni della cassa, che ne sono la sola sorgente — e la pagina lo **dice**, invece di
 * lasciare che qualcuno li cerchi qui.
 */
function ImpostazioniVetrinaPage() {
  const { setTitle } = useContext(PageTitleContext);
  const onConfirm = useConfirm();
  const formRef = useRef<FormikProps<ValoriImpostazioniVetrina>>(null);
  const [sceltaImmagineAperta, setSceltaImmagineAperta] = useState(false);

  const { data, loading, error } = useQuery(getImpostazioniVetrina, { fetchPolicy: "cache-and-network" });

  const [mutateImpostazioni] = useMutation(mutationMutateImpostazioniVetrina, {
    // Il refetch atteso riporta la riga appena salvata: `enableReinitialize` la riversa nel
    // modulo, che torna pulito e bloccato senza che nessuno ricopra i valori a mano.
    refetchQueries: [{ query: getImpostazioniVetrina }],
    awaitRefetchQueries: true,
    onCompleted: () => {
      toast.success("Impostazioni del sito aggiornate");
    },
    onError: (errore) => {
      // Il server spiega già cosa non va (coordinate, formato orario, URL social, immagine non
      // pubblicata): il messaggio si mostra così com'è.
      toast.error(errore.message || "Errore durante il salvataggio");
    },
  });

  useEffect(() => {
    setTitle("Impostazioni sito");
  }, [setTitle]);

  const impostazioni = data?.vetrina?.impostazioni ?? null;
  const initialValues = useMemo(() => valoriDaImpostazioni(impostazioni), [impostazioni]);

  /**
   * Anteprima dell'immagine social salvata. `larghezzaAnteprima` restituisce `null` quando il
   * media non ha alcuna variante su disco: in quel caso non si compone un URL con larghezza
   * zero, che risponderebbe 404 — semplicemente non c'è anteprima da mostrare.
   */
  const anteprimaOg = useMemo(() => {
    const immagine = impostazioni?.immagineOg;
    if (!immagine) {
      return null;
    }
    const larghezza = larghezzaAnteprima(immagine.larghezzeDisponibili);
    if (larghezza === null) {
      return null;
    }
    return { url: mediaUrl(immagine.chiave, larghezza), testo: immagine.testoAlternativo || immagine.nomeOriginale };
  }, [impostazioni]);

  const handleResetForm = useCallback(
    async (haModifiche: boolean) => {
      const confermato =
        !haModifiche ||
        (await onConfirm({
          title: "Impostazioni sito",
          content: "Sei sicuro di voler annullare le modifiche?",
          acceptLabel: "Si",
          cancelLabel: "No",
        }));
      if (!confermato) {
        return;
      }
      formRef.current?.resetForm();
    },
    [onConfirm]
  );

  const handleSubmit = useCallback(
    async (valori: ValoriImpostazioniVetrina) => {
      try {
        await mutateImpostazioni({ variables: { input: inputDaValori(valori) } });
      } catch {
        // L'errore è già mostrato da onError: qui si evita solo la promise rifiutata.
      }
    },
    [mutateImpostazioni]
  );

  const handleScegliImmagine = useCallback((mediaAssetId: number | null) => {
    setSceltaImmagineAperta(false);
    formRef.current?.setFieldValue("immagineOgId", mediaAssetId);
  }, []);

  if (loading && !data) {
    return (
      <SitoGuard>
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "50dvh" }}>
          <CircularProgress />
        </Box>
      </SitoGuard>
    );
  }

  if (error) {
    return (
      <SitoGuard>
        <Box sx={{ p: 2 }}>
          <Alert severity="error">Errore nel caricamento delle impostazioni del sito: {error.message}</Alert>
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
        validate={validaImpostazioniVetrina}
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
            <Box sx={{ flex: 1, overflow: "auto", minHeight: 0, px: 2, py: 2 }}>
              <Box sx={{ maxWidth: 1000, display: "flex", flexDirection: "column", gap: 2.5 }}>
                {!impostazioni && (
                  <Alert severity="info">Le impostazioni del sito non sono ancora state create: compila i campi e salva per crearle.</Alert>
                )}

                <SezioneImpostazioni
                  titolo="Identità"
                  descrizione="L'insegna che legge il cliente sul sito. È distinta dal nome dell'attività usato dal gestionale: sono due nomi con due pubblici."
                >
                  <div className="grid grid-cols-12 gap-4">
                    <div className="col-span-12 sm:col-span-7">
                      <FormikTextField
                        name="insegnaPubblica"
                        label="Insegna pubblica"
                        fullWidth
                      />
                    </div>
                  </div>
                </SezioneImpostazioni>

                <SezioneImpostazioni
                  titolo="Indirizzo"
                  descrizione="Scomposto in campi separati perché è la forma che i motori di ricerca leggono nei dati strutturati: un campo unico andrebbe poi spezzato a indovinare."
                >
                  <div className="grid grid-cols-12 gap-4">
                    <div className="col-span-12 sm:col-span-6">
                      <FormikTextField
                        name="via"
                        label="Via e numero civico"
                        fullWidth
                      />
                    </div>
                    <div className="col-span-6 sm:col-span-2">
                      <FormikTextField
                        name="cap"
                        label="CAP"
                        fullWidth
                      />
                    </div>
                    <div className="col-span-6 sm:col-span-4">
                      <FormikTextField
                        name="citta"
                        label="Città"
                        fullWidth
                      />
                    </div>
                    <div className="col-span-6 sm:col-span-2">
                      <FormikTextField
                        name="provincia"
                        label="Provincia"
                        placeholder="VI"
                        fullWidth
                      />
                    </div>
                    <div className="col-span-6 sm:col-span-2">
                      <FormikTextField
                        name="paese"
                        label="Paese"
                        placeholder="IT"
                        fullWidth
                      />
                    </div>
                  </div>
                </SezioneImpostazioni>

                <SezioneImpostazioni
                  titolo="Posizione"
                  descrizione="Servono entrambe o nessuna: una sola coordinata indica un punto sull'equatore, cioè un luogo sbagliato mostrato con sicurezza."
                >
                  <div className="grid grid-cols-12 gap-4">
                    <div className="col-span-6 sm:col-span-3">
                      <FormikTextField
                        name="latitudine"
                        label="Latitudine"
                        placeholder="45.707500"
                        fullWidth
                      />
                    </div>
                    <div className="col-span-6 sm:col-span-3">
                      <FormikTextField
                        name="longitudine"
                        label="Longitudine"
                        placeholder="11.478900"
                        fullWidth
                      />
                    </div>
                  </div>
                </SezioneImpostazioni>

                <SezioneImpostazioni
                  titolo="Contatti e social"
                  descrizione="I link vanno inseriti come indirizzo completo del profilo, non come nome utente: il sito li pubblica così come sono."
                >
                  <div className="grid grid-cols-12 gap-4">
                    <div className="col-span-12 sm:col-span-4">
                      <FormikTextField
                        name="telefono"
                        label="Telefono"
                        fullWidth
                      />
                    </div>
                    <div className="col-span-12 sm:col-span-5">
                      <FormikTextField
                        name="email"
                        label="Email"
                        fullWidth
                      />
                    </div>
                    <div className="col-span-12 sm:col-span-6">
                      <FormikTextField
                        name="urlInstagram"
                        label="Instagram"
                        placeholder="https://www.instagram.com/2dgusto/"
                        fullWidth
                      />
                    </div>
                    <div className="col-span-12 sm:col-span-6">
                      <FormikTextField
                        name="urlFacebook"
                        label="Facebook"
                        placeholder="https://www.facebook.com/2dgusto/"
                        fullWidth
                      />
                    </div>
                  </div>
                </SezioneImpostazioni>

                <SezioneImpostazioni
                  titolo="Motori di ricerca e anteprima social"
                  descrizione="Titolo e descrizione usati quando una pagina del sito non ne ha di propri, e immagine mostrata quando il link viene condiviso."
                >
                  <div className="grid grid-cols-12 gap-4">
                    <div className="col-span-12 sm:col-span-6">
                      <FormikTextField
                        name="metaTitoloDefault"
                        label="Titolo predefinito"
                        fullWidth
                        helperText={`${values.metaTitoloDefault.length} / ~${META_TITOLO_CONSIGLIATO} caratteri consigliati`}
                      />
                    </div>
                    <div className="col-span-12">
                      <FormikTextField
                        name="metaDescrizioneDefault"
                        label="Descrizione predefinita"
                        fullWidth
                        multiline
                        minRows={2}
                        helperText={`${values.metaDescrizioneDefault.length} / ~${META_DESCRIZIONE_CONSIGLIATA} caratteri consigliati`}
                      />
                    </div>
                    <div className="col-span-12">
                      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                        {/* Nessun caricamento da questa pagina e nessun secondo percorso di
                            scelta: è lo stesso selettore della griglia prodotti. */}
                        {anteprimaOg && impostazioni?.immagineOgId === values.immagineOgId ? (
                          <Box
                            component="img"
                            src={anteprimaOg.url}
                            alt={anteprimaOg.testo}
                            sx={{ width: 160, height: 84, objectFit: "cover", borderRadius: 1 }}
                          />
                        ) : (
                          <Typography
                            variant="body2"
                            color="text.secondary"
                          >
                            {values.immagineOgId ? `Immagine selezionata (id ${values.immagineOgId}): l'anteprima compare dopo il salvataggio.` : "Nessuna immagine di anteprima social."}
                          </Typography>
                        )}
                        {/* Disabilitato a modulo bloccato come ogni altro campo: la scelta
                            scrive `immagineOgId`, quindi un pulsante attivo qui sarebbe l'unico
                            modo di modificare un modulo in sola lettura. */}
                        <Button
                          variant="outlined"
                          disabled={Boolean(status?.isFormLocked)}
                          onClick={() => setSceltaImmagineAperta(true)}
                        >
                          Scegli immagine
                        </Button>
                      </Box>
                    </div>
                  </div>
                </SezioneImpostazioni>

                <SezioneImpostazioni
                  titolo="Aspetto"
                  descrizione="Ora a partire dalla quale il sito passa al tema serale. È un dato, non un calcolo: il confronto avviene sull'orologio del visitatore."
                >
                  <div className="grid grid-cols-12 gap-4">
                    <div className="col-span-6 sm:col-span-3">
                      <FormikTextField
                        name="oraInizioTemaSera"
                        label="Inizio tema sera"
                        placeholder="18:00"
                        fullWidth
                      />
                    </div>
                  </div>
                </SezioneImpostazioni>

                <SezioneImpostazioni titolo="Prenotazioni">
                  {/* 🔴 Un campo che si compila e non fa niente, senza spiegazione, è un bug
                      segnalato. L'avviso è visibile senza aprire nulla. */}
                  <Alert
                    severity="info"
                    sx={{ mb: 2 }}
                  >
                    Le prenotazioni non sono ancora attive sul sito: questi valori vengono salvati e verranno usati quando la funzione sarà disponibile.
                  </Alert>
                  <div className="grid grid-cols-12 gap-4">
                    <div className="col-span-12 sm:col-span-4">
                      <FormikCheckbox
                        name="prenotazioniAttive"
                        label="Prenotazioni attive"
                      />
                    </div>
                    <div className="col-span-6 sm:col-span-3">
                      <FormikNumberField
                        name="prenotazioniPreavvisoOre"
                        label="Preavviso (ore)"
                        fullWidth
                        decimals={0}
                      />
                    </div>
                    <div className="col-span-6 sm:col-span-3">
                      <FormikNumberField
                        name="prenotazioniCopertiMax"
                        label="Coperti massimi"
                        fullWidth
                        decimals={0}
                      />
                    </div>
                  </div>
                </SezioneImpostazioni>

                {/* Gli orari NON si modificano da qui: hanno una sola sorgente. Dirlo dove
                    qualcuno li cercherebbe costa una riga; non dirlo costa un sito che dice
                    aperto fino alle 21 e una cassa che dice 19. */}
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
              </Box>
            </Box>

            <MediaPickerDialog
              open={sceltaImmagineAperta}
              selezionatoId={values.immagineOgId}
              onClose={() => setSceltaImmagineAperta(false)}
              onSelect={handleScegliImmagine}
            />
          </Form>
        )}
      </Formik>
    </SitoGuard>
  );
}

export default ImpostazioniVetrinaPage;
