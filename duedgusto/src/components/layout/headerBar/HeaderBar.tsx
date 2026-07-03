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
        <Box sx={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
          <LogoSection variant="h6" />
          {!drawerOpen && appVersion && (
            <Typography
              component="span"
              data-testid="app-version-badge"
              sx={{
                fontSize: "0.6rem",
                lineHeight: 1.4,
                px: 0.5,
                mt: "-4px",
                borderRadius: 1,
                bgcolor: "action.selected",
                color: "inherit",
                opacity: 0.95,
              }}
            >
              v{appVersion}
            </Typography>
          )}
        </Box>
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
