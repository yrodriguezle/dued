import { useEffect, useMemo, useRef, useState } from "react";
import { SearchboxOptions } from "../../../../@types/searchbox";
import useSearchboxQueryParams from "./useSearchboxQueryParams";

interface SearchboxProps<T> {
  id?: string;
  value: string;
  orderBy?: string;
  options: SearchboxOptions<T>;
  name: string;
  fieldName?: string;
}

function Searchbox<T>({
  id,
  name,
  value,
  orderBy,
  fieldName,
  options,
}: SearchboxProps<T>) {
  const [innerValue, setInnerValue] = useState(value);
  const [resultsVisible, setResultsVisible] = useState(false);
  const [selection, setSelection] = useState(false);

  const lookupFieldName = fieldName || name;
  const searchBoxId = useMemo(() => id || `${options.query}-${name || fieldName}-searchbox`, [fieldName, id, name, options.query]);
  const { query, variables } = useSearchboxQueryParams({
    options,
    value: innerValue,
    fieldName: lookupFieldName,
    orderBy
  });

  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    setInnerValue(value || '');
  }, [value]);


  return <div>Searchbox</div>;
}

export default Searchbox;
