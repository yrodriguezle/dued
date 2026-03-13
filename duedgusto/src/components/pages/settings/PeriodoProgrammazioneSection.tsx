import { useState, useCallback } from "react";
import {
  Paper,
  Typography,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  IconButton,
  Divider,
} from "@mui/material";
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from "@mui/icons-material";
import { useMutation } from "@apollo/client";
import { toast } from "react-toastify";
import dayjs from "dayjs";

import {
  CREA_PERIODO_PROGRAMMAZIONE,
  AGGIORNA_PERIODO_PROGRAMMAZIONE,
  ELIMINA_PERIODO_PROGRAMMAZIONE,
} from "../../../graphql/settings/mutations";
import { GET_BUSINESS_SETTINGS } from "../../../graphql/settings/queries";
import useConfirm from "../../common/confirm/useConfirm";

const GIORNI_SETTIMANA = [
  { index: 0, label: "Lun" },
  { index: 1, label: "Mar" },
  { index: 2, label: "Mer" },
  { index: 3, label: "Gio" },
  { index: 4, label: "Ven" },
  { index: 5, label: "Sab" },
  { index: 6, label: "Dom" },
];

const defaultGiorniOperativi = [true, true, true, true, true, false, false];

interface PeriodoDialogState {
  open: boolean;
  mode: "crea" | "modifica";
  periodoId?: number;
  dataInizio: string;
  giorniOperativi: boolean[];
  orarioApertura: string;
  orarioChiusura: string;
}

const initialDialogState: PeriodoDialogState = {
  open: false,
  mode: "crea",
  dataInizio: dayjs().format("YYYY-MM-DD"),
  giorniOperativi: [...defaultGiorniOperativi],
  orarioApertura: "09:00",
  orarioChiusura: "18:00",
};

interface PeriodoProgrammazioneSectionProps {
  periodi: PeriodoProgrammazione[];
}

