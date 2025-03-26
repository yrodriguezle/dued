import IconButton from "@mui/material/IconButton";
import MenuIcon from "@mui/icons-material/Menu";
import MenuOpenIcon from "@mui/icons-material/MenuOpen";

interface DrawerMenuButtonProps {
  drawerOpen: boolean;
  toggleDrawer: () => void;
}

function DrawerMenuButton({ drawerOpen, toggleDrawer }: DrawerMenuButtonProps) {
  return <IconButton onClick={toggleDrawer}>{drawerOpen ? <MenuOpenIcon /> : <MenuIcon />}</IconButton>;
}

export default DrawerMenuButton;
