import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import RemoveIcon from "@mui/icons-material/Remove";

import formatCurrency from "../../../common/bones/formatCurrency";

interface OrdineCorrenteProps {
  aperto: boolean;
  ordine: Ordine | null;
  inCorso?: boolean;
  onChiudi: () => void;
  onCambiaQuantita: (riga: RigaOrdine, quantita: number) => void;
  onRimuovi: (riga: RigaOrdine) => void;
  onIncassa: () => void;
}

/**
 * Le voci del conto aperto, con la correzione di ciò che si è appena sbagliato.
 *
 * <p>È la parte che il vecchio punto vendita non aveva bisogno di avere: lì ogni tocco era già
 * una vendita incassata, e correggerla significava toccare un numero che qualcuno aveva già
 * letto. Qui l'ordine è ancora aperto, quindi **nessuna di queste due azioni muove un secchio**:
 * si sta correggendo un tocco, non disfacendo un incasso.</p>
 *
 * ⚠️ Il cestino è deliberatamente **all'estremità opposta** dello stepper e non gli è adiacente:
 *    è l'unica azione irreversibile del foglio, e a una mano sola i due bersagli si confondono.
 */
function OrdineCorrente({ aperto, ordine, inCorso = false, onChiudi, onCambiaQuantita, onRimuovi, onIncassa }: OrdineCorrenteProps) {
  const righe = ordine?.righe ?? [];

  return (
    <Drawer
      anchor="bottom"
      open={aperto && Boolean(ordine)}
      onClose={onChiudi}
      slotProps={{ paper: { sx: { borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: "88dvh" } } }}
    >
      {ordine && (
        <Box sx={{ p: 2, maxWidth: 640, mx: "auto", width: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
          <Typography
            variant="h6"
            gutterBottom
          >
            Ordine {ordine.identificativo}
          </Typography>

          <Divider sx={{ mb: 1 }} />

          <Box sx={{ overflow: "auto", minHeight: 0, flex: 1 }}>
            {righe.length === 0 && <Alert severity="info">Nessuna voce battuta. Tocca un prodotto per cominciare.</Alert>}

            {righe.map((riga) => (
              <Box
                key={riga.rigaOrdineId}
                sx={{ display: "flex", alignItems: "center", gap: 1, py: 1, borderBottom: 1, borderColor: "divider" }}
              >
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography
                    variant="body2"
                    noWrap
                    sx={{ fontWeight: 600 }}
                  >
                    {riga.prodotto?.nome ?? `Prodotto ${riga.prodottoId}`}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {/* Il prezzo unitario è quello del tocco, non quello di adesso: se il listino
                        cambia a ordine aperto, il conto sotto al cliente non si muove. */}
                    {formatCurrency(riga.prezzoUnitario)} € cad.
                  </Typography>
                </Box>

                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexShrink: 0 }}>
                  <IconButton
                    aria-label={`Diminuisci ${riga.prodotto?.nome ?? "voce"}`}
                    onClick={() => onCambiaQuantita(riga, riga.quantita - 1)}
                    disabled={inCorso || riga.quantita <= 1}
                    sx={{ border: 1, borderColor: "divider", width: 44, height: 44 }}
                  >
                    <RemoveIcon />
                  </IconButton>
                  <Typography
                    sx={{ minWidth: 28, textAlign: "center", fontVariantNumeric: "tabular-nums" }}
                    variant="h6"
                  >
                    {riga.quantita}
                  </Typography>
                  <IconButton
                    aria-label={`Aumenta ${riga.prodotto?.nome ?? "voce"}`}
                    onClick={() => onCambiaQuantita(riga, riga.quantita + 1)}
                    disabled={inCorso}
                    sx={{ border: 1, borderColor: "divider", width: 44, height: 44 }}
                  >
                    <AddIcon />
                  </IconButton>
                </Box>

                <Typography
                  variant="body2"
                  sx={{ fontVariantNumeric: "tabular-nums", fontWeight: 600, minWidth: 64, textAlign: "right" }}
                >
                  {formatCurrency(riga.prezzoTotale)} €
                </Typography>

                <IconButton
                  aria-label={`Togli ${riga.prodotto?.nome ?? "voce"} dall'ordine`}
                  size="small"
                  color="error"
                  disabled={inCorso}
                  onClick={() => onRimuovi(riga)}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Box>
            ))}
          </Box>

          <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", mt: 1.5 }}>
            <Typography
              variant="body2"
              color="text.secondary"
            >
              Totale
            </Typography>
            <Typography
              variant="h5"
              sx={{ fontVariantNumeric: "tabular-nums" }}
            >
              {formatCurrency(ordine.totaleCorrente)} €
            </Typography>
          </Box>

          <Box sx={{ display: "flex", gap: 1, mt: 1.5 }}>
            <Button
              onClick={onChiudi}
              disabled={inCorso}
              sx={{ minHeight: 56, flex: 1 }}
            >
              Continua a battere
            </Button>
            <Button
              variant="contained"
              onClick={onIncassa}
              disabled={inCorso || righe.length === 0}
              sx={{ minHeight: 56, flex: 1.4 }}
            >
              Chiudi ordine
            </Button>
          </Box>
        </Box>
      )}
    </Drawer>
  );
}

export default OrdineCorrente;
