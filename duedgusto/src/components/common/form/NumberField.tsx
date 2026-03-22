import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, FocusEventHandler, ChangeEventHandler, KeyboardEventHandler } from "react";
import MTextField, { TextFieldProps as MTextFieldProps } from "@mui/material/TextField";

export interface NumberFieldProps extends Omit<MTextFieldProps<"standard">, "onChange" | "type" | "value"> {
  value?: number;
  name: string;
  thousandsSeparator?: boolean;
  decimals?: number;
  onChange?: (name: string, value: number) => void;
  onFocus?: FocusEventHandler<HTMLInputElement>;
  onBlur?: FocusEventHandler<HTMLInputElement>;
}

export interface NumberFieldRef {
  focus: () => void;
  getValue: () => number;
}

// Aggiunge i separatori delle migliaia (.) alla parte intera
const addThousandDots = (intStr: string): string => {
  const isNeg = intStr.startsWith("-");
  const digits = isNeg ? intStr.slice(1) : intStr;
  const formatted = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return isNeg ? "-" + formatted : formatted;
};

// Converte un numero JS in stringa formattata italiana (1234.56 → "1.234,56")
const numberToDisplay = (value: number, useThousands: boolean): string => {
  const str = String(value);
  const [intPart, decPart] = str.split(".");
  const formattedInt = useThousands ? addThousandDots(intPart) : intPart;
  return decPart !== undefined ? `${formattedInt},${decPart}` : formattedInt;
};

// Converte stringa formattata italiana in numero JS ("1.234,56" → 1234.56)
const displayToNumber = (display: string): number => {
  if (!display || display === "-") return 0;
  const normalized = display.replace(/\./g, "").replace(",", ".");
  const num = Number(normalized);
  return isNaN(num) ? 0 : num;
};

// Formatta una stringa "pulita" (senza migliaia) con i separatori
const formatCleaned = (cleaned: string, useThousands: boolean): string => {
  if (!cleaned || cleaned === "-") return cleaned;
  const [intPart, ...rest] = cleaned.split(",");
  const decPart = rest.length > 0 ? rest[0] : undefined;
  const formattedInt = useThousands ? addThousandDots(intPart || "0") : (intPart || "0");
  return decPart !== undefined ? `${formattedInt},${decPart}` : formattedInt;
};

// Trova la posizione del cursore nella stringa formattata dato il conteggio dei caratteri significativi
const findCursorPosition = (formatted: string, targetCount: number): number => {
  if (targetCount <= 0) return 0;
  return formatted.split("").reduce<{ count: number; pos: number; found: boolean }>(
    (acc, char, idx) => {
      if (acc.found) return acc;
      const newCount = acc.count + (char !== "." ? 1 : 0);
      return newCount >= targetCount
        ? { count: newCount, pos: idx + 1, found: true }
        : { count: newCount, pos: idx + 1, found: false };
    },
    { count: 0, pos: 0, found: false }
  ).pos;
};

const NumberField = forwardRef<NumberFieldRef, NumberFieldProps>(({
  value = 0, name, onChange, thousandsSeparator: useThousands = true, decimals, sx, slotProps, ...props
}, ref) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [innerValue, setInnerValue] = useState<string>(() => numberToDisplay(value, useThousands));
  const [focused, setFocus] = useState<boolean>(!!props.autoFocus);
  const pendingCursor = useRef<number | null>(null);

  // Sincronizza dal prop quando non in focus
  useEffect(() => {
    if (!focused) {
      setInnerValue(numberToDisplay(value, useThousands));
    }
  }, [value, focused, useThousands]);

  // Ripristina la posizione del cursore dopo il re-render
  useLayoutEffect(() => {
    if (pendingCursor.current !== null && inputRef.current) {
      inputRef.current.setSelectionRange(pendingCursor.current, pendingCursor.current);
      pendingCursor.current = null;
    }
  }, [innerValue]);

  const processAndFormat = useCallback((rawValue: string, cursorPos: number) => {
    // Conta i caratteri significativi (non-punto) prima del cursore
    const sigBefore = rawValue.slice(0, cursorPos).replace(/\./g, "").length;

    // Rimuovi separatori migliaia e caratteri non validi
    let cleaned = rawValue.replace(/\./g, "");
    cleaned = cleaned.replace(/[^\d,-]/g, "");

    // Nessun decimale se decimals === 0
    if (decimals === 0) {
      cleaned = cleaned.replace(/,/g, "");
    } else {
      // Solo una virgola
      const ci = cleaned.indexOf(",");
      if (ci !== -1) {
        let decPart = cleaned.slice(ci + 1).replace(/,/g, "");
        // Limita i decimali se specificato
        if (decimals !== undefined) {
          decPart = decPart.slice(0, decimals);
        }
        cleaned = cleaned.slice(0, ci + 1) + decPart;
      }
    }

    // Meno solo all'inizio
    if (cleaned.indexOf("-") > 0) {
      cleaned = cleaned.replace(/-/g, "");
    }

    const formatted = formatCleaned(cleaned, useThousands);
    setInnerValue(formatted);
    pendingCursor.current = findCursorPosition(formatted, sigBefore);
  }, [useThousands, decimals]);

  const handleChange: ChangeEventHandler<HTMLInputElement> = useCallback(
    (event) => {
      processAndFormat(event.target.value, event.target.selectionStart ?? event.target.value.length);
    },
    [processAndFormat]
  );

  // Intercetta "." e inserisce "," al suo posto
  const handleKeyDown: KeyboardEventHandler<HTMLInputElement> = useCallback(
    (event) => {
      if (event.key === ".") {
        event.preventDefault();
        if (decimals === 0 || innerValue.includes(",")) return;
        const input = event.target as HTMLInputElement;
        const start = input.selectionStart ?? innerValue.length;
        const end = input.selectionEnd ?? start;
        const newValue = innerValue.slice(0, start) + "," + innerValue.slice(end);
        processAndFormat(newValue, start + 1);
      }
    },
    [innerValue, decimals, processAndFormat]
  );

  const handleFocus: FocusEventHandler<HTMLInputElement> = useCallback(
    (event) => {
      setFocus(true);
      event.target.select();
      if (props.onFocus) {
        props.onFocus(event);
      }
    },
    [props]
  );

  const handleBlur: FocusEventHandler<HTMLInputElement> = useCallback(
    (event) => {
      setFocus(false);
      const numericValue = displayToNumber(innerValue);
      const formatted = numberToDisplay(numericValue, useThousands);
      setInnerValue(formatted);
      if (onChange) {
        onChange(name, numericValue);
      }
      if (props.onBlur) {
        props.onBlur(event);
      }
    },
    [onChange, name, innerValue, useThousands, props]
  );

  useImperativeHandle(
    ref,
    () => ({
      focus: () => inputRef.current?.focus(),
      getValue: () => displayToNumber(innerValue),
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
      onKeyDown={handleKeyDown}
      spellCheck={false}
      autoComplete="off"
      slotProps={{
        ...slotProps,
        inputLabel: {
          shrink: !!innerValue || focused,
          ...slotProps?.inputLabel,
        },
      }}
      sx={[
        { "& input": { textAlign: "right" } },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
      {...props}
      onFocus={handleFocus}
      onBlur={handleBlur}
      type="text"
      inputMode={decimals === 0 ? "numeric" : "decimal"}
    />
  );
});

export default NumberField;
