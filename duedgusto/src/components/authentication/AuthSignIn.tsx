import { useCallback, useState } from "react";
import { useNavigate } from "react-router";
import { Alert, Box, Card, useMediaQuery, useTheme } from "@mui/material";

import useProgress from "../common/progress/useProgress";
import useSignIn from "../../graphql/utente/useSignIn";
import useGetLoggedUtente from "../../common/authentication/useGetLoggedUser";
import { setRememberPassword } from "../../common/authentication/auth";
import LogoSection from "../common/logo/LogoSection";
import AuthSignInForm, { AuthSignInValues } from "./AuthSignInForm";
import Copyright from "../common/copyright/Copyright";

function AuthSignIn() {
  const theme = useTheme();
  const matchDownSm = useMediaQuery(theme.breakpoints.down("sm"));
  const [message, setMessage] = useState("");
  const { setOnInProgress, setOffInProgress } = useProgress();
  const { signIn } = useSignIn();
  const fetchUtente = useGetLoggedUtente();
  const navigate = useNavigate();

  const handleSubmit = useCallback(
    async (values: AuthSignInValues) => {
      try {
        setOnInProgress();
        setMessage("");
        const { username, password } = values;
        const signinSuccesful = await signIn({ username, password });
        if (!signinSuccesful) {
          setMessage("Utente o password non validi!");
          return;
        }
        setRememberPassword(values.alwaysConnected);
        await fetchUtente();
        navigate("/gestionale", { replace: true });
      } catch (error) {
        if (error && typeof error === "object" && "message" in error) {
          setMessage(error.message as string);
          return;
        }
        throw error;
      } finally {
        setOffInProgress();
      }
    },
    [fetchUtente, navigate, setOffInProgress, setOnInProgress, signIn]
  );

  return (
    <Card
      elevation={matchDownSm ? 0 : 8}
      sx={{
        width: matchDownSm ? "100%" : 420,
        maxWidth: "100%",
        mx: matchDownSm ? 2 : 0,
        borderRadius: 3,
        overflow: "visible",
      }}
    >
      <Box sx={{ px: 4, pt: 5, pb: 3 }}>
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", mb: 3 }}>
          <LogoSection variant="h3" />
        </Box>

        {message && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {message}
          </Alert>
        )}

        <AuthSignInForm onSubmit={handleSubmit} />
      </Box>

      <Box
        sx={{
          px: 4,
          py: 1.5,
          borderTop: 1,
          borderColor: "divider",
          bgcolor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)",
          borderRadius: "0 0 12px 12px",
        }}
      >
        <Copyright />
      </Box>
    </Card>
  );
}

export default AuthSignIn;
