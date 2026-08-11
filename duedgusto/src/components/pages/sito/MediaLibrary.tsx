import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useMutation } from "@apollo/client";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import MediaCard from "./MediaCard";
import MediaUploadArea from "./MediaUploadArea";
import SitoGuard from "./SitoGuard";
import PageTitleContext from "../../layout/headerBar/PageTitleContext";
import useConfirm from "../../common/confirm/useConfirm";
import makeRequest from "../../../api/makeRequest";
import showToast from "../../../common/toast/showToast";
import useGetAll from "../../../graphql/common/useGetAll";
import { mediaAssetFragment } from "../../../graphql/vetrina/fragments";
import { mutationEliminaMediaAsset, mutationMutateMediaAsset } from "../../../graphql/vetrina/mutations";

const AIUTO_CARTELLA = "Etichetta editoriale di raggruppamento: non tocca il percorso dei file su disco.";

type ModuloMedia = {
  testoAlternativo: string;
  didascalia: string;
  cartella: string;
  ordinamento: number;
  focale: string;
  pubblicato: boolean;
};

function moduloDaAsset(asset: MediaAsset): ModuloMedia {
  return {
    testoAlternativo: asset.testoAlternativo || "",
    didascalia: asset.didascalia || "",
    cartella: asset.cartella,
    ordinamento: asset.ordinamento,
    focale: asset.focale || "",
    pubblicato: asset.pubblicato,
  };
}

