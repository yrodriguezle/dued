import { useState } from "react";
import { Alert, CssBaseline, Typography } from "@mui/material";
import { Box, useMediaQuery, useTheme } from "@mui/system";
import LogoSection from "../layout/LogoSection";

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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [message, setMessage] = useState('');

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
          sing in form
        </Box>
        <Copyright  />
      </Box>
    </div>
  )
}

export default AuthSignIn