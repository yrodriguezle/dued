import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import TextField, { TextFieldProps } from "@mui/material/TextField";

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
  onSelectItem: (item: T) => void;
}

function Searchbox<T>({
  id,
  name,
  value,
  orderBy,
  fieldName,
  options,
  onChange,
  onSelectItem,
  ...props
}: SearchboxProps<T>) {
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

  const handleSelectedItem = useCallback(
    (item: T) => {
      if (onChange && item && item[lookupFieldName]) {
        onChange(name, item[lookupFieldName] as string);
      }
      setInnerValue(String(item[lookupFieldName]));
      onSelectItem(item);
      setResultsVisible(false);
    },
    [],
  );

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;
    setInnerValue(newValue);
    setResultsVisible(newValue.trim().length > 0);
  };

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
      <TextField
        id={searchBoxId}
        size="small"
        margin="dense"
        value={innerValue}
        variant="outlined"
        fullWidth
        {...props}
        onChange={handleInputChange}
      />
      {resultsVisible ? (
        <ContainerGridResults<T> 
          searchBoxId={searchBoxId}
          loading={loading}
          items={items}
          columnDefs={options.items}
          onSelectedItem={handleSelectedItem}
        />
      ) : null}
    </div>
  );
}

export default Searchbox;
