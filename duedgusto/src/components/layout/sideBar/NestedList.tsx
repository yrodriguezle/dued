import { JSX, useEffect, useState } from "react";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Collapse from "@mui/material/Collapse";
import ListItemIcon from "@mui/material/ListItemIcon";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useLocation } from "react-router";

export interface MenuItem {
  label: string;
  icon?: JSX.Element;
  path?: string;
  children?: MenuItem[];
  onClick?: () => void;
}

interface NestedListItemProps {
  item: MenuItem;
  drawerOpen: boolean;
  onListItemClick: (hasChildren: boolean) => void;
}

interface NestedListProps {
  items: MenuItem[];
  drawerOpen: boolean;
  onListItemClick: (hasChildren: boolean) => void;
}

const NestedList: React.FC<NestedListProps> = ({ drawerOpen, items, onListItemClick }) => {
  return (
    <List component="nav" sx={{ p: 0, m: 1 }}>
      {items.map((item, index) => (
        <NestedListItem key={index} drawerOpen={drawerOpen} item={item} onListItemClick={onListItemClick} />
      ))}
    </List>
  );
};

const NestedListItem: React.FC<NestedListItemProps> = ({ item, drawerOpen, onListItemClick }) => {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  const isItemActive = (item: MenuItem): boolean => {
    if (item.path && item.path === location.pathname) {
      return true;
    }
    if (item.children) {
      return item.children.some((child) => isItemActive(child));
    }
    return false;
  };
  const active = isItemActive(item);

  useEffect(() => {
    if (isItemActive(item)) {
      setOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, item]);

  const handleClick = () => {
    if (item.children) {
      setOpen((prev) => !prev);
    }
    if (drawerOpen) {
      if (item.onClick) {
        item.onClick();
      }
    }
    onListItemClick(!!item.children);
  };

  const highlight = active || (item.children && open);

  return (
    <>
      <ListItemButton
        onClick={handleClick}
        selected={active}
        sx={{
          justifyContent: drawerOpen ? "initial" : "center",
          height: 36,
          borderRadius: "10px",
          mb: 0.5,
          backgroundColor: highlight ? "action.selected" : "inherit",
          "&:hover": {
            backgroundColor: highlight ? "action.selected" : "action.hover",
          },
        }}
      >
        <ListItemIcon
          sx={{
            minWidth: 0,
            justifyContent: "center",
            mr: drawerOpen ? 3 : "auto",
          }}
        >
          {item.icon}
        </ListItemIcon>
        <ListItemText
          primary={item.label}
          slotProps={{
            primary: {
              fontSize: "small",
            },
          }}
          sx={{ opacity: drawerOpen ? 1 : 0 }}
        />
        {item.children && drawerOpen ? open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" /> : null}
      </ListItemButton>
      {item.children && (
        <Collapse in={open && drawerOpen} timeout="auto" unmountOnExit>
          <List component="div" disablePadding>
            {item.children.map((child, index) => (
              <NestedListItem key={index} drawerOpen={drawerOpen} item={child} onListItemClick={onListItemClick} />
            ))}
          </List>
        </Collapse>
      )}
    </>
  );
};

export default NestedList;
