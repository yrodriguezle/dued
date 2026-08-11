import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import ImageListItemBar from "@mui/material/ImageListItemBar";
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
  /** `null` significa "nessuna immagine": è il modo per staccarne una già assegnata. */
  onSelect: (mediaAssetId: number | null) => void;
}

/**
 * Selettore di immagine, condiviso da chiunque debba assegnarne una a un prodotto.
 *
 * Mostra **solo** gli asset pubblicati: un media ritirato dalla libreria non deve poter
 * rientrare da una porta laterale, altrimenti "ritirato" non vorrebbe dire niente.
 */
function MediaPickerDialog({ open, selezionatoId, onClose, onSelect }: MediaPickerDialogProps) {
  const { data: assets, loading } = useGetAll<MediaAsset>({
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
        {!loading && pubblicati.length === 0 && <Typography color="text.secondary">Nessun media pubblicato nella libreria.</Typography>}
        <div className="grid grid-cols-12 gap-3">
          {pubblicati.map((asset) => {
            const larghezza = larghezzaAnteprima(asset.larghezzeDisponibili);
            return (
              <div
                key={asset.mediaAssetId}
                className="col-span-6 sm:col-span-4 md:col-span-3"
              >
                <Paper
                  variant="outlined"
                  onClick={() => onSelect(asset.mediaAssetId)}
                  sx={{
                    position: "relative",
                    cursor: "pointer",
                    overflow: "hidden",
                    borderWidth: asset.mediaAssetId === selezionatoId ? 2 : 1,
                    borderColor: asset.mediaAssetId === selezionatoId ? "primary.main" : "divider",
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
                      backgroundImage: asset.placeholder ? `url(${asset.placeholder})` : undefined,
                      backgroundSize: "cover",
                    }}
                  />
                  <ImageListItemBar
                    title={asset.nomeOriginale}
                    subtitle={asset.cartella}
                  />
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
