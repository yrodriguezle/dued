import { useState } from "react";
import {
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Tooltip,
} from "@mui/material";
import ContrastIcon from "@mui/icons-material/Contrast";
import LightModeIcon from "@mui/icons-material/LightMode";
import BrightnessMediumIcon from "@mui/icons-material/BrightnessMedium";
import DarkModeIcon from "@mui/icons-material/DarkMode";

import useStore from "../../../store/useStore";

function ThemeMenuButton() {
  const { userTheme, changeTheme } = useStore((store) => store);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleChangeTheme = (theme: ThemeMode) => {
    setAnchorEl(null);
    changeTheme(theme);
  };

  return (
    <>
      <Tooltip title="Tema">
        <IconButton onClick={handleClick} sx={{ p: 0, mr: "10px" }}>
          <ContrastIcon />
        </IconButton>
      </Tooltip>
      <Menu
        id="theme-menu"
        anchorEl={anchorEl}
        open={!!anchorEl}
        onClose={() => setAnchorEl(null)}
      >
        <MenuItem
          onClick={() => handleChangeTheme("light")}
          selected={userTheme.mode === "light"}
        >
          <ListItemIcon>
            <LightModeIcon fontSize="small" />
          </ListItemIcon>
          Chiaro
        </MenuItem>
        <MenuItem
          onClick={() => handleChangeTheme("default")}
          selected={userTheme.mode === "default"}
        >
          <ListItemIcon>
            <BrightnessMediumIcon fontSize="small" />
          </ListItemIcon>
          Sistema
        </MenuItem>
        <MenuItem
          onClick={() => handleChangeTheme("dark")}
          selected={userTheme.mode === "dark"}
        >
          <ListItemIcon>
            <DarkModeIcon fontSize="small" />
          </ListItemIcon>
          Oscuro
        </MenuItem>
      </Menu>
    </>
  );
}

export default ThemeMenuButton;
