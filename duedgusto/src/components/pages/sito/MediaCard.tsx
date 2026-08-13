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
import { CARTELLA_GALLERIA, RuoloRicoperto, etichettaRuoloRicoperto } from "./pagine/ruoliPagine";

interface MediaCardProps {
  asset: MediaAsset;
  /**
   * I ruoli che questa immagine sta ricoprendo **adesso** sul sito.
   *
   * 🔴 Arrivano dal piano del server — la stessa dichiarazione da cui le schede di pagina
   *    contano i posti — e mai da un calcolo di questa tessera: due elenchi che si
   *    corrispondono per disciplina divergono, e divergerebbero in silenzio.
   */
  ruoli: RuoloRicoperto[];
  /** `false` finché il piano non è arrivato: senza, la tessera direbbe «nessun ruolo» a torto. */
  pianoNoto: boolean;
  onEdit: (asset: MediaAsset) => void;
  onDelete: (asset: MediaAsset) => void;
}

/**
 * Perché questa immagine non ricopre alcun ruolo.
 *
 * 🔴 «Nessun ruolo» da solo non è una risposta: le due ragioni più comuni — non è pubblicata,
 *    non è nella cartella da cui il sito pesca — sono azionabili, e tacerle lascia
 *    l'amministratore a fissare una foto che «non funziona».
 *
 * ⚠️ Questi due controlli **non attribuiscono** ruoli e non ne tolgono: servono soltanto a
 *    spiegare un elenco vuoto che arriva già deciso dal server.
 */
function perchePrivaDiRuolo(asset: MediaAsset): string {
  if (!asset.pubblicato) {
    return "Non pubblicata: finché resta così non entra in nessuna pagina del sito.";
  }
  if (asset.cartella !== CARTELLA_GALLERIA) {
    return `Nessun ruolo: le pagine del sito pescano solo dalla cartella «${CARTELLA_GALLERIA}».`;
  }
  return "Nessun ruolo: al momento non compare su nessuna pagina del sito.";
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
function MediaCard({ asset, ruoli, pianoNoto, onEdit, onDelete }: MediaCardProps) {
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

        {/* 🔴 I ruoli si scrivono con il NOME DELLA PAGINA e mai con un numero di posizione:
            «la seconda foto» significa tre cose diverse su tre pagine, ed è esattamente il
            difetto che gli slot esistono per togliere. Più ruoli si elencano tutti — con una
            sola foto in galleria, quella foto ne ricopre parecchi insieme. */}
        {pianoNoto && (
          <Box sx={{ mt: 1 }}>
            {ruoli.length === 0 ? (
              <Typography
                variant="caption"
                color="text.secondary"
              >
                {perchePrivaDiRuolo(asset)}
              </Typography>
            ) : (
              <>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  display="block"
                >
                  Sul sito ricopre {ruoli.length === 1 ? "questo ruolo" : `questi ${ruoli.length} ruoli`}:
                </Typography>
                <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mt: 0.5 }}>
                  {ruoli.map((ricoperto) => (
                    <Chip
                      key={ricoperto.ruolo.chiave}
                      label={etichettaRuoloRicoperto(ricoperto)}
                      size="small"
                      color={ricoperto.scelto ? "success" : "default"}
                      variant={ricoperto.scelto ? "filled" : "outlined"}
                      title={ricoperto.scelto ? "Scelta esplicitamente: resta questa anche se la galleria cambia." : "Ruolo dovuto alla posizione nella galleria: cambia se la galleria cambia."}
                    />
                  ))}
                </Box>
              </>
            )}
          </Box>
        )}
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
