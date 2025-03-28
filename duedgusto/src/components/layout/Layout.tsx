import { useEffect, useState } from "react";
import { Outlet } from "react-router";
import { Box, useMediaQuery, useTheme } from "@mui/material";
import SwipeableDrawer from "@mui/material/SwipeableDrawer";

import useBootstrap from "../authentication/useBootstrap";
import HeaderBar from "./headerBar/HeaderBar";
import Sidebar from "./sideBar/Sidebar";
import { getDrawerOpen, setDrawerOpen } from "../../common/ui/drawer";

const iOS = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);

function Layout() {
  useBootstrap();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [drawerOpen, setOpen] = useState(getDrawerOpen());
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(64);

  const toggleDrawer = () => {
    if (isMobile) {
      setMobileDrawerOpen((prev) => !prev);
    } else {
      setOpen((prev) => {
        setTimeout(() => setDrawerOpen(!prev), 0);
        return !prev;
      });
    }
  };

  useEffect(() => {
    if (isMobile) {
      setOpen(false);
      setTimeout(() => {
        setDrawerOpen(false);
      }, 0);
    }
  }, [isMobile]);

  return (
    <Box>
      <HeaderBar drawerOpen={drawerOpen} setHeaderHeight={setHeaderHeight} toggleDrawer={toggleDrawer} />
      <Box
        sx={{
          display: "flex",
          marginTop: `${headerHeight}px`,
          transition: "margin 0.3s",
          height: `calc(100vh - ${headerHeight}px)`,
        }}
      >
        {isMobile ? (
          <SwipeableDrawer open={mobileDrawerOpen} onOpen={() => setMobileDrawerOpen(true)} onClose={() => setMobileDrawerOpen(false)} disableBackdropTransition={!iOS} disableDiscovery={iOS}>
            <Sidebar drawerOpen={true} />
          </SwipeableDrawer>
        ) : (
          <Sidebar drawerOpen={drawerOpen} />
        )}
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            transition: "margin 0.3s",
            padding: 2,
          }}
        >
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}

export default Layout;
