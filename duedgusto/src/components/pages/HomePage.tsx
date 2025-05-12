import React, { useId, useRef, useState } from "react";
import { Autocomplete, Box, TextField } from "@mui/material";
import * as MuiIcons from "@mui/icons-material";
import IconFactory, { IconName } from "../common/icon/IconFactory";
import FloatingPopper from "../common/datagrid/cellEditors/menuIcon/FloatingPopper";

const iconNames = Object.keys(MuiIcons) as IconName[];

const HomePage: React.FC = () => {
  const editorId = useId();
  const [value, setValue] = useState<IconName | "">("");
  const [iconOptions, setIconOptions] = useState<IconName[]>([]);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const anchorRef = useRef<HTMLElement | null>(null);

  return (
    <div>
      <h1>HomePage</h1>
      <Box sx={{ marginLeft: 2, width: 300 }}>
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
              if (newValue) setValue(newValue as IconName);
            }}
            onInputChange={(_, newInput) => {
              setInputValue(newInput);
              if (newInput.length > 2) {
                const filtered = iconNames.filter((iconName) => iconName.toLowerCase().startsWith(newInput.toLowerCase()));
                setIconOptions(filtered);
              } else {
                setIconOptions([]);
              }
            }}
            renderOption={(props, option) => {
              const { key, ...rest } = props;
              return (
                <li key={key} {...rest} style={{ display: "flex", alignItems: "center" }}>
                  {option && <IconFactory name={option} />}
                  <span style={{ marginLeft: 8 }}>{option}</span>
                </li>
              );
            }}
            renderInput={(params) => <TextField {...params} inputRef={inputRef} variant="standard" placeholder="Icon name" />}
            slots={{
              popper: (popperProps) => {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { disablePortal, ...paperProps } = popperProps;
                return <FloatingPopper {...paperProps} target={anchorRef.current} />;
              },
            }}
          />
        </div>
      </Box>
    </div>
  );
};

export default HomePage;
