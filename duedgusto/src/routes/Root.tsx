import { ThemeProvider, CssBaseline } from "@mui/material";
import Backdrop from "@mui/material/Backdrop";
import CircularProgress from "@mui/material/CircularProgress";
import { ToastContainer } from "react-toastify";
import { Outlet } from "react-router";
import useTheme from "../components/theme/useTheme";
import theme from "../components/theme/theme";
import Confirm from "../components/common/confirm/Confirm";
import useStore from "../store/useStore";

function Root() {
  const { userTheme } = useTheme();
  const inProgressGlobal = useStore((store) => store.inProgress.global);

  return (
    <ThemeProvider theme={theme(userTheme.theme)}>
      <CssBaseline />
      <Outlet />
      <ToastContainer theme={userTheme.theme} />
      <Confirm />
      <Backdrop open={inProgressGlobal} sx={{ color: "#fff", zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <CircularProgress color="inherit" />
      </Backdrop>
    </ThemeProvider>
  );
}

export default Root;
