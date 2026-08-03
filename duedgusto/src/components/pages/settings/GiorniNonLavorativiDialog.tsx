import { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Button, Checkbox, FormControlLabel, MenuItem, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import dayjs from "dayjs";

import AppDialog from "../../common/dialog/AppDialog";
import DateField from "../../common/form/DateField";
import { CODICI_MOTIVO, contaGiorniIntervallo } from "./aggregaGiorniNonLavorativi";

/** Limite allineato a GiorniNonLavorativiRangePlanner.MaxGiorni lato backend */
const MAX_GIORNI_INTERVALLO = 366;

export type ModalitaInserimento = "singolo" | "intervallo";

export interface GiornoNonLavorativoFormValues {
  giornoId?: number;
  data: string;
  descrizione: string;
  codiceMotivo: string;
  ricorrente: boolean;
}

export interface GiornoNonLavorativoSubmit extends GiornoNonLavorativoFormValues {
  modalita: ModalitaInserimento;
  dataFine: string;
}

interface GiornoDialogState extends GiornoNonLavorativoFormValues {
  modalita: ModalitaInserimento;
  dataFine: string;
}

function statoIniziale(initialValues?: GiornoNonLavorativoFormValues): GiornoDialogState {
  const oggi = dayjs().format("YYYY-MM-DD");
  return {
    modalita: "singolo",
    giornoId: initialValues?.giornoId,
    data: initialValues?.data ?? oggi,
    dataFine: initialValues?.data ?? oggi,
    descrizione: initialValues?.descrizione ?? "",
    codiceMotivo: initialValues?.codiceMotivo ?? "FESTIVITA_NAZIONALE",
    ricorrente: initialValues?.ricorrente ?? false,
  };
}

interface GiorniNonLavorativiDialogProps {
  open: boolean;
  mode: "crea" | "modifica";
  initialValues?: GiornoNonLavorativoFormValues;
  isLoading: boolean;
  onClose: () => void;
  onSubmit: (valori: GiornoNonLavorativoSubmit) => void | Promise<void>;
}

/**
 * Dialog di creazione/modifica di un giorno non lavorativo. In creazione permette di
 * inserire un intervallo di date (ferie) invece di un singolo giorno.
 */
function GiorniNonLavorativiDialog({ open, mode, initialValues, isLoading, onClose, onSubmit }: GiorniNonLavorativiDialogProps) {
  const [stato, setStato] = useState<GiornoDialogState>(() => statoIniziale(initialValues));

  // Ogni apertura riparte dai valori passati dal padre (nuovo giorno o riga da modificare)
  useEffect(() => {
    if (!open) return;
    setStato(statoIniziale(initialValues));
  }, [open, initialValues]);

  const handleCambioModalita = useCallback((_event: React.MouseEvent<HTMLElement>, valore: ModalitaInserimento | null) => {
    if (!valore) return;
    setStato((prev) => ({
      ...prev,
      modalita: valore,
      // Passando a intervallo la fine parte allineata all'inizio
      dataFine: valore === "intervallo" && dayjs(prev.dataFine).isBefore(dayjs(prev.data), "day") ? prev.data : prev.dataFine,
      // Un intervallo di ferie non ha senso ricorrente anno su anno
      ricorrente: valore === "intervallo" ? false : prev.ricorrente,
      codiceMotivo: valore === "intervallo" && prev.codiceMotivo === "FESTIVITA_NAZIONALE" ? "FERIE" : prev.codiceMotivo,
    }));
  }, []);

  const handleCambioData = useCallback((_name: string, value: string) => {
    setStato((prev) => ({ ...prev, data: value }));
  }, []);

  const handleCambioDataFine = useCallback((_name: string, value: string) => {
    setStato((prev) => ({ ...prev, dataFine: value }));
  }, []);

  const handleSubmit = useCallback(() => onSubmit(stato), [onSubmit, stato]);

  const isIntervallo = mode === "crea" && stato.modalita === "intervallo";

  const giorniIntervallo = useMemo(
    () => (isIntervallo ? contaGiorniIntervallo(stato.data, stato.dataFine) : 0),
    [isIntervallo, stato.data, stato.dataFine],
  );

  const erroreIntervallo = isIntervallo
    ? giorniIntervallo === 0
      ? "La data di fine deve essere uguale o successiva alla data di inizio"
      : giorniIntervallo > MAX_GIORNI_INTERVALLO
        ? `L'intervallo non può superare ${MAX_GIORNI_INTERVALLO} giorni (selezionati: ${giorniIntervallo})`
        : ""
    : "";

  const isFormValido = stato.data.length > 0 && stato.descrizione.trim().length > 0 && (!isIntervallo || erroreIntervallo === "");

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title={mode === "modifica" ? "Modifica Giorno Non Lavorativo" : isIntervallo ? "Nuovi Giorni Non Lavorativi" : "Nuovo Giorno Non Lavorativo"}
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
            onClick={onClose}
            disabled={isLoading}
          >
            Annulla
          </Button>
          <Button
            variant="contained"
            size="small"
            onClick={handleSubmit}
            disabled={isLoading || !isFormValido}
          >
            {mode === "crea" ? "Crea" : "Salva"}
          </Button>
        </Stack>
      }
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {mode === "crea" && (
          <ToggleButtonGroup
            value={stato.modalita}
            exclusive
            size="small"
            onChange={handleCambioModalita}
            fullWidth
            aria-label="Modalità inserimento"
          >
            <ToggleButton value="singolo">Giorno singolo</ToggleButton>
            <ToggleButton value="intervallo">Intervallo</ToggleButton>
          </ToggleButtonGroup>
        )}
        <Stack
          direction={{ xs: "column", sm: isIntervallo ? "row" : "column" }}
          spacing={2}
        >
          <DateField
            name="giornoData"
            label={isIntervallo ? "Data inizio" : "Data"}
            value={stato.data}
            onChange={handleCambioData}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ colorScheme: (theme) => theme.palette.mode }}
            fullWidth
          />
          {isIntervallo && (
            <DateField
              name="giornoDataFine"
              label="Data fine"
              value={stato.dataFine}
              onChange={handleCambioDataFine}
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{ colorScheme: (theme) => theme.palette.mode }}
              error={!!erroreIntervallo}
              fullWidth
            />
          )}
        </Stack>
        {isIntervallo && (
          <Typography
            variant="caption"
            color={erroreIntervallo ? "error" : "text.secondary"}
          >
            {erroreIntervallo ||
              `${giorniIntervallo} ${giorniIntervallo === 1 ? "giorno" : "giorni"} da creare. Le date già configurate vengono saltate.`}
          </Typography>
        )}
        <TextField
          label="Descrizione"
          value={stato.descrizione}
          onChange={(e) => setStato((prev) => ({ ...prev, descrizione: e.target.value }))}
          fullWidth
        />
        <TextField
          label="Motivo"
          select
          value={stato.codiceMotivo}
          onChange={(e) => setStato((prev) => ({ ...prev, codiceMotivo: e.target.value }))}
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
        {!isIntervallo && (
          <FormControlLabel
            control={
              <Checkbox
                checked={stato.ricorrente}
                onChange={(e) => setStato((prev) => ({ ...prev, ricorrente: e.target.checked }))}
                size="small"
              />
            }
            label="Si ripete ogni anno"
          />
        )}
      </Box>
    </AppDialog>
  );
}

export default GiorniNonLavorativiDialog;
