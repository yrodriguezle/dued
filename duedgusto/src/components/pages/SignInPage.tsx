import { Box, useTheme } from "@mui/material";
import AuthSignIn from "../authentication/AuthSignIn";

function SignInPage() {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: isDark
          ? `linear-gradient(135deg, ${theme.palette.grey[900]} 0%, ${theme.palette.grey[800]} 100%)`
          : `linear-gradient(135deg, ${theme.palette.grey[100]} 0%, ${theme.palette.grey[300]} 100%)`,
      }}
    >
      <AuthSignIn />
    </Box>
  );
}

export default SignInPage;
