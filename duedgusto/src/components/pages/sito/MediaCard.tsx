import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActions from "@mui/material/CardActions";
import CardContent from "@mui/material/CardContent";
import CardMedia from "@mui/material/CardMedia";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";

import { larghezzaAnteprima, mediaUrl } from "./mediaUrl";

interface MediaCardProps {
  asset: MediaAsset;
  onEdit: (asset: MediaAsset) => void;
  onDelete: (asset: MediaAsset) => void;
}

function formatoByte(byte: number): string {
  if (byte >= 1024 * 1024) {
    return `${(byte / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(byte / 1024))} KB`;
}

/**
 * Una tessera della libreria.
 *
 * Il `placeholder` LQIP fa da sfondo dell'immagine vera: occupa lo spazio da subito, quindi la
 * card non salta quando la variante arriva, e non costa una seconda richiesta — è già un data
 * URI dentro la risposta GraphQL.
 */
function MediaCard({ asset, onEdit, onDelete }: MediaCardProps) {
  const larghezza = larghezzaAnteprima(asset.larghezzeDisponibili);
  const anteprima = larghezza ? mediaUrl(asset.chiave, larghezza) : undefined;

  return (
    <Card sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <CardMedia
        component="img"
        image={anteprima}
        alt={asset.testoAlternativo || asset.nomeOriginale}
        sx={{
          height: 160,
          objectFit: "cover",
          objectPosition: asset.focale || "center",
          backgroundImage: asset.placeholder ? `url(${asset.placeholder})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <CardContent sx={{ flex: 1, pb: 1 }}>
        <Typography
          variant="subtitle2"
          noWrap
          title={asset.nomeOriginale}
        >
          {asset.nomeOriginale}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          display="block"
        >
          {asset.larghezza}×{asset.altezza} · {formatoByte(asset.byteTotali)}
        </Typography>
        <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mt: 1 }}>
          <Chip
            label={asset.cartella}
            size="small"
            variant="outlined"
          />
          {!asset.pubblicato && (
            <Chip
              label="Non pubblicato"
              size="small"
              color="warning"
            />
          )}
          {!asset.testoAlternativo && (
            <Chip
              label="Senza testo alternativo"
              size="small"
              color="default"
              variant="outlined"
            />
          )}
        </Box>
      </CardContent>
      <CardActions sx={{ pt: 0 }}>
        <Button
          size="small"
          startIcon={<EditIcon />}
          onClick={() => onEdit(asset)}
        >
          Modifica
        </Button>
        <Button
          size="small"
          color="error"
          startIcon={<DeleteIcon />}
          onClick={() => onDelete(asset)}
        >
          Elimina
        </Button>
      </CardActions>
    </Card>
  );
}

export default MediaCard;
