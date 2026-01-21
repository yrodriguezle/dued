import { useCallback, useState } from "react";
import { useNavigate } from "react-router";
import { Alert, Box, useMediaQuery, useTheme } from "@mui/material";

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
    <div
      className="login-card"
      style={{
        backgroundColor: theme.palette.mode === "dark" ? theme.palette.grey[800] : theme.palette.grey[50],
        minWidth: matchDownSm ? "90%" : undefined,
        width: matchDownSm ? "90%" : undefined,
      }}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingLeft: 2,
          paddingRight: 2,
          background: "transparent",
        }}
      >
        <Box
          sx={{
            marginTop: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          {message ? (
            <Alert severity="error" sx={{ mb: 2, width: "100%" }}>
              {message}
            </Alert>
          ) : null}
          <LogoSection />
          <AuthSignInForm onSubmit={handleSubmit} />
        </Box>
        <Copyright />
      </Box>
    </div>
  );
}

export default AuthSignIn;
