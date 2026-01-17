import { useCallback, useState } from "react";
import { Modal, Box, Typography, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

import Datagrid from "../../datagrid/Datagrid";
import {
  DatagridColDef,
  DatagridGridReadyEvent,
  DatagridCellFocusedEvent,
  DatagridRowDoubleClickedEvent,
} from "../../datagrid/@types/Datagrid";

interface SearchboxModalProps<T> {
  open: boolean;
  title: string;
  items: T[];
  columnDefs: DatagridColDef<T>[];
  loading: boolean;
  onClose: () => void;
  onSelectItem: (item: T) => void;
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

function SearchboxModal<T extends Record<string, unknown>>({
  open,
  title,
  items,
  columnDefs,
  loading,
  onClose,
  onSelectItem,
}: SearchboxModalProps<T>) {
  const [gridReady, setGridReady] = useState<DatagridGridReadyEvent<T> | null>(null);

  const handleGridReady = useCallback((event: DatagridGridReadyEvent<T>) => {
    setGridReady(event);
  }, []);

  const handleRowDoubleClicked = useCallback(
    (event: DatagridRowDoubleClickedEvent<T>) => {
      const data = event.data;
      if (data) {
        // Estrai i dati originali rimuovendo i campi ausiliari
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { status, ...originalData } = data;
        onSelectItem(originalData as T);
        onClose();
      }
    },
    [onSelectItem, onClose]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Enter" && gridReady) {
        const selectedRows = gridReady.api.getSelectedRows();
        if (selectedRows.length > 0) {
          // Estrai i dati originali rimuovendo i campi ausiliari
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { status, ...originalData } = selectedRows[0];
          onSelectItem(originalData as T);
          onClose();
        }
      } else if (event.key === "Escape") {
        onClose();
      }
    },
    [gridReady, onSelectItem, onClose]
  );

  const handleCellFocused = useCallback((params: DatagridCellFocusedEvent<T>) => {
    if (params.rowIndex !== null && params.rowIndex !== undefined) {
      const node = params.api.getDisplayedRowAtIndex(params.rowIndex);
      if (node) {
        node.setSelected(true);
      }
    }
  }, []);

  return (
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
          <Typography id="searchbox-modal-title" variant="h6" component="h2">
            {title}
          </Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Content - Datagrid */}
        <Box sx={{ flex: 1, p: 2, overflow: "hidden" }}>
          <Datagrid
            items={items || []}
            columnDefs={columnDefs}
            height="100%"
            loading={loading}
            onGridReady={handleGridReady}
            onRowDoubleClicked={handleRowDoubleClicked}
            onCellFocused={handleCellFocused}
            presentation
          />
        </Box>

        {/* Footer with hint */}
        <Box
          sx={{
            p: 2,
            borderTop: 1,
            borderColor: "divider",
            bgcolor: "action.hover",
          }}
        >
          <Typography variant="caption" color="text.secondary">
            Doppio click su una riga o premi Invio per selezionare
          </Typography>
        </Box>
      </Box>
    </Modal>
  );
}

export default SearchboxModal;
