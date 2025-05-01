import { useLayoutEffect, useRef } from "react";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Toolbar from "@mui/material/Toolbar";

import LogoSection from "../../common/logo/LogoSection";
import ThemeMenuButton from "../headerBar/ThemeMenuButton";
import ProfileMenuButton from "../headerBar/ProfileMenuButton";
import DrawerMenuButton from "./DrawerMenuButton";
import HeaderViewTitle from "./HeaderViewTitle";

interface HeaderBarProps {
  drawerOpen: boolean;
  setHeaderHeight: (height: number) => void;
  toggleDrawer: () => void;
}

function HeaderBar({ drawerOpen, setHeaderHeight, toggleDrawer }: HeaderBarProps) {
  const ref = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    if (ref.current) {
      setHeaderHeight(ref.current.clientHeight);
    }
  }, [setHeaderHeight]);

  return (
    <AppBar
      ref={ref}
      position="fixed"
      sx={{
        paddingLeft: "10px",
        paddingRight: "10px",
        zIndex: (theme) => theme.zIndex.drawer + 1,
      }}
    >
      <Toolbar disableGutters variant="dense">
        <DrawerMenuButton drawerOpen={drawerOpen} toggleDrawer={toggleDrawer} />
        <LogoSection variant="h6" />
        <HeaderViewTitle />
        <Box sx={{ marginLeft: "auto" }}>
          <ThemeMenuButton />
          <ProfileMenuButton />
        </Box>
      </Toolbar>
    </AppBar>
  );
}

export default HeaderBar;
