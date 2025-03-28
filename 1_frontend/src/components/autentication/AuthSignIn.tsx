import { useCallback, useState } from "react";
import { Alert, CssBaseline, Typography } from "@mui/material";
import { Box, useMediaQuery, useTheme } from "@mui/system";
import { useNavigate } from "react-router-dom";

import LogoSection from "../layout/LogoSection";
import AuthSignInForm, { AuthSignInValues } from "./AuthSignInForm";
import { setRememberPassword } from "../../common/authentication/auth";
import useProgress from "../common/progress/useProgress";
import useGetLoggedUser from "../../common/authentication/useGetLoggedUser";
import useSignIn from "../../graphql/user/useSignIn";

function Copyright() {
  return (
    <Typography variant="caption" color="text.secondary" align="center" sx={{ mt: 1, mb: 1, fontSize: '0.7rem' }}>
      {(window as Global).COPYRIGHT}
    </Typography>
  );
}

function AuthSignIn() {
  const theme = useTheme();
  const matchDownSm = useMediaQuery(theme.breakpoints.down('sm'));
  const [message, setMessage] = useState('');
  const { setOnInProgress, setOffInProgress} = useProgress();
  const { signIn } = useSignIn();
  const fetchUser = useGetLoggedUser();
  const navigate = useNavigate();

  const handleSubmit = useCallback(
    async (values: AuthSignInValues) => {
      try {
        setOnInProgress();
        setMessage('');
        const { username, password } = values;
        const signinSuccesful = await signIn({ username, password });
        if (signinSuccesful) {
          setRememberPassword(values.alwaysConnected);
          await fetchUser();
          navigate((window as Global).ROOT_URL || '', { replace: true })
        }
      } catch (error) {
        if (error && typeof error === 'object' && 'message' in error) {
          setMessage(error.message as string);
          return;
        }
        throw error;
      } finally {
        setOffInProgress();
      }
    },
    [fetchUser, navigate, setOffInProgress, setOnInProgress, signIn],
  );

  return (
    <div
      className="login-card"
      style={{
        backgroundColor: 'var(--cardBackground)',
        minWidth: matchDownSm ? '90%' : undefined,
        width: matchDownSm ? '90%' : undefined,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingLeft: 2,
          paddingRight: 2,
          background: 'transparent',
        }}
      >
        <CssBaseline />
        <Box
          sx={{
            marginTop: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          {message ? <Alert severity="error" sx={{ mb: 2, width: '100%' }}>{message}</Alert> : null}
          <LogoSection />
          <AuthSignInForm onSubmit={handleSubmit} />
        </Box>
        <Copyright  />
      </Box>
    </div>
  )
}

export default AuthSignIn