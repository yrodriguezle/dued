import { useCallback, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

interface DialogMotivoProps {
  aperto: boolean;
  titolo: string;
  /** Che cosa succede davvero confermando. Sono soldi: va detto, non lasciato intuire. */
  spiegazione: string;
  /** Le formule che si ripetono ogni sera. Il campo resta comunque libero. */
  suggerimenti?: string[];
  etichettaConferma: string;
  inCorso?: boolean;
  onChiudi: () => void;
  onConferma: (motivo: string) => void;
}

/**
 * La domanda «perché?» delle due operazioni che cancellano qualcosa: l'annullo di un ordine
 * aperto e lo storno di uno già incassato.
 *
 * 🔴 **Il motivo è obbligatorio, e gli spazi soli non valgono.** Il server rifiuta comunque un
 *    motivo vuoto, ma la ragione è la stessa da entrambe le parti: annullo e storno sono le
 *    scappatoie del sistema, e una scappatoia senza traccia non controlla niente. Un motivo
 *    fatto di spazi salvato **somiglierebbe** a una traccia senza esserlo, che è peggio di non
 *    averla.
 */
function DialogMotivo({ aperto, titolo, spiegazione, suggerimenti = [], etichettaConferma, inCorso = false, onChiudi, onConferma }: DialogMotivoProps) {
  const [motivo, setMotivo] = useState("");

  // Ogni apertura riparte vuota: il motivo dell'ordine precedente non spiega questo.
  useEffect(() => {
    if (aperto) {
      setMotivo("");
    }
  }, [aperto]);

  const handleConferma = useCallback(() => {
    const pulito = motivo.trim();
    if (pulito) {
      onConferma(pulito);
    }
  }, [motivo, onConferma]);

  return (
    <Dialog
      open={aperto}
      onClose={onChiudi}
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle>{titolo}</DialogTitle>
      <DialogContent dividers>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mb: 1.5 }}
        >
          {spiegazione}
        </Typography>

        {suggerimenti.length > 0 && (
          <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", mb: 1.5 }}>
            {suggerimenti.map((testo) => (
              <Chip
                key={testo}
                label={testo}
                variant="outlined"
                onClick={() => setMotivo(testo)}
                sx={{ height: 36 }}
              />
            ))}
          </Box>
        )}

        <TextField
          fullWidth
          autoFocus
          label="Motivo"
          value={motivo}
          onChange={(evento) => setMotivo(evento.target.value)}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onChiudi}>Indietro</Button>
        <Button
          variant="contained"
          color="error"
          disabled={!motivo.trim() || inCorso}
          onClick={handleConferma}
        >
          {etichettaConferma}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default DialogMotivo;
