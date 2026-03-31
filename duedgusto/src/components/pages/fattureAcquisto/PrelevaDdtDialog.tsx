import { useCallback, useMemo, useState } from "react";
import { Typography, Button, Stack, CircularProgress, Box } from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import { useQuery } from "@apollo/client";
import { RowSelectionOptions } from "ag-grid-community";

import AppDialog from "../../common/dialog/AppDialog";
import Datagrid from "../../common/datagrid/Datagrid";
import { DatagridColDef, DatagridRowSelectedEvent } from "../../common/datagrid/@types/Datagrid";
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

function PrelevaDdtDialog({ open, fornitoreId, onConfirm, onClose }: PrelevaDdtDialogProps) {
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

  const columnDefs = useMemo<DatagridColDef<PrelevaDdtItem>[]>(
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

  const handleRowSelected = useCallback((event: DatagridRowSelectedEvent<PrelevaDdtItem>) => {
    const selected = event.api.getSelectedRows();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const cleanSelected = selected.map(({ status, ...rest }) => rest as unknown as PrelevaDdtItem);
    setSelectedItems(cleanSelected);
    setSelectedTotal(cleanSelected.reduce((sum, r) => sum + (r.importo ?? 0), 0));
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

  const footer = (
    <Stack
      direction="row"
      spacing={2}
      justifyContent="space-between"
      alignItems="center"
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
          size="small"
          onClick={handleClose}
          disabled={submitting}
        >
          Annulla
        </Button>
        <Button
          variant="contained"
          size="small"
          startIcon={submitting ? <CircularProgress size={16} /> : <CheckIcon />}
          disabled={selectedItems.length === 0 || submitting}
          onClick={handleConfirm}
        >
          Conferma
        </Button>
      </Stack>
    </Stack>
  );

  return (
    <AppDialog
      open={open}
      onClose={handleClose}
      title="Preleva DDT"
      maxWidth="900px"
      height={{ xs: "90%", sm: "80%", md: "70%" }}
      disableClose={submitting}
      footer={footer}
    >
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
          <CircularProgress />
        </Box>
      ) : items.length === 0 ? (
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
          <Typography color="text.secondary">Nessun DDT aperto disponibile per questo fornitore</Typography>
        </Box>
      ) : (
        <Box sx={{ height: "100%", overflow: "hidden" }}>
          <Datagrid
            items={items}
            columnDefs={columnDefs}
            height="100%"
            loading={loading}
            rowSelection={rowSelection}
            onRowSelected={handleRowSelected}
            getRowId={({ data }) => data.ddtId.toString()}
            presentation
          />
        </Box>
      )}
    </AppDialog>
  );
}

export default PrelevaDdtDialog;
