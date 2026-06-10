import { useState, useCallback } from "react";
import {
  Paper,
  Typography,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  TextField,
  IconButton,
  MenuItem,
  Stack,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Tooltip,
} from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
} from "@mui/icons-material";
import AppDialog from "../../common/dialog/AppDialog";
import DateField from "../../common/form/DateField";
import { useMutation } from "@apollo/client";
import { toast } from "react-toastify";
import dayjs from "dayjs";

import {
  CREA_GIORNO_NON_LAVORATIVO,
  AGGIORNA_GIORNO_NON_LAVORATIVO,
  ELIMINA_GIORNO_NON_LAVORATIVO,
} from "../../../graphql/settings/mutations";
import { GET_BUSINESS_SETTINGS } from "../../../graphql/settings/queries";
import useConfirm from "../../common/confirm/useConfirm";

const CODICI_MOTIVO = [
  { value: "FESTIVITA_NAZIONALE", label: "Festività Nazionale" },
  { value: "CHIUSURA_STRAORDINARIA", label: "Chiusura Straordinaria" },
  { value: "FERIE", label: "Ferie" },
];

const motivoLabelMap: Record<string, string> = {
  FESTIVITA_NAZIONALE: "Festività Nazionale",
  CHIUSURA_STRAORDINARIA: "Chiusura Straordinaria",
  FERIE: "Ferie",
};

interface GiornoDialogState {
  open: boolean;
  mode: "crea" | "modifica";
  giornoId?: number;
  data: string;
  descrizione: string;
  codiceMotivo: string;
  ricorrente: boolean;
}

const initialDialogState: GiornoDialogState = {
  open: false,
  mode: "crea",
  data: dayjs().format("YYYY-MM-DD"),
  descrizione: "",
  codiceMotivo: "FESTIVITA_NAZIONALE",
  ricorrente: false,
};

interface GiorniNonLavorativiSectionProps {
  giorniNonLavorativi: GiornoNonLavorativo[];
}

