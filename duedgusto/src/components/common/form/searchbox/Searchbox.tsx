import { useState } from "react";
import { SearchboxOptions } from "../../../../@types/searchbox";

interface SearchboxProps<T> {
  value: string;
  fieldName?: string;
  options: SearchboxOptions<T>;
}

function Searchbox<T>({ value, fieldName }: SearchboxProps<T>) {
  const [innerValue, setInnerValue] = useState(value);
  const lookupFieldName = fieldName || value;

  return <div>Searchbox</div>;
}

export default Searchbox;
