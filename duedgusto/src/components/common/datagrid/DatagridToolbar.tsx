import { RefObject, useEffect } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import ButtonGroup from "@mui/material/ButtonGroup";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";

import useStore from "../../../store/useStore";
import { themeDark, themeLight } from "./datagridThemes";
import { GridReadyEvent } from "ag-grid-community";

interface DatagridToolbarProps<T> {
  canAddNewRow: boolean;
  readOnly?: boolean;
  hasSelectedRow?: boolean;
  hideStandardButtons?: boolean;
  gridRef?: RefObject<GridReadyEvent<T> | null>;
  onAdd: () => void;
  onDelete: () => void;
  additionalButtons?: React.ReactNode;
}

interface Cache {
  _paramsCssCache: string;
  _cssClassCache: string;
}

const DatagridToolbar = <T,>({ canAddNewRow, readOnly, hasSelectedRow, hideStandardButtons, onAdd, onDelete, additionalButtons }: DatagridToolbarProps<T>) => {
  const { userTheme } = useStore((store) => store);
  const theme = (userTheme.mode === "light" ? themeLight : themeDark) as unknown as Cache;

  const styleId = "datagrid-toolbar-vars-style";
  const wrapperClass = `datagrid-toolbar-vars ${theme._cssClassCache}`;

  useEffect(() => {
    setTimeout(() => {
      const match = theme._paramsCssCache?.match(/\{([\s\S]*)\}/);
      const declarations = match ? match[1].trim() : "";

      let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
      if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = styleId;
        document.head.appendChild(styleEl);
      }
      styleEl.innerHTML = `.${"datagrid-toolbar-vars"} { ${declarations} }`;
    }, 0);
  }, [theme]);

  return (
    <Box className={wrapperClass}>
      <Box
        className="ag-header"
        sx={{
          height: 38,
          border: "var(--ag-header-row-border)",
          borderBottom: "unset",
          borderRadius: "4px 4px 0 0",
          paddingX: 1,
          display: "flex",
          alignItems: "center",
        }}
      >
        <Stack direction="row" spacing={1}>
          {!hideStandardButtons && (
            <ButtonGroup size="small" variant="text" aria-label="Datagrid toolbar">
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={onAdd}
                disabled={readOnly || !canAddNewRow}
                sx={{
                  minHeight: 0,
                  height: 32,
                  paddingY: 0.5,
                  paddingX: 1.5,
                  alignSelf: "center",
                }}
              >
                Nuova riga
              </Button>
              <Button
                size="small"
                startIcon={<RemoveIcon />}
                onClick={onDelete}
                disabled={readOnly || !hasSelectedRow}
                sx={{
                  minHeight: 0,
                  height: 32,
                  paddingY: 0.5,
                  paddingX: 1.5,
                  alignSelf: "center",
                }}
              >
                Cancella riga
              </Button>
            </ButtonGroup>
          )}
          {additionalButtons}
        </Stack>
      </Box>
    </Box>
  );
};

export default DatagridToolbar;
