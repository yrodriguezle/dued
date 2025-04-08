/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import TextField from "@mui/material/TextField";
import { GridReadyEvent, RowClickedEvent } from "ag-grid-community";

import { SearchboxOptions } from "../../../../@types/searchbox";
import useSearchboxQueryParams from "./useSearchboxQueryParams";
import useFetchData from "../../../../graphql/common/useFetchData";
import GridResults from "./GridResults";

interface BaseSearchboxProps<T> {
  id?: string;
  value: string;
  orderBy?: string;
  options: SearchboxOptions<T>;
}

interface SearchboxPropsWithFieldName<T> extends BaseSearchboxProps<T> {
  fieldName: keyof T;
  name?: string;
}

interface SearchboxPropsWithoutFieldName<T> extends BaseSearchboxProps<T> {
  fieldName?: undefined;
  name: keyof T;
}

type SearchboxProps<T> = SearchboxPropsWithFieldName<T> | SearchboxPropsWithoutFieldName<T>;

function Searchbox<T>({ id, name, value, orderBy, fieldName, options }: SearchboxProps<T>) {
  const [innerValue, setInnerValue] = useState(value);
  const [resultsVisible, setResultsVisible] = useState(false);
  const [selection, setSelection] = useState<T | null>(null);

  // Calcola il campo di lookup:
  const lookupFieldName = useMemo<keyof T>(() => {
    if (fieldName !== undefined) {
      return fieldName;
    }
    return name as keyof T;
  }, [fieldName, name]);

  // Genera un ID univoco per il searchbox
  const searchBoxId = useMemo(() => id || `${options.query}-${String(name || fieldName)}-searchbox`, [fieldName, id, name, options.query]);

  // Genera query e variabili dai dati passati via options
  const { query, variables } = useSearchboxQueryParams({
    options,
    value: innerValue,
    fieldName: lookupFieldName,
    orderBy,
  });

  // Recupera i dati con useFetchData
  const { hasMore, totalCount, items, cursor, fetchItems, subscribeToMore, loading } = useFetchData({
    query,
    variables,
  });

  // Callback quando la griglia è pronta
  const onGridReady = useCallback((params: GridReadyEvent) => {
    // Puoi salvare l'API della griglia se necessario:
    // setGridApi(params.api);
  }, []);

  // Gestione del click sulla riga
  const onRowClicked = useCallback(
    (event: RowClickedEvent) => {
      const selectedData: T = event.data;
      // Ad esempio, aggiorna l'input con il valore del campo di ricerca
      setInnerValue(String(selectedData[lookupFieldName]));
      setSelection(selectedData);
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

  // Aggiorna l'innerValue se il prop value cambia
  useEffect(() => {
    setInnerValue(value || "");
  }, [value]);

  return (
    <div style={{ position: "relative" }}>
      <TextField
        id={searchBoxId}
        label="Cerca"
        size="small"
        value={innerValue}
        onChange={handleInputChange}
        variant="outlined"
        fullWidth
        inputRef={inputRef}
      />
      {resultsVisible && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            maxHeight: 300,
            overflowY: "auto",
            zIndex: 10,
            backgroundColor: "#fff",
            border: "1px solid #ccc",
            marginTop: 4,
          }}
        >
          <GridResults<T> loading={loading} items={items} columnDefs={options.items} onGridReady={onGridReady} onRowClicked={onRowClicked} />
        </div>
      )}
    </div>
  );
}

export default Searchbox;
