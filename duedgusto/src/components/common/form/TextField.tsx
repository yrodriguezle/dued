import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  FocusEventHandler,
  ChangeEventHandler,
} from 'react';
import MTextField, { TextFieldProps as MTextFieldProps } from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import { useTheme } from '@mui/material/styles';
import { EyeTwoTone, EyeInvisibleTwoTone } from '@ant-design/icons';
import { blueGrey } from '@mui/material/colors';


export interface TextFieldProps extends Omit<MTextFieldProps<'standard'>, 'onChange'> {
  value?: string;
  name: string;
  textUpperCase?: boolean;
  type?: string;
  autoFocus?: boolean;
  error?: boolean;
  onChange?: (name: string, value: string) => void;
  onFocus?: FocusEventHandler<HTMLInputElement>;
  onBlur?: FocusEventHandler<HTMLInputElement>;
}

export interface TextFieldRef {
  focus: () => void;
  isCancelBeforeStart: () => void;
  getValue: () => string;
}

const handleMouseDownPassword = (event: React.MouseEvent<HTMLButtonElement>) => {
  event.preventDefault();
};

const TextField = forwardRef<TextFieldRef, TextFieldProps>(
  ({
    value = '',
    name,
    textUpperCase,
    onChange,
    ...props
  }, ref) => {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const caretSelection = useRef<{ start: number; end: number } | null>(null);
    const [innerValue, setInnerValue] = useState<string>(value);
    const [focused, setFocus] = useState<boolean>(!!props.autoFocus);
    const [showPassword, setShowPassword] = useState<boolean>(false);
    const theme = useTheme();

    const handleClickShowPassword = useCallback(
      () => setShowPassword((prev) => !prev),
      [],
    );

    useEffect(() => {
      return () => {
        caretSelection.current = null;
      };
    }, []);

    useEffect(() => {
      setInnerValue(value);
    }, [value]);

    const handleChange: ChangeEventHandler<HTMLInputElement> = useCallback(
      (event) => {
        let transformedValue = event.target.value;
        if (textUpperCase) {
          transformedValue = transformedValue.toUpperCase();
        }
        if (onChange && typeof onChange === 'function') {
          onChange(name, transformedValue);
        } else {
          setInnerValue(transformedValue);
        }
        caretSelection.current = {
          start: event.target.selectionStart || 0,
          end: event.target.selectionEnd || 0,
        };
      },
      [name, onChange, textUpperCase],
    );

    const handleFocus: FocusEventHandler<HTMLInputElement> = useCallback(
      (event) => {
        setFocus(true);
        if (props.onFocus) {
          props.onFocus(event);
        }
      },
      [props],
    );

    const handleBlur: FocusEventHandler<HTMLInputElement> = useCallback(
      (event) => {
        setFocus(false);
        if (props.onBlur) {
          props.onBlur(event);
        }
      },
      [props],
    );

    useImperativeHandle(
      ref,
      () => ({
        focus: () => {
          if (inputRef.current) {
            inputRef.current.focus();
          }
        },
        isCancelBeforeStart: () => {
          setTimeout(() => {
            if (inputRef.current) {
              inputRef.current.focus();
            }
          }, 0);
        },
        getValue: () => innerValue,
      }),
      [innerValue],
    );

    const inputType = useMemo(() => {
      if (props.type === 'password') {
        return showPassword ? 'text' : 'password';
      }
      return props.type || 'text';
    }, [props.type, showPassword]);

    return (
      <MTextField
        inputRef={inputRef}
        size="small"
        name={name}
        value={innerValue}
        onChange={handleChange}
        spellCheck={false}
        slotProps={{
          input: {
            endAdornment: props.type === 'password' ? (
              <InputAdornment position="end">
                <IconButton
                  aria-label="toggle password visibility"
                  onClick={handleClickShowPassword}
                  onMouseDown={handleMouseDownPassword}
                >
                  {showPassword ? (
                    <EyeInvisibleTwoTone twoToneColor={props.error ? theme.palette.error.main : blueGrey[500]} />
                  ) : (
                    <EyeTwoTone twoToneColor={props.error ? theme.palette.error.main : blueGrey[500]} />
                  )}
                </IconButton>
              </InputAdornment>
            ) : undefined,
          },
          inputLabel: {
            shrink: !!innerValue || focused
          }
        }}
        {...props}
        onFocus={handleFocus}
        onBlur={handleBlur}
        type={inputType}
      />
    );
  }
);

export default TextField;
