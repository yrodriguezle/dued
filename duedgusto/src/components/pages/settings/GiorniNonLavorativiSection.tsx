import { useState, useCallback, useMemo, useRef } from "react";
import { Paper, Typography, Box, Button, IconButton, MenuItem, Stack, TextField, Tooltip } from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
} from "@mui/icons-material";
import { GridReadyEvent, RowSelectionOptions } from "ag-grid-community";
import { useMutation } from "@apollo/client";
import { toast } from "react-toastify";
import dayjs from "dayjs";

import Datagrid from "../../common/datagrid/Datagrid";
import { DatagridColDef, DatagridData, DatagridRowDoubleClickedEvent } from "../../common/datagrid/@types/Datagrid";
import useConfirm from "../../common/confirm/useConfirm";
import GiorniNonLavorativiDialog, { GiornoNonLavorativoFormValues, GiornoNonLavorativoSubmit } from "./GiorniNonLavorativiDialog";
import {
  CODICI_MOTIVO,
  FiltroAnno,
  FiltroMotivo,
  RigaGiorniNonLavorativi,
  TUTTI,
  aggregaGiorniNonLavorativi,
  anniDisponibili,
  filtraGiorniNonLavorativi,
} from "./aggregaGiorniNonLavorativi";

import {
  CREA_GIORNO_NON_LAVORATIVO,
  CREA_GIORNI_NON_LAVORATIVI_RANGE,
  AGGIORNA_GIORNO_NON_LAVORATIVO,
  ELIMINA_GIORNI_NON_LAVORATIVI,
} from "../../../graphql/settings/mutations";
import { GET_BUSINESS_SETTINGS } from "../../../graphql/settings/queries";

// Altezza della griglia calcolata sulle sole righe di primo livello: i gruppi
// partono collassati, quindi è ciò che l'utente vede prima di espandere.
const ALTEZZA_RIGA = 42;
const ALTEZZA_HEADER = 40;
const RIGHE_MIN = 10;
const RIGHE_MAX = 20;

interface DialogState {
  open: boolean;
  mode: "crea" | "modifica";
  initialValues?: GiornoNonLavorativoFormValues;
}

const dialogChiuso: DialogState = { open: false, mode: "crea" };

interface AzioniCellRendererParams {
  data?: RigaGiorniNonLavorativi;
  disabled: boolean;
  onModifica: (riga: RigaGiorniNonLavorativi) => void;
  onElimina: (riga: RigaGiorniNonLavorativi) => void;
}

