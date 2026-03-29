import { useRef, useState, useEffect, useId } from "react";
import type { CustomCellEditorProps } from "ag-grid-react";
import IconFactory from "../../../icon/IconFactory";
import { iconMapping } from "../../../../layout/sideBar/iconMapping";
import TextField from "@mui/material/TextField";
import Autocomplete from "@mui/material/Autocomplete";
import FloatingPopper from "./FloatingPopper";

const iconNames = Object.keys(iconMapping);

const MenuIconEditor = (props: CustomCellEditorProps) => {
  const editorId = useId();
  const [value, setValue] = useState<string>(props.value);
  const [iconOptions, setIconOptions] = useState<string[]>(iconNames.filter((_, index) => index < 11));
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const anchorRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setTimeout(() => {
      inputRef.current?.focus();
    });
  }, []);

  useEffect(() => {
    if (props.value) {
      const filtered = iconNames.filter((iconName, index) => iconName.toLowerCase().startsWith(props.value.toLowerCase()) && index < 11);
      setIconOptions(filtered);
    }
  }, [props.value]);

  return (
    <div
      id={editorId}
      ref={(el) => {
        anchorRef.current = el;
      }}
    >
      <Autocomplete
        id="menu-editor-id"
        freeSolo
        options={iconOptions}
        value={value}
        inputValue={inputValue}
        onChange={(_, newValue) => {
          if (newValue) {
            setValue(newValue as string);
            props.onValueChange(newValue);
          }
        }}
        onInputChange={(_, newInput) => {
          setInputValue(newInput);
          if (newInput.length > 1) {
            const filtered = iconNames.filter((iconName, index) => iconName.toLowerCase().startsWith(newInput.toLowerCase()) && index < 11);
            setIconOptions(filtered);
          } else {
            setIconOptions([]);
          }
        }}
        renderOption={(props, option) => {
          const { key, ...rest } = props;
          return (
            <li
              key={key}
              {...rest}
              style={{ display: "flex", alignItems: "center" }}
            >
              {option && <IconFactory name={option} />}
              <span style={{ marginLeft: 8 }}>{option}</span>
            </li>
          );
        }}
        renderInput={(params) => {
          const inputProps = {
            ...params,
            inputProps: {
              ...params.inputProps,
              sx: { marginX: 1 },
            },
          };
          return <TextField
            {...inputProps}
            inputRef={inputRef}
            variant="standard"
            placeholder="Icona"
          />;
        }}
      />
      <FloatingPopper
        anchorEl="#menu-editor-id"
        open
      >
        FloatingPopper
      </FloatingPopper>
    </div>
  );
};

export default MenuIconEditor;
