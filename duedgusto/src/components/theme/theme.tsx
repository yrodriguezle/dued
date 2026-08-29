import { createTheme, PaletteMode } from "@mui/material/styles";

export const getDefaultTheme = (): Theme => (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

export const getLastUserThemeMode = (): ThemeMode => (localStorage.getItem("theme") as ThemeMode) || "default";

export const setLastUserThemeMode = (theme: string) => localStorage.setItem("theme", theme);

/**
 * La barra di scorrimento, **discreta e della stessa temperatura del tema**.
 *
 * <p>🔴 Sta nel tema e non nelle singole pagine perché le barre di scorrimento non sono un
 * dettaglio di una schermata: convivono nella stessa videata — la sidebar, una lista, una
 * griglia — e vestirne una sola le rende più evidenti, non meno.</p>
 *
 * <p>⚠️ Il pollice è un bianco (o un nero) trasparente e non un colore del tema: deve stare
 * sopra qualunque sfondo si trovi sotto, e una tinta fissa stona appena il fondo cambia.</p>
 *
 * <p>ℹ️ Il bordo trasparente più <c>background-clip: content-box</c> è ciò che rende il pollice
 * sottile senza restringere la traccia: un pollice largo 4 px su una traccia larga 4 px è quasi
 * impossibile da afferrare col mouse.</p>
 */
const barreDiScorrimento = (mode: PaletteMode | undefined) => {
  const scuro = mode === "dark";
  const pollice = scuro ? "rgba(255, 255, 255, 0.18)" : "rgba(0, 0, 0, 0.20)";
  const polliceSopra = scuro ? "rgba(255, 255, 255, 0.32)" : "rgba(0, 0, 0, 0.34)";

  return {
    "*": {
      scrollbarWidth: "thin" as const,
      scrollbarColor: `${pollice} transparent`,
    },
    "*::-webkit-scrollbar": {
      width: 12,
      height: 12,
    },
    "*::-webkit-scrollbar-track": {
      backgroundColor: "transparent",
    },
    "*::-webkit-scrollbar-thumb": {
      backgroundColor: pollice,
      borderRadius: 999,
      border: "3px solid transparent",
      backgroundClip: "content-box",
    },
    "*::-webkit-scrollbar-thumb:hover": {
      backgroundColor: polliceSopra,
    },
    // L'angolo fra le due barre resta il grigio di sistema se non lo si spegne, e in tema scuro
    // è un quadratino chiaro in basso a destra che si vede da lontano.
    "*::-webkit-scrollbar-corner": {
      backgroundColor: "transparent",
    },
  };
};

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
      MuiCssBaseline: {
        styleOverrides: barreDiScorrimento(mode),
      },
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
