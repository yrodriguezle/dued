import React, {
  forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState,
} from 'react';
import MUITextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import { useTheme } from '@mui/material/styles';
import { EyeTwoTone, EyeInvisibleTwoTone } from '@ant-design/icons';
import { blueGrey } from '@mui/material/colors';

const handleMouseDownPassword = (event) => {
  event.preventDefault();
};

function TextField({
  value,
  name,
  textUpperCase,
  onChange,
  ...props
}, ref) {
  const inputRef = useRef(null);
  const caretSelection = useRef();
  const [innerValue, setInnerValue] = useState(value);
  const [focused, setFocus] = useState(!!props.autoFocus);
  const [showPassword, setSowPassword] = useState(false);
  const theme = useTheme();

  const handleClickShowPassword = useCallback(
    () => setSowPassword((prev) => !prev),
    [],
  );

  useEffect(() => () => {
    caretSelection.current = null;
  }, []);

  useEffect(() => {
    setInnerValue(value);
  }, [value]);

  const handleChange = useCallback(
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
        start: event.target.selectionStart,
        end: event.target.selectionEnd,
      };
    },
    [name, onChange, textUpperCase],
  );

  const handleFocus = useCallback(
    (...focusProps) => {
      setFocus(true);
      if (props.onFocus) {
        props.onFocus(...focusProps);
      }
    },
    [props],
  );

  const handleBlur = useCallback(
    (...blurProps) => {
      setFocus(false);
      if (props.onBlur) {
        props.onBlur(...blurProps);
      }
    },
    [props],
  );

  useImperativeHandle(
    ref,
    () => ({
      focus: () => {
        inputRef.current.focus();
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
    return 'text';
  }, [props.type, showPassword]);

  return (
    <MUITextField
      ref={inputRef}
      size="small"
      name={name}
      value={innerValue}
      onChange={handleChange}
      spellCheck={false}
      InputProps={{
        endAdornment: props.type === 'password' ? (
          <InputAdornment position="end">
            <IconButton
              aria-label="toggle password visibility"
              onClick={handleClickShowPassword}
              onMouseDown={handleMouseDownPassword}
            >
              {
                showPassword
                  ? <EyeInvisibleTwoTone twoToneColor={props.error ? theme.palette.error.main : blueGrey[500]} />
                  : <EyeTwoTone twoToneColor={props.error ? theme.palette.error.main : blueGrey[500]} />
              }
            </IconButton>
          </InputAdornment>
        ) : undefined,
      }}
      InputLabelProps={{ shrink: !!innerValue || focused }}
      {...props}
      onFocus={handleFocus}
      onBlur={handleBlur}
      type={inputType}
    />
  );
}

export default forwardRef(TextField);
