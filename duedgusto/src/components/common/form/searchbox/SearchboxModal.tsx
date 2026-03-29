import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { Modal, Box, Typography, IconButton, Button, Stack, Dialog, DialogTitle } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import CheckIcon from "@mui/icons-material/Check";
import AddIcon from "@mui/icons-material/Add";
import { RowSelectionOptions } from "ag-grid-community";

import Datagrid from "../../datagrid/Datagrid";
import { DatagridColDef, DatagridCellFocusedEvent, DatagridRowDoubleClickedEvent, DatagridRowClickedEvent } from "../../datagrid/@types/Datagrid";
import { SearchboxColDef } from "../../../../@types/searchbox";

interface SearchboxModalProps<T extends Record<string, unknown>> {
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
  preSelectedItem?: T | null;
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

function SearchboxModal<T extends Record<string, unknown>>({ open, title, items, columnDefs, loading, onClose, onSelectItem, renderCreateForm, createFormTitle, onItemCreated, preSelectedItem }: SearchboxModalProps<T>) {
  const [selectedItem, setSelectedItem] = useState<T | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // Auto-select item received from parent (e.g., after inline creation)
  useEffect(() => {
    if (preSelectedItem) {
      setSelectedItem(preSelectedItem);
    }
  }, [preSelectedItem]);

  const rowSelection = useMemo<RowSelectionOptions>(() => ({
    mode: "singleRow",
    checkboxes: false,
    enableClickSelection: true,
  }), []);

  const datagridColumnDefs = useMemo<DatagridColDef<T>[]>(
    () =>
      columnDefs.map((col) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { graphField: _g, action: _a, ...rest } = col;
        return rest as unknown as DatagridColDef<T>;
      }),
    [columnDefs]
  );

  const extractOriginalData = useCallback((data: Record<string, unknown>): T => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { status, ...originalData } = data;
    return originalData as unknown as T;
  }, []);

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
            p: 2,
            borderBottom: 1,
            borderColor: "divider",
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
          >
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Content - Datagrid */}
        <Box sx={{ flex: 1, p: 2, overflow: "hidden" }}>
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
      <Dialog
        open={createDialogOpen}
        onClose={handleCloseCreateDialog}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          {createFormTitle || "Nuovo record"}
          <IconButton
            onClick={handleCloseCreateDialog}
            size="small"
            sx={{ position: "absolute", right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        {createDialogOpen && renderCreateForm({ onSaved: handleItemCreated, onCancel: handleCloseCreateDialog })}
      </Dialog>
    )}
    </>
  );
}

export default SearchboxModal;
