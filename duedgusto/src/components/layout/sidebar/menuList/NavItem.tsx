import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
} from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';
import {
  Avatar, Chip, ListItemButton, ListItemIcon, ListItemText, Typography, useMediaQuery,
} from '@mui/material';
import useStore from '../../../../store/useStore';

interface NavItemProps {
  item: {
    id: string;
    icon?: React.ElementType;
    url: string;
    title: string;
    external?: boolean;
    target?: string;
    disabled?: boolean;
    caption?: string;
    chip?: {
      color: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
      variant: 'filled' | 'outlined';
      size: 'small' | 'medium';
      label: string;
      avatar?: string;
    };
  };
}

const NavItem = ({ item }: NavItemProps) => {
  const theme = useTheme();
  const matchesSM = useMediaQuery(theme.breakpoints.down('lg'));
  const {
    sidebar,
    receiveSidebarOpen,
    receiveSidebarMenuOpen,
  } = useStore((store: Store) => store)

  const itemIcon = useMemo(() => {
    const Icon = item.icon;
    return (Icon ? <Icon stroke={1.5} size="1.3rem" /> : null);
  }, [item.icon]);

  const listItemProps = useMemo(() => (item.external
    ? { component: 'a', href: item.url, target: item.target ? '_blank' : '_self' }
    : {
      component: forwardRef<HTMLAnchorElement>((props, ref) => <Link ref={ref} {...props} to={`${(window as Global).ROOT_URL}${item.url}`} target={item.target ? '_blank' : '_self'} />),
    }), [item.external, item.target, item.url]);

  const itemHandler = useCallback(
    (id: string) => {
      receiveSidebarMenuOpen(id);
      if (matchesSM) {
        receiveSidebarOpen(false);
      }
    },
    [matchesSM, receiveSidebarMenuOpen, receiveSidebarOpen],
  );

  // active menu item on page load
  useEffect(
    () => {
      const currentIndex = document.location.pathname
        .toString()
        .split('/')
        .findIndex((id) => id === item.id);
      if (currentIndex > -1) {
        receiveSidebarMenuOpen(item.id);
      }
    },
    [item.id, receiveSidebarMenuOpen]
  );

  return (
    <ListItemButton
      {...listItemProps}
      disabled={item.disabled}
      sx={{
        // borderRadius: `${sidebar.borderRadius}px`,
        alignItems: 'flex-start',
      }}
      selected={sidebar.isOpen.findIndex((id) => id === item.id) > -1}
      onClick={() => itemHandler(item.id)}
    >
      <ListItemIcon sx={{ my: 'auto', minWidth: 30 }}>{itemIcon}</ListItemIcon>
      <ListItemText
        primary={(
          <Typography variant={sidebar.isOpen.findIndex((id) => id === item.id) > -1 ? 'h5' : 'body1'} color="inherit">
            {item.title}
          </Typography>
        )}
        secondary={
          item.caption && (
            <Typography variant="caption" sx={{ ...theme.typography.subtitle1 }} display="block" gutterBottom>
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
          avatar={item.chip.avatar ? <Avatar>{item.chip.avatar}</Avatar> : undefined}
        />
      )}
    </ListItemButton>
  );
};

export default NavItem;
