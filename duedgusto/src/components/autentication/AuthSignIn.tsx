import { useCallback, useState } from "react";
import { Alert, CssBaseline, Typography } from "@mui/material";
import { Box, useMediaQuery, useTheme } from "@mui/system";
import LogoSection from "../layout/LogoSection";
import AuthSignInForm, { AuthSignInValues } from "./AuthSignInForm";
import login from "../../api/authentication/login";
import { setAuthToken, setRememberPassword } from "../../common/authentication/auth";
import useProgress from "../common/progress/useProgress";
import useGetLoggedUser from "../../common/authentication/useGetLoggedUser";

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
  const fetchUser = useGetLoggedUser();

  // const onError = (response: Response) => {
  //   console.log(response);
  // }

  const handleSubmit = useCallback(
    async (values: AuthSignInValues) => {
      try {
        setOnInProgress();
        setMessage('');
        const { username, password } = values;
        const data = await login({ username, password });
        if (data && 'token' in data && 'refreshToken' in data) {
          const { token, refreshToken } = data;
          setAuthToken({ token, refreshToken });
          setRememberPassword(values.alwaysConnected);

          const user = await fetchUser();
          console.log(user);
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
    [fetchUser, setOffInProgress, setOnInProgress],
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