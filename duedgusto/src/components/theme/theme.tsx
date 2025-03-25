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
    },
  });

export default theme;
