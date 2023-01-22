import React, { useCallback, useState } from 'react';
import { useSelector } from 'react-redux';
import Box from '@mui/material/Box';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Divider from '@mui/material/Divider';
import ListItemIcon from '@mui/material/ListItemIcon';
import {
  BellOutlined, SettingOutlined, MenuOutlined, LogoutOutlined,
} from '@ant-design/icons';

import LogoSection from './LogoSection';

import SearchRoute from './SearchRoute';
import Persona from './Persona';
import useMakeLogout from '../../graphql/user/useMakeLogout';

function Header({ drawerToggle }) {
  const user = useSelector((state) => state.user);
  const handleLogout = useMakeLogout();
  const [anchorElUser, setAnchorElUser] = useState(null);

  const handleOpenUserMenu = useCallback(
    (event) => {
      setAnchorElUser(event.currentTarget);
    },
    [],
  );

  const handleCloseUserMenu = useCallback(
    () => {
      setAnchorElUser(null);
    },
    [],
  );

  return (
    <AppBar
      position="fixed"
      sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}
      elevation={0}
      enableColorOnDark
    >
      <Toolbar>
        <IconButton
          size="small"
          sx={{ p: 2, marginRight: 1 }}
          onClick={drawerToggle}
        >
          <MenuOutlined />
        </IconButton>
        <Box component="span" sx={{ display: { xs: 'none', md: 'block' } }}>
          <LogoSection />
        </Box>
        <Box sx={{ display: { xs: 'none', md: 'block', flexGrow: 1 } }} />
        <SearchRoute />
        <IconButton
          aria-label="notifications"
          size="small"
          sx={{ marginLeft: 1 }}
        >
          <BellOutlined />
        </IconButton>
        <IconButton
          aria-label="settings"
          size="small"
          sx={{
            marginLeft: 1,
            marginRight: 1,
          }}
        >
          <SettingOutlined />
        </IconButton>

        <Box sx={{ flexGrow: 0 }}>
          <Tooltip title="Profilo">
            <IconButton onClick={handleOpenUserMenu} sx={{ p: 1 }}>
              <Persona
                alt={`${user.firstName} ${user.lastName}`}
                text={`${user.firstName} ${user.lastName}`}
              />
            </IconButton>
          </Tooltip>
          <Menu
            anchorEl={anchorElUser}
            id="account-menu"
            open={Boolean(anchorElUser)}
            onClose={handleCloseUserMenu}
            onClick={handleCloseUserMenu}
            PaperProps={{
              elevation: 0,
              sx: {
                overflow: 'visible',
                filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
                mt: 1.5,
                '& .MuiAvatar-root': {
                  width: 32,
                  height: 32,
                  ml: -0.5,
                  mr: 1,
                },
                '&:before': {
                  content: '""',
                  display: 'block',
                  position: 'absolute',
                  top: 0,
                  right: 14,
                  width: 10,
                  height: 10,
                  bgcolor: 'background.paper',
                  transform: 'translateY(-50%) rotate(45deg)',
                  zIndex: 0,
                },
              },
            }}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          >
            <Divider />
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <LogoutOutlined />
              </ListItemIcon>
              Esci
            </MenuItem>
          </Menu>
        </Box>
      </Toolbar>
    </AppBar>
  );
}

export default Header;
