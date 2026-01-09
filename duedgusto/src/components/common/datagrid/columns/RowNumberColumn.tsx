import { ICellRendererParams } from "ag-grid-community";
import Edit from "@mui/icons-material/Edit";
import Error from "@mui/icons-material/Error";
import Box from "@mui/material/Box";
import { DatagridStatus } from "../../../../common/globals/constants";
import { DatagridData } from "../@types/Datagrid";

function RowNumberCellRenderer<T extends Record<string, unknown>>(props: ICellRendererParams<DatagridData<T>>) {
  const { data, node } = props;

  if (node.rowPinned) {
    return null;
  }

  const rowNumber = (node.rowIndex ?? 0) + 1;

  if (data?.status === DatagridStatus.Editing) {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
        }}
      >
        <Edit sx={{ fontSize: 16, color: "primary.main" }} aria-label="Riga in editing" />
      </Box>
    );
  }

  if (data?.status === DatagridStatus.Invalid) {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
        }}
      >
        <Error sx={{ fontSize: 16, color: "error.main" }} aria-label="Errore di validazione" />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
      }}
    >
      {rowNumber}
    </Box>
  );
}

export default RowNumberCellRenderer;
