import { useEffect, useState } from "react";
import { Outlet } from "react-router";
import { Box, useMediaQuery, useTheme } from "@mui/material";

import useBootstrap from "../authentication/useBootstrap";
import HeaderBar from "./headerBar/HeaderBar";
import Sidebar from "./sideBar/Sidebar";
import { getDrawerOpen, setDrawerOpen } from "../../common/ui/drawer";

function Layout() {
  useBootstrap();
  const [drawerOpen, setOpen] = useState(getDrawerOpen());
  const [headerHeight, setHeaderHeight] = useState(64);

  const toggleDrawer = () => {
    setOpen((prev) => {
      setTimeout(() => {
        setDrawerOpen(!prev);
      }, 0);
      return !prev;
    });
  };
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

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
        <Sidebar drawerOpen={drawerOpen} />
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
