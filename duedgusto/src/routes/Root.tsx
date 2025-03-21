import { ThemeProvider, CssBaseline } from "@mui/material";
import { Outlet } from "react-router";
import useTheme from "../components/theme/useTheme";
import theme from "../components/theme/theme";

function Root() {
  const { userTheme } = useTheme();

  return (
    <ThemeProvider theme={theme(userTheme.theme)}>
      <CssBaseline />
      <Outlet />
    </ThemeProvider>
  );
}

export default Root;
