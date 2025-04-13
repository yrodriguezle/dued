import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import TextField, { TextFieldProps } from "@mui/material/TextField";

import { SearchboxOptions } from "../../../../@types/searchbox";
import useSearchboxQueryParams from "./useSearchboxQueryParams";
import useFetchData from "../../../../graphql/common/useFetchData";
import ContainerGridResults from "./ContainerGridResults";
import { GridReadyEvent } from "ag-grid-community";

export interface SearchboxProps<T> extends Omit<TextFieldProps<"standard">, "onChange"> {
  id?: string;
  options: SearchboxOptions<T>;
  fieldName?: Extract<keyof T, string>;
  name: string;
  value: string;
  orderBy?: string;
  onChange?: (name: string, value: string) => void;
  onSelectItem: (item: T) => void;
}

function Searchbox<T>({ id, name, value, orderBy, fieldName, options, onChange, onSelectItem, ...props }: SearchboxProps<T>) {
  const [innerValue, setInnerValue] = useState(value);
  const [resultsVisible, setResultsVisible] = useState(false);
  // const [selection, setSelection] = useState<T | null>(null);

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
    // hasMore,
    // totalCount,
    items,
    // cursor,
    // fetchItems,
    // subscribeToMore,
    loading,
  } = useFetchData({
    query,
    variables,
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
        setResultsVisible((prevResultVisible) => {
          if (prevResultVisible && event.key === "Escape") {
            event.stopPropagation();
          }
          return false;
        });
      }
      if (event.key === "Enter") {
        if (innerValue && items?.length) {
          const item = items.find((item) => String(item[lookupFieldName]) === innerValue);
          if (!item) {
            return;
          }
          handleSelectedItem(item);
        }
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }
      if (props.onKeyDown) {
        props.onKeyDown(event);
      }
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
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    setInnerValue(value || "");
  }, [value]);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <TextField inputRef={inputRef} id={searchBoxId} size="small" margin="dense" value={innerValue} name={name} variant="outlined" fullWidth {...props} onChange={handleInputChange} onKeyDown={handleKeyDown} />
      {resultsVisible ? (
        <ContainerGridResults<T> searchBoxId={searchBoxId} loading={loading} items={items} columnDefs={options.items} onGridReady={handleResultGridReady} onSelectedItem={handleSelectedItem} />
      ) : null}
    </div>
  );
}

export default Searchbox;
