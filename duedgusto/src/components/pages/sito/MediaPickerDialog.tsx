import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";

import { larghezzaAnteprima, mediaUrl } from "./mediaUrl";
import useGetAll from "../../../graphql/common/useGetAll";
import { mediaAssetFragment } from "../../../graphql/vetrina/fragments";

interface MediaPickerDialogProps {
  open: boolean;
  /** Immagine attualmente assegnata, per evidenziarla nell'elenco. */
  selezionatoId?: number | null;
  onClose: () => void;
  /**
   * `null` significa "nessuna immagine": è il modo per staccarne una già assegnata.
   *
   * 🔴 Il secondo argomento è **l'asset scelto**, non solo il suo id, e non è una comodità:
   *    senza, chi chiama non ha modo di mostrare l'immagine appena scelta finché il server non
   *    gliela rimanda. È il difetto per cui la scelta non si vedeva — la modale si chiudeva e
   *    la pagina restava identica, indistinguibile da un clic andato perduto.
   */
  onSelect: (mediaAssetId: number | null, asset?: MediaAsset) => void;
}

/**
 * Selettore di immagine, condiviso da chiunque debba assegnarne una a un prodotto o a uno slot
 * di pagina.
 *
 * Mostra **solo** gli asset pubblicati: un media ritirato dalla libreria non deve poter
 * rientrare da una porta laterale, altrimenti "ritirato" non vorrebbe dire niente.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * 🔴 **La didascalia sta SOTTO l'immagine, non sopra.** Con una barra sovrapposta — che è come
 *    nasceva questo dialogo — il nome del file copriva la metà inferiore di ogni miniatura
 *    (60 px di barra su 120 px di immagine): si sceglieva un'immagine vedendone metà. La stessa
 *    forma di `MediaCard` nella libreria, per la stessa ragione: qui si sceglie **guardando**,
 *    e ciò che copre l'immagine costa esattamente quello che il dialogo serve a dare.
 *
 * 🔴 **Caricamento ed errore si dicono.** Prima venivano ingoiati entrambi: una query rifiutata
 *    — permessi, rete, token scaduto — rendeva un dialogo vuoto identico a una libreria vuota,
 *    e l'unico messaggio possibile era «non funziona» senza alcun indizio su cosa. Un guasto
 *    invisibile è il più caro da diagnosticare.
 * ─────────────────────────────────────────────────────────────────────────────────────────
 */
function MediaPickerDialog({ open, selezionatoId, onClose, onSelect }: MediaPickerDialogProps) {
  const {
    data: assets,
    loading,
    error,
  } = useGetAll<MediaAsset>({
    fragment: mediaAssetFragment,
    queryName: "mediaAssets",
    fragmentBody: "...MediaAssetFragment",
    fetchPolicy: "network-only",
    skip: !open,
  });

  const pubblicati = assets.filter((asset) => asset.pubblicato);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
    >
      <DialogTitle>Scegli un&apos;immagine</DialogTitle>
      <DialogContent>
        {loading && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {/* Il messaggio del server è già la spiegazione — «riservata agli amministratori» dice
            da solo cosa fare. Sostituirlo con un testo generico toglierebbe l'unica cosa utile. */}
        {!loading && error && <Alert severity="error">Impossibile leggere la libreria media: {error.message}</Alert>}

        {!loading && !error && pubblicati.length === 0 && (
          <Typography color="text.secondary">Nessun media pubblicato nella libreria: caricane uno da «Libreria media».</Typography>
        )}

        <div className="grid grid-cols-12 gap-3">
          {pubblicati.map((asset) => {
            const larghezza = larghezzaAnteprima(asset.larghezzeDisponibili);
            const selezionato = asset.mediaAssetId === selezionatoId;
            return (
              <div
                key={asset.mediaAssetId}
                className="col-span-6 sm:col-span-4 md:col-span-3"
              >
                <Paper
                  variant="outlined"
                  onClick={() => onSelect(asset.mediaAssetId, asset)}
                  sx={{
                    height: "100%",
                    cursor: "pointer",
                    overflow: "hidden",
                    borderWidth: selezionato ? 2 : 1,
                    borderColor: selezionato ? "primary.main" : "divider",
                    "&:hover": { borderColor: "primary.light" },
                  }}
                >
                  <Box
                    component="img"
                    src={larghezza ? mediaUrl(asset.chiave, larghezza) : undefined}
                    alt={asset.testoAlternativo || asset.nomeOriginale}
                    sx={{
                      display: "block",
                      width: "100%",
                      height: 120,
                      objectFit: "cover",
                      objectPosition: asset.focale || "center",
                      // Il LQIP occupa lo spazio da subito: niente salto di layout, e nessuna
                      // seconda richiesta — è già un data URI dentro la risposta GraphQL.
                      backgroundImage: asset.placeholder ? `url(${asset.placeholder})` : undefined,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  />
                  <Box sx={{ px: 1, py: 0.75 }}>
                    <Typography
                      variant="caption"
                      component="div"
                      noWrap
                      title={asset.nomeOriginale}
                    >
                      {asset.nomeOriginale}
                    </Typography>
                    <Typography
                      variant="caption"
                      component="div"
                      color="text.secondary"
                      noWrap
                    >
                      {asset.cartella}
                    </Typography>
                  </Box>
                </Paper>
              </div>
            );
          })}
        </div>
      </DialogContent>
      <DialogActions>
        <Button
          color="error"
          onClick={() => onSelect(null)}
        >
          Nessuna immagine
        </Button>
        <Button onClick={onClose}>Annulla</Button>
      </DialogActions>
    </Dialog>
  );
}

export default MediaPickerDialog;
