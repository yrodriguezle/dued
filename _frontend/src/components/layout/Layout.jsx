import React, { useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Box from '@mui/material/Box';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

import CssBaseline from '@mui/material/CssBaseline';
import Toolbar from '@mui/material/Toolbar';

import Header from './Header';
import { isAuthenticated } from '../../common/auth';
import Dimmer from '../commonComponents/Dimmer';
import Sidebar from './sidebar/Sidebar';
import drawerToggle from '../../redux/actions/drawer/drawerToggle';
import Main from './Main';

function Layout({ children }) {
  const theme = useTheme();
  const matchDownSm = useMediaQuery(theme.breakpoints.down('sm'));
  const user = useSelector((state) => state.user);
  const isUserLogged = useMemo(() => !!(isAuthenticated() && user), [user]);
  const drawerOpened = useSelector((state) => state.customization.opened);
  const dispatch = useDispatch();

  const handleDrawerToggle = useCallback(
    () => {
      dispatch(drawerToggle(!drawerOpened));
    },
    [dispatch, drawerOpened],
  );

  if (!isUserLogged) {
    return (
      <Dimmer open={isUserLogged} />
    );
  }

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <Header drawerToggle={handleDrawerToggle} />
      <Sidebar drawerOpened={drawerOpened} drawerToggle={handleDrawerToggle} />
      <Main open={matchDownSm || drawerOpened}>
        <Toolbar />
        {children}
      </Main>
    </Box>
  );
}

export default Layout;