function AzioniCellRenderer({ data, disabled, onModifica, onElimina }: AzioniCellRendererParams) {
  if (!data) return null;

  return (
    <Box sx={{ display: "flex", gap: 0.5, justifyContent: "flex-end", height: "100%", alignItems: "center" }}>
      {/* Le righe intervallo non hanno un record proprio: si modificano dai singoli giorni */}
      {data.tipoRiga === "giorno" && (
        <IconButton
          size="small"
          onClick={() => onModifica(data)}
          disabled={disabled}
          title="Modifica"
          aria-label="Modifica"
        >
          <EditIcon fontSize="small" />
        </IconButton>
      )}
      <IconButton
        size="small"
        onClick={() => onElimina(data)}
        disabled={disabled}
        color="error"
        title={data.tipoRiga === "intervallo" ? "Elimina intervallo" : "Elimina"}
        aria-label="Elimina"
      >
        <DeleteIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}

function RicorrenteCellRenderer({ value }: { value?: boolean }) {
  return (
    <Tooltip title={value ? "Si ripete ogni anno" : "Solo quest'anno"}>
      <Box sx={{ display: "flex", alignItems: "center", height: "100%" }}>
        {value ? (
          <CheckCircleIcon
            fontSize="small"
            color="success"
          />
        ) : (
          <CancelIcon
            fontSize="small"
            color="disabled"
          />
        )}
      </Box>
    </Tooltip>
  );
}

interface GiorniNonLavorativiSectionProps {
  giorniNonLavorativi: GiornoNonLavorativo[];
}

function GiorniNonLavorativiSection({ giorniNonLavorativi }: GiorniNonLavorativiSectionProps) {
  const [dialogState, setDialogState] = useState<DialogState>(dialogChiuso);
  const [annoSelezionato, setAnnoSelezionato] = useState<FiltroAnno>(() => dayjs().year());
  const [motivoSelezionato, setMotivoSelezionato] = useState<FiltroMotivo>(TUTTI);
  const [idsSelezionati, setIdsSelezionati] = useState<number[]>([]);
  const gridRef = useRef<GridReadyEvent<DatagridData<RigaGiorniNonLavorativi>> | null>(null);
  const onConfirm = useConfirm();

  // La sincronizzazione dello store avviene nel padre (SettingsDetails):
  // il refetch awaited di GET_BUSINESS_SETTINGS aggiorna la query osservata
  // → effect unico → useSyncSettingsToStore.
  const [creaGiorno, { loading: creando }] = useMutation(CREA_GIORNO_NON_LAVORATIVO, {
    refetchQueries: [{ query: GET_BUSINESS_SETTINGS }],
    awaitRefetchQueries: true,
    onCompleted: () => {
      toast.success("Giorno non lavorativo creato con successo");
      setDialogState(dialogChiuso);
    },
    onError: (err) => {
      toast.error(err.message || "Errore durante la creazione del giorno non lavorativo");
    },
  });

  const [creaGiorniRange, { loading: creandoRange }] = useMutation(CREA_GIORNI_NON_LAVORATIVI_RANGE, {
    refetchQueries: [{ query: GET_BUSINESS_SETTINGS }],
    awaitRefetchQueries: true,
    onCompleted: (data) => {
      const esito = data?.settings?.creaGiorniNonLavorativiRange;
      const creati = esito?.numeroCreati ?? 0;
      const saltati = esito?.numeroSaltati ?? 0;
      const messaggio =
        saltati > 0
          ? `${creati} giorni non lavorativi creati (${saltati} già presenti, saltati)`
          : `${creati} giorni non lavorativi creati con successo`;
      toast.success(messaggio);
      setDialogState(dialogChiuso);
    },
    onError: (err) => {
      toast.error(err.message || "Errore durante la creazione dei giorni non lavorativi");
    },
  });

  const [aggiornaGiorno, { loading: aggiornando }] = useMutation(AGGIORNA_GIORNO_NON_LAVORATIVO, {
    refetchQueries: [{ query: GET_BUSINESS_SETTINGS }],
    awaitRefetchQueries: true,
    onCompleted: () => {
      toast.success("Giorno non lavorativo aggiornato con successo");
      setDialogState(dialogChiuso);
    },
    onError: (err) => {
      toast.error(err.message || "Errore durante l'aggiornamento del giorno non lavorativo");
    },
  });

  const [eliminaGiorni, { loading: eliminando }] = useMutation(ELIMINA_GIORNI_NON_LAVORATIVI, {
    refetchQueries: [{ query: GET_BUSINESS_SETTINGS }],
    awaitRefetchQueries: true,
    onCompleted: (data) => {
      const esito = data?.settings?.eliminaGiorniNonLavorativi;
      const eliminati = esito?.numeroEliminati ?? 0;
      const nonTrovati = esito?.numeroNonTrovati ?? 0;
      toast.success(eliminati === 1 ? "1 giorno non lavorativo eliminato" : `${eliminati} giorni non lavorativi eliminati`);
      if (nonTrovati > 0) {
        toast.warning(`${nonTrovati} giorni erano già stati eliminati`);
      }
      gridRef.current?.api.deselectAll();
      setIdsSelezionati([]);
    },
    onError: (err) => {
      toast.error(err.message || "Errore durante l'eliminazione dei giorni non lavorativi");
    },
  });

  const isLoading = creando || creandoRange || aggiornando || eliminando;

  const anni = useMemo(() => anniDisponibili(giorniNonLavorativi), [giorniNonLavorativi]);

  const annoRiferimento = annoSelezionato === TUTTI ? dayjs().year() : annoSelezionato;

  const giorniFiltrati = useMemo(
    () => filtraGiorniNonLavorativi(giorniNonLavorativi, annoSelezionato, motivoSelezionato),
    [giorniNonLavorativi, annoSelezionato, motivoSelezionato],
  );

  const righe = useMemo(() => aggregaGiorniNonLavorativi(giorniFiltrati, annoRiferimento), [giorniFiltrati, annoRiferimento]);

  const altezzaGriglia = useMemo(() => {
    const righeRadice = righe.filter((r) => r.parentRowId === null).length;
    return `${Math.min(Math.max(righeRadice, RIGHE_MIN), RIGHE_MAX) * ALTEZZA_RIGA + ALTEZZA_HEADER}px`;
  }, [righe]);

  const handleApriDialogNuovo = useCallback(() => {
    setDialogState({ open: true, mode: "crea" });
  }, []);

  const handleApriDialogModifica = useCallback((riga: RigaGiorniNonLavorativi) => {
    if (riga.giornoId == null) return;
    setDialogState({
      open: true,
      mode: "modifica",
      initialValues: {
        giornoId: riga.giornoId,
        data: riga.data,
        descrizione: riga.descrizione,
        codiceMotivo: riga.codiceMotivo,
        ricorrente: riga.ricorrente,
      },
    });
  }, []);

  const handleChiudiDialog = useCallback(() => {
    setDialogState(dialogChiuso);
  }, []);

  const handleSubmitDialog = useCallback(
    async (valori: GiornoNonLavorativoSubmit) => {
      if (dialogState.mode === "crea" && valori.modalita === "intervallo") {
        await creaGiorniRange({
          variables: {
            input: {
              dataInizio: valori.data,
              dataFine: valori.dataFine,
              descrizione: valori.descrizione,
              codiceMotivo: valori.codiceMotivo,
              ricorrente: valori.ricorrente,
            },
          },
        });
      } else if (dialogState.mode === "crea") {
        await creaGiorno({
          variables: {
            input: {
              data: valori.data,
              descrizione: valori.descrizione,
              codiceMotivo: valori.codiceMotivo,
              ricorrente: valori.ricorrente,
            },
          },
        });
      } else {
        await aggiornaGiorno({
          variables: {
            input: {
              giornoId: valori.giornoId,
              data: valori.data,
              descrizione: valori.descrizione,
              codiceMotivo: valori.codiceMotivo,
              ricorrente: valori.ricorrente,
            },
          },
        });
      }
    },
    [dialogState.mode, creaGiorno, creaGiorniRange, aggiornaGiorno],
  );

  const handleEliminaRiga = useCallback(
    async (riga: RigaGiorniNonLavorativi) => {
      const contenuto =
        riga.tipoRiga === "intervallo"
          ? `Sei sicuro di voler eliminare l'intervallo "${riga.descrizione}" dal ${dayjs(riga.data).format("DD/MM/YYYY")} al ${dayjs(riga.dataFine).format("DD/MM/YYYY")} (${riga.numeroGiorni} giorni)?`
          : `Sei sicuro di voler eliminare "${riga.descrizione}" (${dayjs(riga.data).format("DD/MM/YYYY")})?`;

      const confirmed = await onConfirm({
        title: riga.tipoRiga === "intervallo" ? "Elimina Intervallo" : "Elimina Giorno Non Lavorativo",
        content: contenuto,
        acceptLabel: "Elimina",
        cancelLabel: "Annulla",
      });
      if (!confirmed) return;

      await eliminaGiorni({ variables: { giorniIds: riga.giorniIds } });
    },
    [onConfirm, eliminaGiorni],
  );

  const handleEliminaSelezionati = useCallback(async () => {
    if (idsSelezionati.length === 0) return;

    const confirmed = await onConfirm({
      title: "Elimina Giorni Non Lavorativi",
      content: `Sei sicuro di voler eliminare ${idsSelezionati.length} ${idsSelezionati.length === 1 ? "giorno non lavorativo selezionato" : "giorni non lavorativi selezionati"}?`,
      acceptLabel: "Elimina",
      cancelLabel: "Annulla",
    });
    if (!confirmed) return;

    await eliminaGiorni({ variables: { giorniIds: idsSelezionati } });
  }, [idsSelezionati, onConfirm, eliminaGiorni]);

  const handleGridReady = useCallback((event: GridReadyEvent<DatagridData<RigaGiorniNonLavorativi>>) => {
    gridRef.current = event;

    // Il Datagrid sovrascrive onSelectionChanged dopo lo spread delle props:
    // il listener va registrato qui (stesso pattern di MenuList / ListaRegistrazioneCassa).
    event.api.addEventListener("selectionChanged", () => {
      // Con groupSelects "descendants" tornano sia la riga intervallo sia le sue foglie
      const ids = event.api.getSelectedRows().flatMap((riga) => riga.giorniIds);
      setIdsSelezionati([...new Set(ids)]);
    });
  }, []);

  const handleRowDoubleClicked = useCallback(
    (event: DatagridRowDoubleClickedEvent<RigaGiorniNonLavorativi>) => {
      if (!event.data) return;
      handleApriDialogModifica(event.data);
    },
    [handleApriDialogModifica],
  );

  const handleCambioAnno = useCallback((valore: string) => {
    setAnnoSelezionato(valore === TUTTI ? TUTTI : Number(valore));
  }, []);

  const rowSelection = useMemo<RowSelectionOptions<DatagridData<RigaGiorniNonLavorativi>>>(
    () => ({
      mode: "multiRow",
      groupSelects: "descendants",
      checkboxes: true,
      headerCheckbox: true,
    }),
    [],
  );

  const columnDefs = useMemo<DatagridColDef<RigaGiorniNonLavorativi>[]>(
    () => [
      {
        field: "descrizione",
        headerName: "Descrizione",
        flex: 2,
        minWidth: 170,
        filter: true,
      },
      {
        field: "motivo",
        headerName: "Motivo",
        width: 190,
        filter: "agSetColumnFilter",
      },
      {
        field: "ricorrente",
        headerName: "Ricorrente",
        width: 130,
        cellRenderer: RicorrenteCellRenderer,
      },
      {
        colId: "azioni",
        headerName: "",
        width: 96,
        pinned: "right",
        sortable: false,
        filter: false,
        resizable: false,
        suppressHeaderMenuButton: true,
        cellRenderer: AzioniCellRenderer,
        cellRendererParams: {
          disabled: isLoading,
          onModifica: handleApriDialogModifica,
          onElimina: handleEliminaRiga,
        },
      },
    ],
    [isLoading, handleApriDialogModifica, handleEliminaRiga],
  );

  const autoGroupColumnDef = useMemo(
    () => ({
      headerName: "Periodo",
      field: "periodo",
      cellRenderer: "agGroupCellRenderer",
      flex: 2,
      minWidth: 250,
      sortable: true,
      filter: true,
    }),
    [],
  );

  return (
    <Paper
      variant="outlined"
      sx={{ p: 2.5 }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        alignItems={{ xs: "stretch", sm: "center" }}
        justifyContent="space-between"
        sx={{ mb: 2 }}
      >
        <Typography
          variant="subtitle1"
          fontWeight={600}
        >
          Giorni Non Lavorativi
        </Typography>
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          flexWrap="wrap"
          useFlexGap
        >
          <TextField
            label="Anno"
            select
            size="small"
            value={String(annoSelezionato)}
            onChange={(e) => handleCambioAnno(e.target.value)}
            sx={{ minWidth: 130 }}
          >
            {anni.map((anno) => (
              <MenuItem
                key={anno}
                value={String(anno)}
              >
                {anno}
              </MenuItem>
            ))}
            <MenuItem value={TUTTI}>Tutti gli anni</MenuItem>
          </TextField>
          <TextField
            label="Motivo"
            select
            size="small"
            value={motivoSelezionato}
            onChange={(e) => setMotivoSelezionato(e.target.value)}
            sx={{ minWidth: 190 }}
          >
            <MenuItem value={TUTTI}>Tutti i motivi</MenuItem>
            {CODICI_MOTIVO.map((m) => (
              <MenuItem
                key={m.value}
                value={m.value}
              >
                {m.label}
              </MenuItem>
            ))}
          </TextField>
          <Button
            variant="outlined"
            size="small"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={handleEliminaSelezionati}
            disabled={isLoading || idsSelezionati.length === 0}
          >
            Elimina ({idsSelezionati.length})
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<AddIcon />}
            onClick={handleApriDialogNuovo}
            disabled={isLoading}
          >
            Aggiungi
          </Button>
        </Stack>
      </Stack>

      <Datagrid<RigaGiorniNonLavorativi>
        gridId="giorni-non-lavorativi"
        presentation
        height={altezzaGriglia}
        items={righe}
        columnDefs={columnDefs}
        getRowId={({ data }) => data.rowId}
        treeData
        treeDataParentIdField="parentRowId"
        groupDefaultExpanded={0}
        autoGroupColumnDef={autoGroupColumnDef}
        rowSelection={rowSelection}
        onGridReady={handleGridReady}
        onRowDoubleClicked={handleRowDoubleClicked}
      />

      <GiorniNonLavorativiDialog
        open={dialogState.open}
        mode={dialogState.mode}
        initialValues={dialogState.initialValues}
        isLoading={isLoading}
        onClose={handleChiudiDialog}
        onSubmit={handleSubmitDialog}
      />
    </Paper>
  );
}

export default GiorniNonLavorativiSection;