function GiorniNonLavorativiSection({ giorniNonLavorativi }: GiorniNonLavorativiSectionProps) {
  const [dialogState, setDialogState] = useState<GiornoDialogState>(initialDialogState);
  const onConfirm = useConfirm();

  // La sincronizzazione dello store avviene nel padre (SettingsDetails):
  // il refetch awaited di GET_BUSINESS_SETTINGS aggiorna la query osservata
  // → effect unico → useSyncSettingsToStore.
  const [creaGiorno, { loading: creando }] = useMutation(CREA_GIORNO_NON_LAVORATIVO, {
    refetchQueries: [{ query: GET_BUSINESS_SETTINGS }],
    awaitRefetchQueries: true,
    onCompleted: () => {
      toast.success("Giorno non lavorativo creato con successo");
      setDialogState(initialDialogState);
    },
    onError: (err) => {
      toast.error(err.message || "Errore durante la creazione del giorno non lavorativo");
    },
  });

  const [aggiornaGiorno, { loading: aggiornando }] = useMutation(AGGIORNA_GIORNO_NON_LAVORATIVO, {
    refetchQueries: [{ query: GET_BUSINESS_SETTINGS }],
    awaitRefetchQueries: true,
    onCompleted: () => {
      toast.success("Giorno non lavorativo aggiornato con successo");
      setDialogState(initialDialogState);
    },
    onError: (err) => {
      toast.error(err.message || "Errore durante l'aggiornamento del giorno non lavorativo");
    },
  });

  const [eliminaGiorno, { loading: eliminando }] = useMutation(ELIMINA_GIORNO_NON_LAVORATIVO, {
    refetchQueries: [{ query: GET_BUSINESS_SETTINGS }],
    awaitRefetchQueries: true,
    onCompleted: () => {
      toast.success("Giorno non lavorativo eliminato con successo");
    },
    onError: (err) => {
      toast.error(err.message || "Errore durante l'eliminazione del giorno non lavorativo");
    },
  });

  // Ordina per data ASC
  const giorniOrdinati = [...giorniNonLavorativi].sort((a, b) => (a.data > b.data ? 1 : -1));

  const handleApriDialogNuovo = useCallback(() => {
    setDialogState({
      open: true,
      mode: "crea",
      data: dayjs().format("YYYY-MM-DD"),
      descrizione: "",
      codiceMotivo: "FESTIVITA_NAZIONALE",
      ricorrente: false,
    });
  }, []);

  const handleApriDialogModifica = useCallback((giorno: GiornoNonLavorativo) => {
    setDialogState({
      open: true,
      mode: "modifica",
      giornoId: giorno.giornoId,
      data: giorno.data,
      descrizione: giorno.descrizione,
      codiceMotivo: giorno.codiceMotivo,
      ricorrente: giorno.ricorrente,
    });
  }, []);

  const handleChiudiDialog = useCallback(() => {
    setDialogState(initialDialogState);
  }, []);

  const handleSubmitDialog = useCallback(async () => {
    if (dialogState.mode === "crea") {
      await creaGiorno({
        variables: {
          input: {
            data: dialogState.data,
            descrizione: dialogState.descrizione,
            codiceMotivo: dialogState.codiceMotivo,
            ricorrente: dialogState.ricorrente,
          },
        },
      });
    } else {
      await aggiornaGiorno({
        variables: {
          input: {
            giornoId: dialogState.giornoId,
            data: dialogState.data,
            descrizione: dialogState.descrizione,
            codiceMotivo: dialogState.codiceMotivo,
            ricorrente: dialogState.ricorrente,
          },
        },
      });
    }
  }, [dialogState, creaGiorno, aggiornaGiorno]);

  const handleElimina = useCallback(
    async (giorno: GiornoNonLavorativo) => {
      const confirmed = await onConfirm({
        title: "Elimina Giorno Non Lavorativo",
        content: `Sei sicuro di voler eliminare "${giorno.descrizione}" (${dayjs(giorno.data).format("DD/MM/YYYY")})?`,
        acceptLabel: "Elimina",
        cancelLabel: "Annulla",
      });
      if (!confirmed) return;

      await eliminaGiorno({
        variables: { giornoId: giorno.giornoId },
      });
    },
    [onConfirm, eliminaGiorno],
  );

  const isLoading = creando || aggiornando || eliminando;
  const isFormValido = dialogState.data.length > 0 && dialogState.descrizione.trim().length > 0;

  return (
    <Paper
      variant="outlined"
      sx={{ p: 2.5 }}
    >
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography
          variant="subtitle1"
          fontWeight={600}
        >
          Giorni Non Lavorativi
        </Typography>
        <Button
          variant="outlined"
          size="small"
          startIcon={<AddIcon />}
          onClick={handleApriDialogNuovo}
          disabled={isLoading}
        >
          Aggiungi
        </Button>
      </Box>

      {giorniOrdinati.length === 0 && (
        <Typography
          variant="body2"
          color="text.secondary"
        >
          Nessun giorno non lavorativo configurato.
        </Typography>
      )}

      {giorniOrdinati.length > 0 && (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Data</TableCell>
              <TableCell>Descrizione</TableCell>
              <TableCell>Motivo</TableCell>
              <TableCell align="center">Ricorrente</TableCell>
              <TableCell align="right">Azioni</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {giorniOrdinati.map((giorno) => (
              <TableRow key={giorno.giornoId}>
                <TableCell>{dayjs(giorno.data).format("DD/MM/YYYY")}</TableCell>
                <TableCell>{giorno.descrizione}</TableCell>
                <TableCell>{motivoLabelMap[giorno.codiceMotivo] || giorno.codiceMotivo}</TableCell>
                <TableCell align="center">
                  {giorno.ricorrente ? (
                    <Tooltip title="Si ripete ogni anno">
                      <CheckCircleIcon
                        fontSize="small"
                        color="success"
                      />
                    </Tooltip>
                  ) : (
                    <Tooltip title="Solo quest'anno">
                      <CancelIcon
                        fontSize="small"
                        color="disabled"
                      />
                    </Tooltip>
                  )}
                </TableCell>
                <TableCell align="right">
                  <Box sx={{ display: "flex", gap: 0.5, justifyContent: "flex-end" }}>
                    <IconButton
                      size="small"
                      onClick={() => handleApriDialogModifica(giorno)}
                      disabled={isLoading}
                      title="Modifica"
                      aria-label="Modifica"
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleElimina(giorno)}
                      disabled={isLoading}
                      color="error"
                      title="Elimina"
                      aria-label="Elimina"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Dialog Crea / Modifica Giorno Non Lavorativo */}
      <AppDialog
        open={dialogState.open}
        onClose={handleChiudiDialog}
        title={dialogState.mode === "crea" ? "Nuovo Giorno Non Lavorativo" : "Modifica Giorno Non Lavorativo"}
        maxWidth="444px"
        width={{ xs: "95%", sm: "444px" }}
        footer={
          <Stack
            direction="row"
            spacing={1}
            justifyContent="flex-end"
          >
            <Button
              variant="outlined"
              size="small"
              onClick={handleChiudiDialog}
              disabled={isLoading}
            >
              Annulla
            </Button>
            <Button
              variant="contained"
              size="small"
              onClick={handleSubmitDialog}
              disabled={isLoading || !isFormValido}
            >
              {dialogState.mode === "crea" ? "Crea" : "Salva"}
            </Button>
          </Stack>
        }
      >
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <DateField
              name="giornoData"
              label="Data"
              value={dialogState.data}
              onChange={(_name, value) => setDialogState((prev) => ({ ...prev, data: value }))}
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{ colorScheme: (theme) => theme.palette.mode }}
              fullWidth
            />
            <TextField
              label="Descrizione"
              value={dialogState.descrizione}
              onChange={(e) => setDialogState((prev) => ({ ...prev, descrizione: e.target.value }))}
              fullWidth
            />
            <TextField
              label="Motivo"
              select
              value={dialogState.codiceMotivo}
              onChange={(e) => setDialogState((prev) => ({ ...prev, codiceMotivo: e.target.value }))}
              fullWidth
            >
              {CODICI_MOTIVO.map((m) => (
                <MenuItem
                  key={m.value}
                  value={m.value}
                >
                  {m.label}
                </MenuItem>
              ))}
            </TextField>
            <FormControlLabel
              control={
                <Checkbox
                  checked={dialogState.ricorrente}
                  onChange={(e) => setDialogState((prev) => ({ ...prev, ricorrente: e.target.checked }))}
                  size="small"
                />
              }
              label="Si ripete ogni anno"
            />
          </Box>
      </AppDialog>
    </Paper>
  );
}

export default GiorniNonLavorativiSection;
