import { useCallback, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";

import formatCurrency from "../../../common/bones/formatCurrency";
import { METODI_PAGAMENTO } from "./metodiPagamento";

interface SceltaMetodoPagamentoProps {
  prodotto: ProdottoVendibile | null;
  inCorso?: boolean;
  onChiudi: () => void;
  onConferma: (metodo: MetodoPagamentoVendita, quantita: number) => void;
}

/**
 * Il **secondo tocco**: scelto il prodotto, si sceglie dove finiscono i soldi.
 *
 * <p>Sale dal basso e non è un dialog centrato, e la differenza è tutta ergonomica: questo è il
 * gesto che si fa con una mano sola, senza guardare, con il telefono tenuto in basso. Tre
 * bersagli a metà schermo costringerebbero a cambiare presa ogni volta.</p>
 *
 * ⚠️ Aree di tocco ≥ 56 px e nessuna azione distruttiva adiacente: qui si sbaglia in fretta, e
 *    ogni errore è una riga contabile da correggere.
 */
function SceltaMetodoPagamento({ prodotto, inCorso = false, onChiudi, onConferma }: SceltaMetodoPagamentoProps) {
  const [quantita, setQuantita] = useState(1);

  // Ogni apertura riparte da 1: la quantità dell'ordinazione precedente non ha nulla a che
  // vedere con questa, e ricordarla farebbe battere due birre a chi ne voleva una.
  useEffect(() => {
    if (prodotto) {
      setQuantita(1);
    }
  }, [prodotto]);

  const handleConferma = useCallback(
    (metodo: MetodoPagamentoVendita) => {
      onConferma(metodo, quantita);
    },
    [onConferma, quantita]
  );

  const totale = prodotto ? prodotto.prezzo * quantita : 0;

  return (
    <Drawer
      anchor="bottom"
      open={Boolean(prodotto)}
      onClose={onChiudi}
      slotProps={{ paper: { sx: { borderTopLeftRadius: 16, borderTopRightRadius: 16 } } }}
    >
      {prodotto && (
        <Box sx={{ p: 2, pb: 3, maxWidth: 560, mx: "auto", width: "100%" }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, mb: 2 }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="h6"
                noWrap
              >
                {prodotto.nome}
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
              >
                {formatCurrency(prodotto.prezzo)} × {quantita} = <strong>{formatCurrency(totale)}</strong>
              </Typography>
            </Box>

            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexShrink: 0 }}>
              <IconButton
                aria-label="Diminuisci quantità"
                onClick={() => setQuantita((q) => Math.max(1, q - 1))}
                disabled={quantita <= 1 || inCorso}
                sx={{ border: 1, borderColor: "divider", width: 44, height: 44 }}
              >
                <RemoveIcon />
              </IconButton>
              <Typography
                sx={{ minWidth: 28, textAlign: "center", fontVariantNumeric: "tabular-nums" }}
                variant="h6"
              >
                {quantita}
              </Typography>
              <IconButton
                aria-label="Aumenta quantità"
                onClick={() => setQuantita((q) => q + 1)}
                disabled={inCorso}
                sx={{ border: 1, borderColor: "divider", width: 44, height: 44 }}
              >
                <AddIcon />
              </IconButton>
            </Box>
          </Box>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {METODI_PAGAMENTO.map((metodo) => {
              const Icona = metodo.icona;
              return (
                <Button
                  key={metodo.valore}
                  variant="contained"
                  color={metodo.colore}
                  size="large"
                  disabled={inCorso}
                  startIcon={<Icona />}
                  onClick={() => handleConferma(metodo.valore)}
                  sx={{
                    minHeight: 56,
                    justifyContent: "flex-start",
                    textAlign: "left",
                    textTransform: "none",
                    px: 2,
                  }}
                >
                  <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.2 }}>
                    <Typography
                      component="span"
                      sx={{ fontWeight: 600 }}
                    >
                      {metodo.etichetta}
                    </Typography>
                    <Typography
                      component="span"
                      variant="caption"
                      sx={{ opacity: 0.85 }}
                    >
                      {metodo.effetto}
                    </Typography>
                  </Box>
                </Button>
              );
            })}
          </Box>

          <Button
            fullWidth
            onClick={onChiudi}
            disabled={inCorso}
            sx={{ mt: 1.5, minHeight: 44 }}
          >
            Annulla
          </Button>
        </Box>
      )}
    </Drawer>
  );
}

export default SceltaMetodoPagamento;
