import React, {
  forwardRef, useCallback, useEffect, useMemo,
} from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';

import { useTheme } from '@mui/material/styles';
import {
  Avatar, Chip, ListItemButton, ListItemIcon, ListItemText, Typography, useMediaQuery,
} from '@mui/material';

import { MENU_OPEN, SET_MENU } from '../../../../redux/actions/types';

const NavItem = ({ item }) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const customization = useSelector((state) => state.customization);
  const matchesSM = useMediaQuery(theme.breakpoints.down('lg'));

  const itemIcon = useMemo(() => {
    const Icon = item.icon;
    return (Icon ? <Icon stroke={1.5} size="1.3rem" /> : null);
  }, [item.icon]);

  const listItemProps = useMemo(() => (item.external
    ? { component: 'a', href: item.url, target: item.target ? '_blank' : '_self' }
    : {
      // eslint-disable-next-line react/no-unstable-nested-components
      component: forwardRef((props, ref) => <Link ref={ref} {...props} to={`${global.ROOT_URL}${item.url}`} target={item.target ? '_blank' : '_self'} />),
    }), [item.external, item.target, item.url]);

  const itemHandler = useCallback(
    (id) => {
      dispatch({ type: MENU_OPEN, id });
      if (matchesSM) {
        dispatch({ type: SET_MENU, opened: false });
      }
    },
    [dispatch, matchesSM],
  );

  // active menu item on page load
  useEffect(() => {
    const currentIndex = document.location.pathname
      .toString()
      .split('/')
      .findIndex((id) => id === item.id);
    if (currentIndex > -1) {
      dispatch({ type: MENU_OPEN, id: item.id });
    }
    // eslint-disable-next-line
    }, []);

  return (
    <ListItemButton
      {...listItemProps}
      disabled={item.disabled}
      sx={{
        borderRadius: `${customization.borderRadius}px`,
        alignItems: 'flex-start',
      }}
      selected={customization.isOpen.findIndex((id) => id === item.id) > -1}
      onClick={() => itemHandler(item.id)}
    >
      <ListItemIcon sx={{ my: 'auto', minWidth: 30 }}>{itemIcon}</ListItemIcon>
      <ListItemText
        primary={(
          <Typography variant={customization.isOpen.findIndex((id) => id === item.id) > -1 ? 'h5' : 'body1'} color="inherit">
            {item.title}
          </Typography>
        )}
        secondary={
          item.caption && (
            <Typography variant="caption" sx={{ ...theme.typography.subMenuCaption }} display="block" gutterBottom>
              {item.caption}
            </Typography>
          )
        }
      />
      {item.chip && (
        <Chip
          color={item.chip.color}
          variant={item.chip.variant}
          size={item.chip.size}
          label={item.chip.label}
          avatar={item.chip.avatar && <Avatar>{item.chip.avatar}</Avatar>}
        />
      )}
    </ListItemButton>
  );
};

export default NavItem;
