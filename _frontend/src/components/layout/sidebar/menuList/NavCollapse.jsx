/* eslint-disable no-unused-vars */
import React, { useCallback, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import useTheme from '@mui/material/styles/useTheme';
import Collapse from '@mui/material/Collapse';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';

import InboxIcon from '@mui/icons-material/MoveToInbox';
import MailIcon from '@mui/icons-material/Mail';

import { IconChevronDown, IconChevronUp } from '@tabler/icons';
import NavItem from './NavItem';

const NavCollapse = ({ menu, level }) => {
  const theme = useTheme();
  const customization = useSelector((state) => state.customization);

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const handleClick = useCallback(
    () => {
      setOpen(!open);
      setSelected(!selected ? menu.id : null);
    },
    [menu.id, open, selected],
  );

  const items = useMemo(() => menu.children?.map((item) => {
    switch (item.type) {
      case 'collapse':
        return <NavCollapse key={item.id} menu={item} level={level + 1} />;
      case 'item':
        return <NavItem key={item.id} item={item} level={level + 1} />;
      default:
        return (
          <Typography key={item.id} variant="h6" color="error" align="center">
            Menu Items Error
          </Typography>
        );
    }
  }), [level, menu.children]);

  const menuIcon = useMemo(() => {
    const Icon = menu.icon;
    return (Icon ? <Icon strokeWidth={1.5} size="1.3rem" style={{ marginTop: 'auto', marginBottom: 'auto' }} /> : null);
  }, [menu.icon]);

  const Chevron = useMemo(() => (open ? IconChevronUp : IconChevronDown), [open]);

  return (
    <>
      <ListItemButton
        sx={{
          borderRadius: `${customization.borderRadius}px`,
          alignItems: 'flex-start',
        }}
        selected={selected === menu.id}
        onClick={handleClick}
      >
        <ListItemIcon sx={{ my: 'auto', minWidth: 30 }}>{menuIcon}</ListItemIcon>
        <ListItemText
          primary={(
            <Typography variant="body1" color="inherit" sx={{ my: 'auto' }}>
              {menu.title}
            </Typography>
          )}
          secondary={
            menu.caption && (
            <Typography variant="caption" sx={{ ...theme.typography.subMenuCaption }} display="block" gutterBottom>
              {menu.caption}
            </Typography>
            )
          }
        />
        <Chevron stroke={1.5} size="1rem" style={{ marginTop: 'auto', marginBottom: 'auto' }} />
      </ListItemButton>
      <Collapse in={open} timeout="auto" unmountOnExit>
        <List disablePadding>
          {items}
        </List>
        {/* <List disablePadding>
          {['Inbox', 'Starred', 'Send email', 'Drafts'].map((text, index) => (
            <ListItemButton key={text}>
              <ListItemIcon>
                {index % 2 === 0 ? <InboxIcon /> : <MailIcon />}
              </ListItemIcon>
              <ListItemText primary={text} />
            </ListItemButton>
          ))}
        </List> */}
      </Collapse>
    </>
  );
};

export default NavCollapse;
