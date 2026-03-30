import { useCallback, useMemo, useRef, useState } from "react";
import { Modal, Box, Typography, IconButton, Button, Stack, CircularProgress } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import CheckIcon from "@mui/icons-material/Check";
import { useQuery } from "@apollo/client";
import { AgGridReact } from "ag-grid-react";
import { ColDef, GridReadyEvent, SelectionChangedEvent, RowSelectionOptions } from "ag-grid-community";

import { getDocumentiTrasportoAperti } from "../../../graphql/fornitori/queries";

export type PrelevaDdtItem = {
  ddtId: number;
  numeroDdt: string;
  dataDdt: string;
  importo: number;
  note: string;
};

interface PrelevaDdtDialogProps {
  open: boolean;
  fornitoreId: number;
  onConfirm: (selectedItems: PrelevaDdtItem[]) => Promise<void>;
  onClose: () => void;
}

const modalStyle = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: { xs: "95%", sm: "90%", md: "70%" },
  maxWidth: "900px",
  height: { xs: "90%", sm: "80%", md: "70%" },
  bgcolor: "background.paper",
  borderRadius: "8px",
  boxShadow: 24,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

function PrelevaDdtDialog({ open, fornitoreId, onConfirm, onClose }: PrelevaDdtDialogProps) {
  const gridApiRef = useRef<GridReadyEvent<PrelevaDdtItem>["api"] | null>(null);
  const [selectedItems, setSelectedItems] = useState<PrelevaDdtItem[]>([]);
  const [selectedTotal, setSelectedTotal] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const { data, loading } = useQuery(getDocumentiTrasportoAperti, {
    variables: { fornitoreId },
    skip: !open || !fornitoreId,
    fetchPolicy: "network-only",
  });

  const items = useMemo<PrelevaDdtItem[]>(
    () =>
      (data?.fornitori?.documentiTrasportoAperti ?? []).map((d) => ({
        ddtId: d.ddtId,
        numeroDdt: d.numeroDdt,
        dataDdt: d.dataDdt ? d.dataDdt.split("T")[0] : "",
        importo: d.importo ?? 0,
        note: d.note ?? "",
      })),
    [data]
  );

  const columnDefs = useMemo<ColDef<PrelevaDdtItem>[]>(
    () => [
      { headerName: "Numero DDT", field: "numeroDdt", flex: 1 },
      { headerName: "Data DDT", field: "dataDdt", flex: 1 },
      {
        headerName: "Importo",
        field: "importo",
        width: 130,
        valueFormatter: (params) => (params.value != null ? Number(params.value).toFixed(2) : ""),
      },
      { headerName: "Note", field: "note", flex: 1 },
    ],
    []
  );

  const rowSelection = useMemo<RowSelectionOptions>(
    () => ({
      mode: "multiRow",
      checkboxes: true,
      headerCheckbox: true,
      enableClickSelection: true,
    }),
    []
  );

  const handleGridReady = useCallback((event: GridReadyEvent<PrelevaDdtItem>) => {
    gridApiRef.current = event.api;
  }, []);

  const handleSelectionChanged = useCallback((event: SelectionChangedEvent<PrelevaDdtItem>) => {
    const selected = event.api.getSelectedRows();
    setSelectedItems(selected);
    setSelectedTotal(selected.reduce((sum, r) => sum + (r.importo ?? 0), 0));
  }, []);

  const handleConfirm = useCallback(async () => {
    setSubmitting(true);
    try {
      await onConfirm(selectedItems);
    } finally {
      setSubmitting(false);
    }
  }, [onConfirm, selectedItems]);

  const handleClose = useCallback(() => {
    if (!submitting) {
      setSelectedItems([]);
      setSelectedTotal(0);
      onClose();
    }
  }, [submitting, onClose]);

  return (
    <Modal
      open={open}
      onClose={handleClose}
    >
      <Box sx={modalStyle}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", p: 2, borderBottom: 1, borderColor: "divider" }}>
          <Typography variant="h6">Preleva DDT</Typography>
          <IconButton
            onClick={handleClose}
            disabled={submitting}
          >
            <CloseIcon />
          </IconButton>
        </Box>

        <Box sx={{ flex: 1, overflow: "hidden", p: 2 }}>
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
              <CircularProgress />
            </Box>
          ) : items.length === 0 ? (
            <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
              <Typography color="text.secondary">Nessun DDT aperto disponibile per questo fornitore</Typography>
            </Box>
          ) : (
            <div style={{ height: "100%", width: "100%" }}>
              <AgGridReact<PrelevaDdtItem>
                rowData={items}
                columnDefs={columnDefs}
                rowSelection={rowSelection}
                onGridReady={handleGridReady}
                onSelectionChanged={handleSelectionChanged}
                getRowId={({ data }) => data.ddtId.toString()}
              />
            </div>
          )}
        </Box>

        <Stack
          direction="row"
          spacing={2}
          sx={{ p: 2, borderTop: 1, borderColor: "divider", justifyContent: "space-between", alignItems: "center" }}
        >
          <Typography variant="body2">
            {selectedItems.length > 0 ? `${selectedItems.length} DDT selezionati — Totale: ${selectedTotal.toFixed(2)} \u20AC` : "Nessun DDT selezionato"}
          </Typography>
          <Stack
            direction="row"
            spacing={1}
          >
            <Button
              variant="outlined"
              onClick={handleClose}
              disabled={submitting}
            >
              Annulla
            </Button>
            <Button
              variant="contained"
              startIcon={submitting ? <CircularProgress size={16} /> : <CheckIcon />}
              disabled={selectedItems.length === 0 || submitting}
              onClick={handleConfirm}
            >
              Conferma
            </Button>
          </Stack>
        </Stack>
      </Box>
    </Modal>
  );
}

export default PrelevaDdtDialog;
