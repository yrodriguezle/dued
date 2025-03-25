import { ThemeProvider, CssBaseline } from "@mui/material";
import { ToastContainer } from "react-toastify";
import { Outlet } from "react-router";
import useTheme from "../components/theme/useTheme";
import theme from "../components/theme/theme";

function Root() {
  const { userTheme } = useTheme();

  return (
    <ThemeProvider theme={theme(userTheme.theme)}>
      <CssBaseline />
      <Outlet />
      <ToastContainer theme={userTheme.theme} />
    </ThemeProvider>
  );
}

export default Root;
