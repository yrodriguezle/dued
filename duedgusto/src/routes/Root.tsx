import { useState, useMemo } from "react";
import { ThemeProvider, CssBaseline } from "@mui/material";
import Backdrop from "@mui/material/Backdrop";
import CircularProgress from "@mui/material/CircularProgress";
import { ToastContainer } from "react-toastify";
import { Outlet } from "react-router";
import { useShallow } from "zustand/react/shallow";
import useTheme from "../components/theme/useTheme";
import theme from "../components/theme/theme";
import Confirm from "../components/common/confirm/Confirm";
import ErrorBoundary from "../components/common/ErrorBoundary";
import useStore from "../store/useStore";
import PageTitleContext from "../components/layout/headerBar/PageTitleContext";

function Root() {
  const [title, setTitle] = useState("");
  const { userTheme } = useTheme();

  // Use shallow comparison to only re-render when any inProgress value actually changes
  const isLoading = useStore(useShallow((store) => Object.values(store.inProgress).some((value) => value === true)));

  // Memoize context value to prevent unnecessary re-renders of consumers
  const pageTitleContextValue = useMemo(() => ({ title, setTitle }), [title]);

  return (
    <ErrorBoundary>
      <PageTitleContext.Provider value={pageTitleContextValue}>
        <ThemeProvider theme={theme(userTheme.theme)}>
          <CssBaseline />
          <Outlet />
          <ToastContainer theme={userTheme.theme} />
          <Confirm />
          <Backdrop open={isLoading} sx={{ color: "#fff", zIndex: (theme) => theme.zIndex.drawer + 1 }}>
            <CircularProgress color="inherit" />
          </Backdrop>
        </ThemeProvider>
      </PageTitleContext.Provider>
    </ErrorBoundary>
  );
}

export default Root;
