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
  isOpen: boolean;
  onToggle: () => void;
}

interface NestedListProps {
  items: MenuItem[];
  drawerOpen: boolean;
  onListItemClick: (hasChildren: boolean) => void;
}

const NestedList: React.FC<NestedListProps> = ({ drawerOpen, items, onListItemClick }) => {
  const location = useLocation();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  // Auto-apri il menu che contiene la route attiva
  useEffect(() => {
    const activeIndex = items.findIndex((item) => {
      if (item.children) {
        return item.children.some((child) => child.path === location.pathname);
      }
      return false;
    });
    if (activeIndex >= 0) {
      setOpenIndex(activeIndex);
    }
  }, [location.pathname, items]);

  const handleToggle = (index: number) => {
    setOpenIndex((prev) => (prev === index ? null : index));
  };

  return (
    <List component="nav" sx={{ p: 0, m: 1 }}>
      {items.map((item, index) => (
        <NestedListItem key={index} drawerOpen={drawerOpen} item={item} onListItemClick={onListItemClick} isOpen={openIndex === index} onToggle={() => handleToggle(index)} />
      ))}
    </List>
  );
};

const NestedListItem: React.FC<NestedListItemProps> = ({ item, drawerOpen, onListItemClick, isOpen, onToggle }) => {
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

  const handleClick = () => {
    if (item.children) {
      onToggle();
    }
    if (drawerOpen) {
      if (item.onClick) {
        item.onClick();
      }
    }
    onListItemClick(!!item.children);
  };

  const highlight = active || (item.children && isOpen);

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
        {item.children && drawerOpen ? isOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" /> : null}
      </ListItemButton>
      {item.children && (
        <Collapse in={isOpen && drawerOpen} timeout="auto" unmountOnExit>
          <List
            component="div"
            disablePadding
            sx={{
              ml: 2,
              borderLeft: 2,
              borderColor: "primary.main",
              borderRadius: "0 8px 8px 0",
              py: 0.5,
            }}
          >
            {item.children.map((child, index) => (
              <NestedListItem key={index} drawerOpen={drawerOpen} item={child} onListItemClick={onListItemClick} isOpen={false} onToggle={() => {}} />
            ))}
          </List>
        </Collapse>
      )}
    </>
  );
};

export default NestedList;