function MediaLibrary() {
  const { setTitle } = useContext(PageTitleContext);
  const onConfirm = useConfirm();

  const [configurazione, setConfigurazione] = useState<MediaConfigurazione | null>(null);
  // Vuota finché la configurazione non arriva: la prima cartella suggerita la decide il
  // server. Un valore predefinito scritto qui sarebbe la copia che può divergere.
  const [cartella, setCartella] = useState("");
  const [inModifica, setInModifica] = useState<MediaAsset | null>(null);
  const [modulo, setModulo] = useState<ModuloMedia | null>(null);

  const [mutateMediaAsset, { loading: salvataggioInCorso }] = useMutation(mutationMutateMediaAsset);
  const [eliminaMediaAsset] = useMutation(mutationEliminaMediaAsset);

  const {
    data: assets,
    loading,
    refetch,
  } = useGetAll<MediaAsset>({
    fragment: mediaAssetFragment,
    queryName: "mediaAssets",
    fragmentBody: "...MediaAssetFragment",
    fetchPolicy: "network-only",
  });

  useEffect(() => {
    setTitle("Libreria media");
  }, [setTitle]);

  // I limiti arrivano dal server a ogni apertura della pagina: è la ragione per cui il
  // frontend non può divergere dal backend — non ha un proprio valore da far divergere.
  useEffect(() => {
    let attivo = true;
    const leggiConfigurazione = async () => {
      try {
        const risposta = await makeRequest<MediaConfigurazione, undefined>({
          path: "media/configurazione",
          method: "GET",
        });
        if (attivo && risposta) {
          setConfigurazione(risposta);
          // Functional updater: se l'utente ha già digitato mentre la richiesta era in volo,
          // la configurazione tardiva non gli riscrive il campo sotto le dita.
          setCartella((precedente) => precedente || risposta.cartelleSuggerite[0] || "");
        }
      } catch {
        if (attivo) {
          showToast({
            type: "error",
            position: "bottom-right",
            message: "Impossibile leggere i limiti di caricamento dal server",
            autoClose: 3000,
            toastId: "media-configurazione-errore",
          });
        }
      }
    };
    void leggiConfigurazione();
    return () => {
      attivo = false;
    };
  }, []);

  /**
   * Suggerimenti del server ∪ cartelle già in uso fra gli asset caricati. È lo stesso modo in
   * cui `VetrinaProdottiList` costruisce i valori di `categoriaVetrina`: nessun modello mentale
   * nuovo, e soprattutto **nessun elenco scritto nel frontend** che possa divergere da quello
   * del backend.
   *
   * 🔴 L'insieme resta **aperto**: l'`Autocomplete` è `freeSolo`, non una tendina chiusa. Una
   * lista chiusa richiederebbe un deploy per ogni nuova cartella.
   */
  const opzioniCartella = useMemo(
    () => Array.from(new Set([...(configurazione?.cartelleSuggerite ?? []), ...assets.map((asset) => asset.cartella)])).sort(),
    [assets, configurazione]
  );

  const handleEdit = useCallback((asset: MediaAsset) => {
    setInModifica(asset);
    setModulo(moduloDaAsset(asset));
  }, []);

  const handleChiudiDialog = useCallback(() => {
    setInModifica(null);
    setModulo(null);
  }, []);

  const handleSalva = useCallback(async () => {
    if (!inModifica || !modulo) {
      return;
    }
    try {
      await mutateMediaAsset({
        variables: {
          mediaAssetId: inModifica.mediaAssetId,
          input: {
            testoAlternativo: modulo.testoAlternativo || null,
            didascalia: modulo.didascalia || null,
            focale: modulo.focale || null,
            // Un valore vuoto NON viene rimpiazzato qui: il server lo normalizza sulla propria
            // cartella predefinita. La forma canonica ha un solo proprietario.
            cartella: modulo.cartella,
            ordinamento: Number(modulo.ordinamento) || 0,
            pubblicato: modulo.pubblicato,
          },
        },
      });
      handleChiudiDialog();
      refetch();
      showToast({
        type: "success",
        position: "bottom-right",
        message: "Media aggiornato",
        autoClose: 2000,
        toastId: "media-aggiornato",
      });
    } catch (errore) {
      // Il server valida il formato del punto focale e segnala i prodotti coinvolti quando un
      // media pubblicato viene ritirato: quei messaggi sono già la spiegazione, si mostrano
      // così come sono.
      showToast({
        type: "error",
        position: "bottom-right",
        message: errore instanceof Error ? errore.message : "Salvataggio non riuscito",
        autoClose: 6000,
        toastId: "media-salvataggio-errore",
      });
    }
  }, [handleChiudiDialog, inModifica, modulo, mutateMediaAsset, refetch]);

  const handleDelete = useCallback(
    async (asset: MediaAsset) => {
      const confermato = await onConfirm({
        title: "Conferma eliminazione",
        content: `Eliminare "${asset.nomeOriginale}"? I file su disco vengono rimossi insieme al record.`,
        acceptLabel: "Elimina",
        cancelLabel: "Annulla",
      });
      if (!confermato) {
        return;
      }
      try {
        await eliminaMediaAsset({ variables: { mediaAssetId: asset.mediaAssetId } });
        refetch();
        showToast({
          type: "success",
          position: "bottom-right",
          message: "Media eliminato",
          autoClose: 2000,
          toastId: "media-eliminato",
        });
      } catch (errore) {
        // Un media ancora in uso viene rifiutato con un errore che NOMINA i prodotti: nessun
        // trattamento speciale del caso, il messaggio del server è già quello giusto.
        showToast({
          type: "error",
          position: "bottom-right",
          message: errore instanceof Error ? errore.message : "Eliminazione non riuscita",
          autoClose: 8000,
          toastId: "media-eliminazione-errore",
        });
      }
    },
    [eliminaMediaAsset, onConfirm, refetch]
  );

  return (
    <SitoGuard>
      <Box
        className="scrollable-box"
        sx={{ paddingX: 2, paddingY: 2, overflow: "auto", height: "calc(100dvh - 64px)" }}
      >
        <Typography
          id="view-title"
          variant="h5"
          gutterBottom
        >
          Libreria media
        </Typography>

        <Autocomplete
          freeSolo
          options={opzioniCartella}
          // ⚠️ Sia `value` sia `inputValue`, sullo stesso stato: sono due stati distinti in MUI,
          // e senza il primo la tendina aperta su un valore già scelto mostrerebbe **solo**
          // quello — filtrato dal testo che c'è nel campo. Con entrambi, aprire mostra tutte le
          // cartelle e digitare filtra, che è quello che serve per scoprire "galleria".
          value={cartella}
          onChange={(_evento, valore) => setCartella(valore ?? "")}
          inputValue={cartella}
          onInputChange={(_evento, valore) => setCartella(valore)}
          sx={{ mb: 2, minWidth: 280, maxWidth: 360 }}
          renderInput={(parametri) => (
            <TextField
              {...parametri}
              label="Cartella di destinazione"
              size="small"
              helperText={AIUTO_CARTELLA}
            />
          )}
        />

        <MediaUploadArea
          configurazione={configurazione}
          cartella={cartella}
          onCompletato={refetch}
        />

        {!loading && assets.length === 0 && (
          <Typography color="text.secondary">Nessun media caricato: trascina qui la prima immagine.</Typography>
        )}

        <div className="grid grid-cols-12 gap-4">
          {assets.map((asset) => (
            <div
              key={asset.mediaAssetId}
              className="col-span-12 sm:col-span-6 md:col-span-4 lg:col-span-3"
            >
              <MediaCard
                asset={asset}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            </div>
          ))}
        </div>
      </Box>

      <Dialog
        open={Boolean(inModifica)}
        onClose={handleChiudiDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Modifica metadati</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          {modulo && (
            <>
              <TextField
                label="Testo alternativo"
                value={modulo.testoAlternativo}
                onChange={(event) => setModulo({ ...modulo, testoAlternativo: event.target.value })}
                helperText="Descrive l'immagine a chi non la vede. Vale anche per i motori di ricerca."
                fullWidth
                autoFocus
              />
              <TextField
                label="Didascalia"
                value={modulo.didascalia}
                onChange={(event) => setModulo({ ...modulo, didascalia: event.target.value })}
                fullWidth
              />
              <Autocomplete
                freeSolo
                options={opzioniCartella}
                value={modulo.cartella}
                onChange={(_evento, valore) => setModulo({ ...modulo, cartella: valore ?? "" })}
                inputValue={modulo.cartella}
                onInputChange={(_evento, valore) => setModulo({ ...modulo, cartella: valore })}
                fullWidth
                renderInput={(parametri) => (
                  <TextField
                    {...parametri}
                    label="Cartella"
                    helperText={AIUTO_CARTELLA}
                  />
                )}
              />
              <TextField
                label="Ordinamento"
                type="number"
                value={modulo.ordinamento}
                onChange={(event) => setModulo({ ...modulo, ordinamento: Number(event.target.value) })}
                fullWidth
              />
              <TextField
                label="Punto focale"
                value={modulo.focale}
                onChange={(event) => setModulo({ ...modulo, focale: event.target.value })}
                placeholder="50% 40%"
                helperText='Formato "<0-100>% <0-100>%" (orizzontale, poi verticale). Vuoto = centro.'
                fullWidth
              />
              <FormControlLabel
                control={<Switch
                  checked={modulo.pubblicato}
                  onChange={(event) => setModulo({ ...modulo, pubblicato: event.target.checked })}
                />}
                label="Pubblicato"
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleChiudiDialog}>Annulla</Button>
          <Button
            variant="contained"
            disabled={salvataggioInCorso}
            onClick={handleSalva}
          >
            Salva
          </Button>
        </DialogActions>
      </Dialog>
    </SitoGuard>
  );
}

export default MediaLibrary;
