import { useLayoutEffect, useRef } from "react";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";

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
  const appVersion = (window as Global).appVersion;

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
      <Toolbar
        disableGutters
        variant="dense"
        sx={{ minWidth: 0 }}
      >
        <DrawerMenuButton
          drawerOpen={drawerOpen}
          toggleDrawer={toggleDrawer}
        />
        <LogoSection variant="h6" />
        {!drawerOpen && appVersion && (
          <Typography
            variant="caption"
            sx={{ ml: 1, color: "inherit", opacity: 0.7, flexShrink: 0, alignSelf: "flex-end", pb: 0.5 }}
          >
            v{appVersion}
          </Typography>
        )}
        <HeaderViewTitle />
        <Box sx={{ marginLeft: "auto", flexShrink: 0 }}>
          <ThemeMenuButton />
          <ProfileMenuButton />
        </Box>
      </Toolbar>
    </AppBar>
  );
}

export default HeaderBar;
