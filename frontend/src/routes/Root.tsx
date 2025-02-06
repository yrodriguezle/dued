import { StyledEngineProvider, ThemeProvider } from "@mui/system";
import { CssBaseline } from "@mui/material";
import { ToastContainer } from "react-toastify";
import { Outlet } from "react-router-dom";

import { ThemeContext } from "../theme/themeContext";
import useThemeDetector from "../theme/useThemeDetector";
import theme from "../theme/theme";

function Root() {
  const { darkMode, themeMode, onChangeTheme } = useThemeDetector();
  return (
    <ThemeContext.Provider value={{ theme: themeMode, onChangeTheme }}>
      <StyledEngineProvider injectFirst>
        <ThemeProvider theme={theme(darkMode ? 'dark' : 'light')}>
          <CssBaseline />
          <Outlet />
          <ToastContainer theme={darkMode ? 'dark' : 'light'} />
        </ThemeProvider>
      </StyledEngineProvider>
    </ThemeContext.Provider>
  )
}

export default Root