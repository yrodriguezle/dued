import { useEffect, useMemo, useRef } from "react";
import { useTheme } from "@mui/material";
import Paper from "@mui/material/Paper";

import useResizeObserver from "../../../../common/resizer/useResizeObserver";
import { getSearchboxResultContainerWidth, setSearchboxResultContainerWidth } from "../../../../common/ui/searchboxResultContainer";
import GridResults, { GridResultsProps } from "./GridResults";

interface ContainerGridResultsProps<T> extends GridResultsProps<T> {
  searchBoxId: string;
}

function ContainerGridResults<T>({ searchBoxId, loading, items, columnDefs, onRowClicked }: ContainerGridResultsProps<T>) {
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const theme = useTheme();

  const width = useMemo(() => getSearchboxResultContainerWidth(searchBoxId), [searchBoxId]);
  const minWidth = useMemo(() => (window as Global).SEARCHBOX_CONTAINER_MIN_WIDTH || 500, []);

  const { ref, dimensions } = useResizeObserver();
  useEffect(() => {
    const debounced = setTimeout(() => {
      if (dimensions.width > minWidth && mounted.current) {
        setSearchboxResultContainerWidth(searchBoxId, dimensions.width);
      }
    }, 500);
    return () => clearTimeout(debounced);
  }, [dimensions.width, minWidth, searchBoxId]);

  return (
    <Paper
      ref={ref}
      elevation={8}
      style={{
        backgroundColor: theme.palette.grey[theme.palette.mode === "light" ? 100 : 900],
        marginTop: -6,
        minWidth,
        overflow: "auto",
        overflowY: "auto",
        position: "absolute",
        resize: "horizontal",
        width,
        zIndex: 10,
        left: 0,
        right: 0,
        top: "100%",
        // height: "20vh",
      }}
    >
      <GridResults<T> loading={loading} items={items} columnDefs={columnDefs} onRowClicked={onRowClicked} />
    </Paper>
  );
}

export default ContainerGridResults;