function PeriodoProgrammazioneSection({ periodi }: PeriodoProgrammazioneSectionProps) {
  const [dialogState, setDialogState] = useState<PeriodoDialogState>(initialDialogState);
  const onConfirm = useConfirm();

  const [creaPeriodo, { loading: creando }] = useMutation(CREA_PERIODO_PROGRAMMAZIONE, {
    refetchQueries: [{ query: GET_BUSINESS_SETTINGS }],
    onCompleted: (data) => {
      toast.success("Periodo creato con successo");
      setDialogState(initialDialogState);
      // Aggiorna lo store con i periodi dal refetch
      const periodiData = data?.settings?.creaPeriodo;
      if (periodiData) {
        // Il refetch aggiornerà automaticamente i dati nella cache Apollo
        // Lo store verrà aggiornato tramite il componente padre
      }
    },
    onError: (err) => {
      toast.error(err.message || "Errore durante la creazione del periodo");
    },
  });

  const [aggiornaPeriodo, { loading: aggiornando }] = useMutation(AGGIORNA_PERIODO_PROGRAMMAZIONE, {
    refetchQueries: [{ query: GET_BUSINESS_SETTINGS }],
    onCompleted: () => {
      toast.success("Periodo aggiornato con successo");
      setDialogState(initialDialogState);
    },
    onError: (err) => {
      toast.error(err.message || "Errore durante l'aggiornamento del periodo");
    },
  });

  const [eliminaPeriodo, { loading: eliminando }] = useMutation(ELIMINA_PERIODO_PROGRAMMAZIONE, {
    refetchQueries: [{ query: GET_BUSINESS_SETTINGS }],
    onCompleted: () => {
      toast.success("Periodo eliminato con successo");
    },
    onError: (err) => {
      toast.error(err.message || "Errore durante l'eliminazione del periodo");
    },
  });

  // Ordina i periodi per DataInizio DESC
  const periodiOrdinati = [...periodi].sort((a, b) => (b.dataInizio > a.dataInizio ? 1 : -1));

  // Prendi gli orari dal periodo attivo come default per nuovi periodi
  const periodoAttivo = periodi.find((p) => p.dataFine === null);

  const handleApriDialogNuovo = useCallback(() => {
    setDialogState({
      open: true,
      mode: "crea",
      dataInizio: dayjs().format("YYYY-MM-DD"),
      giorniOperativi: periodoAttivo ? [...periodoAttivo.giorniOperativi] : [...defaultGiorniOperativi],
      orarioApertura: periodoAttivo?.orarioApertura ?? "09:00",
      orarioChiusura: periodoAttivo?.orarioChiusura ?? "18:00",
    });
  }, [periodoAttivo]);

  const handleApriDialogModifica = useCallback((periodo: PeriodoProgrammazione) => {
    setDialogState({
      open: true,
      mode: "modifica",
      periodoId: periodo.periodoId,
      dataInizio: periodo.dataInizio,
      giorniOperativi: [...periodo.giorniOperativi],
      orarioApertura: periodo.orarioApertura,
      orarioChiusura: periodo.orarioChiusura,
    });
  }, []);

  const handleChiudiDialog = useCallback(() => {
    setDialogState(initialDialogState);
  }, []);

  const handleCambiaGiorno = useCallback((index: number, checked: boolean) => {
    setDialogState((prev) => {
      const nuoviGiorni = [...prev.giorniOperativi];
      nuoviGiorni[index] = checked;
      return { ...prev, giorniOperativi: nuoviGiorni };
    });
  }, []);

  const handleCambiaDataInizio = useCallback((value: string) => {
    setDialogState((prev) => ({ ...prev, dataInizio: value }));
  }, []);

  const handleSubmitDialog = useCallback(async () => {
    const giorniOperativiJson = JSON.stringify(dialogState.giorniOperativi);

    if (dialogState.mode === "crea") {
      await creaPeriodo({
        variables: {
          periodo: {
            dataInizio: dialogState.dataInizio,
            giorniOperativi: giorniOperativiJson,
            orarioApertura: dialogState.orarioApertura,
            orarioChiusura: dialogState.orarioChiusura,
          },
        },
      });
    } else {
      await aggiornaPeriodo({
        variables: {
          periodo: {
            periodoId: dialogState.periodoId,
            dataInizio: dialogState.dataInizio,
            giorniOperativi: giorniOperativiJson,
            orarioApertura: dialogState.orarioApertura,
            orarioChiusura: dialogState.orarioChiusura,
          },
        },
      });
    }
  }, [dialogState, creaPeriodo, aggiornaPeriodo]);

  const handleElimina = useCallback(
    async (periodo: PeriodoProgrammazione) => {
      const confirmed = await onConfirm({
        title: "Elimina Periodo",
        content: `Sei sicuro di voler eliminare il periodo dal ${dayjs(periodo.dataInizio).format("DD/MM/YYYY")} al ${periodo.dataFine ? dayjs(periodo.dataFine).format("DD/MM/YYYY") : "In corso"}?`,
        acceptLabel: "Elimina",
        cancelLabel: "Annulla",
      });
      if (!confirmed) return;

      await eliminaPeriodo({
        variables: { periodoId: periodo.periodoId },
      });
    },
    [onConfirm, eliminaPeriodo]
  );

  const isLoading = creando || aggiornando || eliminando;

  const nessunaGiornoSelezionato = dialogState.giorniOperativi.every((g) => !g);

  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={600}>
          Periodi di apertura
        </Typography>
        <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={handleApriDialogNuovo} disabled={isLoading}>
          Nuovo Periodo
        </Button>
      </Box>

      {periodiOrdinati.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          Nessun periodo configurato.
        </Typography>
      )}

      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        {periodiOrdinati.map((periodo) => {
          const isAttivo = periodo.dataFine === null;
          return (
            <Paper
              key={periodo.periodoId}
              variant="outlined"
              sx={{
                p: 2,
                borderColor: isAttivo ? "primary.main" : "divider",
                borderWidth: isAttivo ? 2 : 1,
                backgroundColor: isAttivo ? "action.hover" : "transparent",
              }}
            >
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Typography variant="body2" fontWeight={600}>
                    Dal {dayjs(periodo.dataInizio).format("DD/MM/YYYY")}
                    {periodo.dataFine ? ` al ${dayjs(periodo.dataFine).format("DD/MM/YYYY")}` : ""}
                  </Typography>
                  {isAttivo && <Chip label="In corso" color="primary" size="small" />}
                </Box>
                <Box sx={{ display: "flex", gap: 0.5 }}>
                  <IconButton size="small" onClick={() => handleApriDialogModifica(periodo)} disabled={isLoading} title="Modifica">
                    <EditIcon fontSize="small" />
                  </IconButton>
                  {!isAttivo && (
                    <IconButton size="small" onClick={() => handleElimina(periodo)} disabled={isLoading} color="error" title="Elimina">
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  )}
                </Box>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 0.5 }}>
                <Typography variant="body2" color="text.secondary">
                  {periodo.orarioApertura} - {periodo.orarioChiusura}
                </Typography>
              </Box>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                {GIORNI_SETTIMANA.map(({ index, label }) => (
                  <FormControlLabel
                    key={index}
                    control={<Checkbox checked={periodo.giorniOperativi[index] || false} size="small" disabled />}
                    label={label}
                    sx={{ mr: 1, "& .MuiFormControlLabel-label": { fontSize: "0.8rem" } }}
                  />
                ))}
              </Box>
            </Paper>
          );
        })}
      </Box>

      {/* Dialog Crea / Modifica Periodo */}
      <Dialog open={dialogState.open} onClose={handleChiudiDialog} maxWidth="xs" fullWidth>
        <DialogTitle>{dialogState.mode === "crea" ? "Nuovo Periodo" : "Modifica Periodo"}</DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2 }}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
            <TextField
              label="Data Inizio"
              type="date"
              value={dialogState.dataInizio}
              onChange={(e) => handleCambiaDataInizio(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{ colorScheme: (theme) => theme.palette.mode }}
              fullWidth
              disabled={dialogState.mode === "modifica"}
            />
            <Box sx={{ display: "flex", gap: 2 }}>
              <TextField
                label="Apertura"
                type="time"
                value={dialogState.orarioApertura}
                onChange={(e) => setDialogState((prev) => ({ ...prev, orarioApertura: e.target.value }))}
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { step: 300 } }}
                sx={{ colorScheme: (theme) => theme.palette.mode }}
                fullWidth
              />
              <TextField
                label="Chiusura"
                type="time"
                value={dialogState.orarioChiusura}
                onChange={(e) => setDialogState((prev) => ({ ...prev, orarioChiusura: e.target.value }))}
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { step: 300 } }}
                sx={{ colorScheme: (theme) => theme.palette.mode }}
                fullWidth
              />
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Giorni di apertura
              </Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                {GIORNI_SETTIMANA.map(({ index, label }) => (
                  <FormControlLabel
                    key={index}
                    control={
                      <Checkbox
                        checked={dialogState.giorniOperativi[index] || false}
                        onChange={(e) => handleCambiaGiorno(index, e.target.checked)}
                        size="small"
                      />
                    }
                    label={label}
                    sx={{ mr: 1 }}
                  />
                ))}
              </Box>
              {nessunaGiornoSelezionato && (
                <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                  Seleziona almeno un giorno di apertura
                </Typography>
              )}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleChiudiDialog} disabled={isLoading}>
            Annulla
          </Button>
          <Button variant="contained" onClick={handleSubmitDialog} disabled={isLoading || nessunaGiornoSelezionato}>
            {dialogState.mode === "crea" ? "Crea" : "Salva"}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}

export default PeriodoProgrammazioneSection;
