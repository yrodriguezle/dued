import { createTheme, PaletteMode } from "@mui/material/styles";

export const getDefaultTheme = (): Theme => (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

export const getLastUserThemeMode = (): ThemeMode => (localStorage.getItem("theme") as ThemeMode) || "default";

export const setLastUserThemeMode = (theme: string) => localStorage.setItem("theme", theme);

const theme = (mode: PaletteMode | undefined) =>
  createTheme({
    palette: {
      mode,
      primary: {
        main: "#ffab40",
      },
      secondary: {
        main: "#bf360c",
      },
      success: {
        main: "#2e7d32",
        light: "#4caf50",
      },
      warning: {
        main: "#ed6c02",
      },
      error: {
        main: "#d32f2f",
      },
      info: {
        main: "#0288d1",
        light: "#2196f3",
      },
    },
    components: {
      MuiTextField: {
        defaultProps: {
          size: "small",
          margin: "dense",
        },
      },
      MuiSelect: {
        defaultProps: {
          size: "small",
          margin: "dense",
        },
      },
      MuiButton: {
        defaultProps: {
          size: "small",
        },
        styleOverrides: {
          root: {
            lineHeight: 1.5,
          },
        },
      },
      MuiIconButton: {
        defaultProps: {
          size: "small",
        },
      },
      MuiChip: {
        defaultProps: {
          size: "small",
        },
      },
      MuiFormControl: {
        defaultProps: {
          size: "small",
          margin: "dense",
        },
      },
      MuiAutocomplete: {
        defaultProps: {
          size: "small",
        },
      },
    },
  });

export default theme;
