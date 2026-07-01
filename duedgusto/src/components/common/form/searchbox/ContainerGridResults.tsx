import { useCallback, useEffect, useMemo, useRef } from "react";
import { useTheme } from "@mui/material";
import Paper from "@mui/material/Paper";
import Popper from "@mui/material/Popper";

import useResizeObserver from "../../../../common/resizer/useResizeObserver";
import { getSearchboxResultContainerWidth, setSearchboxResultContainerWidth } from "../../../../common/ui/searchboxResultContainer";
import GridResults, { GridResultsProps } from "./GridResults";

interface ContainerGridResultsProps<T extends Record<string, unknown>> extends GridResultsProps<T> {
  searchBoxId: string;
  anchorEl: HTMLElement | null;
  paperRef?: React.MutableRefObject<HTMLDivElement | null>;
}

function ContainerGridResults<T extends Record<string, unknown>>({ searchBoxId, anchorEl, paperRef, loading, items, columnDefs, onSelectedItem, onGridReady, onNavigateBack, showNoRowsOverlay }: ContainerGridResultsProps<T>) {
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const theme = useTheme();

  const persistedWidth = useMemo(() => getSearchboxResultContainerWidth(searchBoxId), [searchBoxId]);
  const minWidth = useMemo(() => (window as Global).SEARCHBOX_CONTAINER_MIN_WIDTH || 500, []);
  const anchorWidth = anchorEl?.clientWidth;

  const { ref: resizeRef, dimensions } = useResizeObserver();

  // Unisce il callback ref del ResizeObserver con il paperRef passato dal Searchbox (per il click-outside)
  const setPaperNode = useCallback(
    (node: HTMLDivElement | null) => {
      resizeRef(node);
      if (paperRef) {
        paperRef.current = node;
      }
    },
    [resizeRef, paperRef]
  );

  useEffect(() => {
    const debounced = setTimeout(() => {
      if (dimensions.width > minWidth && mounted.current) {
        setSearchboxResultContainerWidth(searchBoxId, dimensions.width);
      }
    }, 500);
    return () => clearTimeout(debounced);
  }, [dimensions.width, minWidth, searchBoxId]);

  return (
    <Popper
      open={Boolean(anchorEl)}
      anchorEl={anchorEl}
      placement="bottom-start"
      style={{ zIndex: theme.zIndex.modal + 1 }}
      modifiers={[
        { name: "offset", options: { offset: [0, -3] } },
        { name: "flip", enabled: true },
        { name: "preventOverflow", options: { boundary: "viewport", padding: 8 } },
      ]}
    >
      <Paper
        ref={setPaperNode}
        elevation={0}
        style={{
          backgroundColor: theme.palette.grey[theme.palette.mode === "light" ? 100 : 900],
          // Ombra solo lati/basso (offset Y positivo) — nessuna ombra sopra, si fonde con l'input.
          // Dark mode: più opaca perché su sfondo scuro rende meno.
          boxShadow: theme.palette.mode === "light" ? "0 6px 12px -2px rgba(0,0,0,0.35)" : "0 6px 14px -2px rgba(0,0,0,0.7)",
          minWidth,
          maxWidth: "95vw",
          overflow: "auto",
          resize: "horizontal",
          width: persistedWidth ?? anchorWidth,
          height: "30vh",
        }}
      >
        <GridResults<T>
          loading={loading}
          items={items}
          columnDefs={columnDefs}
          onSelectedItem={onSelectedItem}
          onGridReady={onGridReady}
          onNavigateBack={onNavigateBack}
          showNoRowsOverlay={showNoRowsOverlay}
        />
      </Paper>
    </Popper>
  );
}

export default ContainerGridResults;
