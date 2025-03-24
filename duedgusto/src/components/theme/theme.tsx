import { createTheme, PaletteMode } from "@mui/material/styles";

export const getDefaultTheme = (): Theme =>
  window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

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
