import React, { useCallback, useEffect, useState } from 'react';
import Typography from '@mui/material/Typography';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import { Formik } from 'formik';
import { useTheme } from '@mui/material/styles';
import * as Yup from 'yup';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import useMediaQuery from '@mui/material/useMediaQuery';

import LoginForm from './LoginForm';
import useSubmitLogin from '../../graphql/user/useSubmitLogin';
import { setAuthToken, setRememberPassword } from '../../common/auth';
import isEmpty from '../../common/tools/isEmpty';
import useMakeLogin from '../../graphql/user/useMakeLogin';
import LogoSection from '../../components/layout/LogoSection';

const Schema = Yup.object().shape({
  username: Yup.string().required('Il nome utente è obbligatorio.'),
  password: Yup.string().required('La password è obbligatoria.'),
  alwaysConnected: Yup.boolean(),
});

function Copyright(props) {
  return (
    <Typography variant="caption" color="text.secondary" align="center" {...props}>
      {global.COPYRIGHT}
    </Typography>
  );
}

function AuthLogin() {
  const [redirectCount, setRedirectCount] = useState(0);
  const theme = useTheme();
  const matchDownSm = useMediaQuery(theme.breakpoints.down('sm'));
  const [message, setMessage] = useState('');
  const submitLogin = useSubmitLogin();
  const makeLogin = useMakeLogin();
  const user = useSelector((state) => state.user);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isEmpty(user) && redirectCount < 3) {
      setRedirectCount((prev) => prev + 1);
      setTimeout(() => navigate(global.ROOT_URL, { replace: true }), 0);
    }
  }, [user, navigate, redirectCount]);

  const handleSubmit = useCallback(
    async (values) => {
      try {
        setMessage('');
        const { username, password } = values;
        const data = await submitLogin({ username, password });
        if (data && 'token' in data && 'refreshToken' in data) {
          const { token, refreshToken } = data;
          setAuthToken({ token, refreshToken });
          setRememberPassword(values.alwaysConnected);

          await makeLogin();
        }
        if (data && 'message' in data) {
          setMessage(data.message);
        }
      } catch (error) {
        setMessage(error.message);
      }
    },
    [makeLogin, submitLogin],
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
          <Formik
            enableReinitialize
            initialValues={{
              username: '',
              password: '',
              alwaysConnected: true,
            }}
            initialStatus={{
              formStatus: 'INSERT',
              isFormLocked: false,
            }}
            validationSchema={Schema}
            onSubmit={handleSubmit}
          >
            <LoginForm />
          </Formik>
        </Box>
        <Copyright sx={{ mt: 1, mb: 1, fontSize: '0.7rem' }} />
      </Box>
    </div>
  );
}

export default AuthLogin;
