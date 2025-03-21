import { ThemeProvider, createTheme, CssBaseline } from "@mui/material";
import { Outlet } from "react-router";
import useTheme from "../components/theme/useTheme";

const darkTheme = createTheme({ palette: { mode: "dark" } });
const lightTheme = createTheme({ palette: { mode: "light" } });

function Root() {
  const {
    userTheme
  } = useTheme();
  return (
    <ThemeProvider theme={userTheme.theme === "dark" ? darkTheme : lightTheme}>
      <CssBaseline />
      <Outlet />
    </ThemeProvider>
  );
  
  
}

export default Root;
