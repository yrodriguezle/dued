import { JSX, useState } from "react";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Collapse from "@mui/material/Collapse";
import ListItemIcon from "@mui/material/ListItemIcon";

import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

export interface MenuItem {
  label: string;
  onClick?: () => void;
  icon: JSX.Element;
  children?: MenuItem[];
}

interface NestedListItemProps {
  item: MenuItem;
  drawerOpen: boolean;
}

interface NestedListProps {
  items: MenuItem[];
  drawerOpen: boolean;
}

const NestedList: React.FC<NestedListProps> = ({ drawerOpen, items }) => {
  return (
    <List component="nav">
      {items.map((item, index) => (
        <NestedListItem key={index} drawerOpen={drawerOpen} item={item} />
      ))}
    </List>
  );
};

const NestedListItem: React.FC<NestedListItemProps> = ({ item, drawerOpen }) => {
  const [open, setOpen] = useState(false);

  const handleClick = () => {
    if (item.children) {
      setOpen((prev) => !prev);
    }
    if (item.onClick) {
      item.onClick();
    }
  };

  return (
    <>
      <ListItemButton
        onClick={handleClick}
        sx={{
          justifyContent: drawerOpen ? "initial" : "center",
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
        <ListItemText primary={item.label} sx={{ opacity: drawerOpen ? 1 : 0 }} />
        {item.children && drawerOpen ? open ? <ExpandLessIcon /> : <ExpandMoreIcon /> : null}
      </ListItemButton>
      {item.children && (
        <Collapse in={open && drawerOpen} timeout="auto" unmountOnExit>
          <List component="div" disablePadding sx={{ pl: 2 }}>
            {item.children.map((child, index) => (
              <NestedListItem key={index} drawerOpen={drawerOpen} item={child} />
            ))}
          </List>
        </Collapse>
      )}
    </>
  );
};

export default NestedList;
