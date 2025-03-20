import React, {
  useEffect, useMemo, useRef,
} from 'react';
import {
  useSelector,
} from 'react-redux';
import {
  Route,
  Routes,
  Navigate,
} from 'react-router-dom';
import { StyledEngineProvider, ThemeProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';

import { isAuthenticated } from './common/auth';
import useClearCache from './useClearCache';
import theme from './common/theme/theme';
import PrivateRoutes from './components/commonComponents/router/PrivateRoutes';
import LoginPage from './pages/LoginPage';
import useThemeDetector from './components/commonComponents/hooks/useThemeDetector';
import useBootstrapUser from './graphql/user/useBootstrapUser';

function App() {
  const effectRan = useRef(false);
  const user = useSelector((state) => state.user);
  const isThemeDark = useSelector((state) => state.settings?.darkTheme);
  const mode = useMemo(() => (isThemeDark ? 'dark' : 'light'), [isThemeDark]);

  const bootstrapUser = useBootstrapUser();
  useClearCache();
  useThemeDetector();

  useEffect(() => {
    if (effectRan.current || process.env.NODE_ENV !== 'development') {
      if (isAuthenticated() && !user) {
        bootstrapUser();
      }
    }
    return () => { effectRan.current = true; };
  }, [bootstrapUser, user]);

  return (
    <StyledEngineProvider injectFirst>
      <ThemeProvider theme={theme(mode)}>
        <CssBaseline />
        <Routes>
          <Route
            index
            path={`${global.ROOT_URL}/*`}
            element={
              isAuthenticated()
                ? (
                  <PrivateRoutes
                    uiFunctions={[]}
                  />
                ) : <Navigate replace to="/login" />
            }
          />
          <Route
            path="/login"
            element={(
              <LoginPage
                uiFunctions={[]}
              />
            )}
          />
          <Route path="*" element={<Navigate to={global.ROOT_URL} />} />
        </Routes>
      </ThemeProvider>
    </StyledEngineProvider>
  );
}

export default App;
