import { useState, useMemo, useEffect } from "react";
import { ThemeProvider, CssBaseline, GlobalStyles } from "@mui/material";
import Backdrop from "@mui/material/Backdrop";
import CircularProgress from "@mui/material/CircularProgress";
import { ToastContainer } from "react-toastify";
import { Outlet, useBlocker, useNavigate } from "react-router";
import { useShallow } from "zustand/react/shallow";
import useTheme from "../components/theme/useTheme";
import theme from "../components/theme/theme";
import Confirm from "../components/common/confirm/Confirm";
import ErrorBoundary from "../components/common/ErrorBoundary";
import useStore from "../store/useStore";
import PageTitleContext from "../components/layout/headerBar/PageTitleContext";
import { setNavigator } from "../common/navigator/navigator";
import useBootstrap from "../components/authentication/useBootstrap";
import useConfirm from "../components/common/confirm/useConfirm";

function Root() {
  const [title, setTitle] = useState("");
  const { userTheme } = useTheme();
  const navigate = useNavigate();

  useEffect(() => {
    setNavigator(navigate);
  }, [navigate]);

  useBootstrap();

  // Blocco navigazione globale per form con modifiche non salvate
  const isFormDirty = useStore((state) => state.isFormDirty);
  const onConfirm = useConfirm();
  const blocker = useBlocker(isFormDirty);

  useEffect(() => {
    if (blocker.state !== "blocked") return;
    onConfirm({
      title: "Modifiche non salvate",
      content: "Hai delle modifiche non salvate. Sei sicuro di voler uscire?",
      acceptLabel: "Sì",
      cancelLabel: "Annulla",
    }).then((confirmed) => {
      if (confirmed) {
        blocker.proceed();
      } else {
        blocker.reset();
      }
    });
  }, [blocker, onConfirm]);

  useEffect(() => {
    if (!isFormDirty) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isFormDirty]);

  // Use shallow comparison to only re-render when any inProgress value actually changes
  const isLoading = useStore(useShallow((store) => Object.values(store.inProgress).some((value) => value === true)));

  // Memoize context value to prevent unnecessary re-renders of consumers
  const pageTitleContextValue = useMemo(() => ({ title, setTitle }), [title]);

  return (
    <ErrorBoundary>
      <PageTitleContext.Provider value={pageTitleContextValue}>
        <ThemeProvider theme={theme(userTheme.theme)}>
          <CssBaseline />
          <GlobalStyles styles={{ html: { height: "100dvh", overflow: "hidden" }, body: { height: "100dvh", overflow: "hidden" } }} />
          <Outlet />
          <ToastContainer theme={userTheme.theme} />
          <Confirm />
          <Backdrop
            open={isLoading}
            sx={{ color: "common.white", zIndex: (theme) => theme.zIndex.drawer + 1 }}
          >
            <CircularProgress color="inherit" />
          </Backdrop>
        </ThemeProvider>
      </PageTitleContext.Provider>
    </ErrorBoundary>
  );
}

export default Root;
