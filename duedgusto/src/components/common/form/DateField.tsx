import { forwardRef, useCallback, useImperativeHandle, useRef, useState, FocusEventHandler, ChangeEventHandler } from "react";
import MTextField, { TextFieldProps as MTextFieldProps } from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";

export interface DateFieldProps extends Omit<MTextFieldProps<"standard">, "onChange" | "type"> {
  value?: string;
  name: string;
  onChange?: (name: string, value: string) => void;
  onFocus?: FocusEventHandler<HTMLInputElement>;
  onBlur?: FocusEventHandler<HTMLInputElement>;
}

export interface DateFieldRef {
  focus: () => void;
  getValue: () => string;
}

const handleMouseDown = (event: React.MouseEvent<HTMLButtonElement>) => {
  event.preventDefault();
};

const DateField = forwardRef<DateFieldRef, DateFieldProps>(({ value = "", name, onChange, sx, slotProps, ...props }, ref) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [innerValue, setInnerValue] = useState<string>(value);
  const [focused, setFocus] = useState<boolean>(!!props.autoFocus);
  const lastExternalValue = useRef<string>(value);

  // Sincronizza solo quando il valore esterno cambia realmente (non durante l'editing)
  if (value !== lastExternalValue.current) {
    lastExternalValue.current = value;
    if (!focused) {
      setInnerValue(value);
    }
  }

  const handleChange: ChangeEventHandler<HTMLInputElement> = useCallback(
    (event) => {
      const newValue = event.target.value;
      setInnerValue(newValue);
    },
    []
  );

  const handleFocus: FocusEventHandler<HTMLInputElement> = useCallback(
    (event) => {
      setFocus(true);
      if (props.onFocus) {
        props.onFocus(event);
      }
    },
    [props]
  );

  const handleBlur: FocusEventHandler<HTMLInputElement> = useCallback(
    (event) => {
      setFocus(false);
      // Sincronizza con Formik solo su blur
      if (onChange && innerValue !== lastExternalValue.current) {
        onChange(name, innerValue);
        lastExternalValue.current = innerValue;
      }
      if (props.onBlur) {
        props.onBlur(event);
      }
    },
    [onChange, name, innerValue, props]
  );

  const handleShowPicker = useCallback(() => {
    if (inputRef.current && typeof inputRef.current.showPicker === "function") {
      inputRef.current.showPicker();
    }
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      focus: () => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      },
      getValue: () => innerValue,
    }),
    [innerValue]
  );

  return (
    <MTextField
      inputRef={inputRef}
      size="small"
      name={name}
      value={innerValue}
      onChange={handleChange}
      spellCheck={false}
      slotProps={{
        ...slotProps,
        inputLabel: {
          shrink: !!innerValue || focused,
          ...slotProps?.inputLabel,
        },
        input: {
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                tabIndex={-1}
                disabled={props.disabled}
                onClick={handleShowPicker}
                onMouseDown={handleMouseDown}
                size="small"
                edge="end"
              >
                <CalendarMonthIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          ),
          ...slotProps?.input,
        },
      }}
      sx={[
        { "& input::-webkit-calendar-picker-indicator": { display: "none" } },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
      {...props}
      onFocus={handleFocus}
      onBlur={handleBlur}
      type="date"
    />
  );
});

export default DateField;
