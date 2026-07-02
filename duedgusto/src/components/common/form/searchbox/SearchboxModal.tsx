import { ReactNode, useCallback, useMemo, useState } from "react";
import { Modal, Box, Typography, IconButton, Button, Stack } from "@mui/material";
import AppDialog from "../../dialog/AppDialog";
import CloseIcon from "@mui/icons-material/Close";
import CheckIcon from "@mui/icons-material/Check";
import AddIcon from "@mui/icons-material/Add";
import { RowSelectionOptions } from "ag-grid-community";

import Datagrid from "../../datagrid/Datagrid";
import { DatagridColDef, DatagridData, DatagridCellFocusedEvent, DatagridRowDoubleClickedEvent, DatagridRowClickedEvent } from "../../datagrid/@types/Datagrid";
import { stripDatagridStatus } from "../../datagrid/datagridUtils";
import { toDatagridColDef } from "./searchboxUtils";
import { SearchboxColDef } from "../../../../@types/searchbox";

interface SearchboxModalProps<T extends object> {
  open: boolean;
  title: string;
  items: T[];
  columnDefs: SearchboxColDef<T>[];
  loading: boolean;
  onClose: () => void;
  onSelectItem: (item: T) => void;
  renderCreateForm?: (props: { onSaved: (item: T) => void; onCancel: () => void }) => ReactNode;
  createFormTitle?: string;
  onItemCreated?: (item: T) => void;
}

const modalStyle = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: { xs: "95%", sm: "90%", md: "80%", lg: "70%" },
  maxWidth: "1200px",
  height: { xs: "90%", sm: "80%", md: "70%" },
  bgcolor: "background.paper",
  borderRadius: "8px",
  boxShadow: 24,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

function SearchboxModal<T extends object>({ open, title, items, columnDefs, loading, onClose, onSelectItem, renderCreateForm, createFormTitle, onItemCreated }: SearchboxModalProps<T>) {
  const [selectedItem, setSelectedItem] = useState<T | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const rowSelection = useMemo<RowSelectionOptions>(() => ({
    mode: "singleRow",
    checkboxes: false,
    enableClickSelection: true,
  }), []);

  // Converte SearchboxColDef<T> in DatagridColDef<T> omettendo graphField/action (vedi searchboxUtils)
  const datagridColumnDefs = useMemo<DatagridColDef<T>[]>(() => columnDefs.map(toDatagridColDef), [columnDefs]);

  // Estrae i dati originali rimuovendo il campo status ausiliario
  const extractOriginalData = useCallback((data: DatagridData<T>): T => stripDatagridStatus(data), []);

  const handleConfirmSelection = useCallback(() => {
    if (selectedItem) {
      onSelectItem(selectedItem);
      onClose();
    }
  }, [selectedItem, onSelectItem, onClose]);

  const handleRowDoubleClicked = useCallback(
    (event: DatagridRowDoubleClickedEvent<T>) => {
      if (event.data) {
        onSelectItem(extractOriginalData(event.data));
        onClose();
      }
    },
    [onSelectItem, onClose, extractOriginalData]
  );

  const handleRowClicked = useCallback(
    (event: DatagridRowClickedEvent<T>) => {
      if (event.data) {
        setSelectedItem(extractOriginalData(event.data));
      }
    },
    [extractOriginalData]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Enter") {
        event.preventDefault();
        handleConfirmSelection();
      } else if (event.key === "Escape") {
        onClose();
      }
    },
    [handleConfirmSelection, onClose]
  );

  const handleCellFocused = useCallback(
    (params: DatagridCellFocusedEvent<T>) => {
      if (params.rowIndex !== null && params.rowIndex !== undefined) {
        const node = params.api.getDisplayedRowAtIndex(params.rowIndex);
        if (node) {
          node.setSelected(true);
          if (node.data) {
            setSelectedItem(extractOriginalData(node.data));
          }
        }
      }
    },
    [extractOriginalData]
  );

  const handleOpenCreateDialog = useCallback(() => {
    setCreateDialogOpen(true);
  }, []);

  const handleCloseCreateDialog = useCallback(() => {
    setCreateDialogOpen(false);
  }, []);

  const handleItemCreated = useCallback(
    (item: T) => {
      setCreateDialogOpen(false);
      onItemCreated?.(item);
    },
    [onItemCreated]
  );

  return (
    <>
    <Modal
      open={open}
      onClose={onClose}
      aria-labelledby="searchbox-modal-title"
      onKeyDown={handleKeyDown}
    >
      <Box sx={modalStyle}>
        {/* Header */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            p: 1,
            paddingLeft: 2,
            borderBottom: 1,
            borderColor: "divider",
            bgcolor: "action.hover",
          }}
        >
          <Typography
            id="searchbox-modal-title"
            variant="h6"
            component="h2"
          >
            {title}
          </Typography>
          <IconButton
            onClick={onClose}
            size="small"
            aria-label="Chiudi finestra"
          >
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Content - Datagrid */}
        <Box sx={{ flex: 1, p: 2, overflow: "hidden", bgcolor: "action.hover" }}>
          <Datagrid
            items={items || []}
            columnDefs={datagridColumnDefs}
            height="100%"
            loading={loading}
            rowSelection={rowSelection}
            onRowDoubleClicked={handleRowDoubleClicked}
            onRowClicked={handleRowClicked}
            onCellFocused={handleCellFocused}
            presentation
          />
        </Box>

        {/* Footer */}
        <Box
          sx={{
            px: 2,
            py: 1.5,
            borderTop: 1,
            borderColor: "divider",
            bgcolor: "action.hover",
          }}
        >
          <Stack
            direction="row"
            spacing={1}
            justifyContent="space-between"
            alignItems="center"
          >
            <Box>
              {renderCreateForm && (
                <Button
                  variant="text"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={handleOpenCreateDialog}
                >
                  Aggiungi
                </Button>
              )}
            </Box>
            <Stack
              direction="row"
              spacing={1}
            >
              <Button
                variant="outlined"
                size="small"
                onClick={onClose}
              >
                Annulla
              </Button>
              <Button
                variant="contained"
                size="small"
                disabled={!selectedItem}
                startIcon={<CheckIcon />}
                onClick={handleConfirmSelection}
              >
                Seleziona
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Box>
    </Modal>

    {/* Dialog annidato per creazione nuovo record */}
    {renderCreateForm && (
      <AppDialog
        open={createDialogOpen}
        onClose={handleCloseCreateDialog}
        title={createFormTitle || "Nuovo record"}
        maxWidth="900px"
        width={{ xs: "95%", sm: "90%", md: "900px" }}
      >
        {createDialogOpen && renderCreateForm({ onSaved: handleItemCreated, onCancel: handleCloseCreateDialog })}
      </AppDialog>
    )}
    </>
  );
}

export default SearchboxModal;
