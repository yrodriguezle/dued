import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import TextField, { TextFieldProps } from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CircularProgress from '@mui/material/CircularProgress';
import { GridReadyEvent } from "ag-grid-community";

import { SearchboxOptions } from "../../../../@types/searchbox";
import useSearchboxQueryParams from "./useSearchboxQueryParams";
import useFetchData from "../../../../graphql/common/useFetchData";
import ContainerGridResults from "./ContainerGridResults";
import SearchboxModal from "./SearchboxModal";

export interface SearchboxProps<T extends Record<string, unknown>> extends Omit<TextFieldProps<"standard">, "onChange"> {
  id?: string;
  options: SearchboxOptions<T>;
  fieldName?: Extract<keyof T, string>;
  name: string;
  value: string;
  orderBy?: string;
  onChange?: (name: string, value: string) => void;
  onSelectItem: (item: T) => void;
}

function Searchbox<T extends Record<string, unknown>>({ id, name, value, orderBy, fieldName, options, onChange, onSelectItem, ...props }: SearchboxProps<T>) {
  const [innerValue, setInnerValue] = useState(value);
  const [resultsVisible, setResultsVisible] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const resultListRef = useRef<GridReadyEvent<T>>(null);

  const lookupFieldName = useMemo<Extract<keyof T, string>>(() => {
    return fieldName || (name as Extract<keyof T, string>);
  }, [fieldName, name]);

  const searchBoxId = useMemo(() => id || `${options.query}-${String(name || fieldName)}-searchbox`, [fieldName, id, name, options.query]);

  const { query, variables } = useSearchboxQueryParams({
    options,
    value: innerValue,
    fieldName: lookupFieldName,
    orderBy,
  });

  const {
    items,
    loading,
  } = useFetchData({
    query,
    variables,
    skip: innerValue.trim().length === 0,
  });

  // Modal query - loads all items
  const { query: modalQuery, variables: modalVariables } = useSearchboxQueryParams({
    options,
    value: "",
    fieldName: lookupFieldName,
    orderBy,
    modal: true,
    pageSize: 100,
  });

  const {
    items: modalItems,
    loading: modalLoading,
  } = useFetchData({
    query: modalQuery,
    variables: modalVariables,
    skip: !modalOpen,
  });

  const handleResultGridReady = useCallback(
    (event: GridReadyEvent<T>) => {
      resultListRef.current = event;
    },
    [resultListRef]
  );

  const handleSelectedItem = useCallback(
    (item: T) => {
      if (onChange && item && item[lookupFieldName]) {
        onChange(name, item[lookupFieldName] as string);
      }
      setInnerValue(String(item[lookupFieldName]));
      onSelectItem(item);
      setResultsVisible(false);
    },
    [lookupFieldName, name, onChange, onSelectItem]
  );

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;
    setInnerValue(newValue);
    if (onChange) {
      onChange(name, newValue);
    }
    setResultsVisible(newValue.trim().length > 0);
  };

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (resultsVisible && event.key === "ArrowDown" && resultListRef.current?.api.isDestroyed() === false) {
        event.preventDefault();
        resultListRef.current.api.deselectAll();
        const node = resultListRef.current.api.getDisplayedRowAtIndex(0);
        node?.setSelected(true);
      }
      if (event.key === "Escape" || event.key === "Tab") {
        setResultsVisible((prev) => {
          if (prev && event.key === "Escape") {
            event.stopPropagation();
          }
          return false;
        });
      }
      if (event.key === "Enter" || event.key === "Tab") {
        if (innerValue && items?.length) {
          const item = items.find((i) => String(i[lookupFieldName]).toLowerCase() === innerValue.toLowerCase());
          if (!item) return;
          handleSelectedItem(item);
        }
        inputRef.current?.focus();
      }
      props.onKeyDown?.(event);
    },
    [handleSelectedItem, innerValue, items, lookupFieldName, props, resultsVisible]
  );

  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setResultsVisible(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setInnerValue(value || "");
  }, [value]);

  const handleOpenModal = useCallback(() => {
    setModalOpen(true);
    setResultsVisible(false);
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalOpen(false);
  }, []);

  const handleModalSelectItem = useCallback(
    (item: T) => {
      handleSelectedItem(item);
      setModalOpen(false);
    },
    [handleSelectedItem]
  );

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <TextField
        inputRef={inputRef}
        id={searchBoxId}
        size="small"
        margin="dense"
        value={innerValue}
        name={name}
        variant="outlined"
        fullWidth
        autoComplete="off"
        {...props}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        slotProps={{
          input: {
            endAdornment: (
              <InputAdornment position="end">
                {loading ? (
                  <CircularProgress size={20} />
                ) : (
                  <IconButton
                    tabIndex={-1}
                    edge="end"
                    disabled={props.disabled}
                    onClick={handleOpenModal}
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    <ExpandMoreIcon />
                  </IconButton>
                )}
              </InputAdornment>
            ),
          },
          inputLabel: {
            shrink: !!innerValue,
          },
        }}
      />
      {resultsVisible && (
        <>
          {!loading && innerValue.trim().length > 2 && (!items || items.length === 0) ? (
            <Paper
              elevation={8}
              sx={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                marginTop: "-6px",
                zIndex: 10,
                p: 2,
                textAlign: "center",
              }}
            >
              <Typography variant="body2" color="text.secondary">
                Nessun risultato trovato
              </Typography>
            </Paper>
          ) : (
            <ContainerGridResults<T>
              searchBoxId={searchBoxId}
              loading={loading}
              items={items}
              columnDefs={options.items}
              onGridReady={handleResultGridReady}
              onSelectedItem={handleSelectedItem}
            />
          )}
        </>
      )}
      <SearchboxModal<T>
        open={modalOpen}
        title={options.modal.title}
        items={modalItems || []}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        columnDefs={options.modal.items as any}
        loading={modalLoading}
        onClose={handleCloseModal}
        onSelectItem={handleModalSelectItem}
      />
    </div>
  );
}

export default Searchbox;
