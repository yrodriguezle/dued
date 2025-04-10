import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import TextField, { TextFieldProps } from "@mui/material/TextField";
import { RowClickedEvent } from "ag-grid-community";

import { SearchboxOptions } from "../../../../@types/searchbox";
import useSearchboxQueryParams from "./useSearchboxQueryParams";
import useFetchData from "../../../../graphql/common/useFetchData";
import ContainerGridResults from "./ContainerGridResults";

export interface SearchboxProps<T> extends Omit<TextFieldProps<"standard">, "onChange"> {
  id?: string;
  options: SearchboxOptions<T>;
  fieldName?: Extract<keyof T, string>;
  name: string;
  value: string;
  orderBy?: string;
  onChange?: (name: string, value: string) => void;
}

function Searchbox<T>({ id, name, value, orderBy, fieldName, options, ...props }: SearchboxProps<T>) {
  const [innerValue, setInnerValue] = useState(value);
  const [resultsVisible, setResultsVisible] = useState(false);
  // const [selection, setSelection] = useState<T | null>(null);

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

  // Gestione del click sulla riga
  const onRowClicked = useCallback(
    (event: RowClickedEvent) => {
      const selectedData: T = event.data;
      // Ad esempio, aggiorna l'input con il valore del campo di ricerca
      setInnerValue(String(selectedData[lookupFieldName]));
      // setSelection(selectedData);
      setResultsVisible(false);
    },
    [lookupFieldName]
  );

  // Gestione del cambiamento dell'input
  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;
    setInnerValue(newValue);
    setResultsVisible(newValue.trim().length > 0);
  };

  // Nascondi i risultati cliccando fuori dall'input
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(event.target as Node)) {
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
    <div style={{ position: "relative" }}>
      <TextField id={searchBoxId} size="small" margin="dense" value={innerValue} variant="outlined" fullWidth inputRef={inputRef} {...props} onChange={handleInputChange} />
      {resultsVisible && <ContainerGridResults<T> searchBoxId={searchBoxId} loading={loading} items={items} columnDefs={options.items} onRowClicked={onRowClicked} />}
    </div>
  );
}

export default Searchbox;
