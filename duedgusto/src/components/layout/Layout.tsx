import { useState } from "react";
import { Outlet } from "react-router";
import { Box } from "@mui/material";

import useBootstrap from "../authentication/useBootstrap";
import HeaderBar from "./headerBar/HeaderBar";
import Sidebar from "./sideBar/Sidebar";

function Layout() {
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [headerHeight, setHeaderHeight] = useState(64);
  const toggleDrawer = () => {
    setDrawerOpen((prev) => !prev);
  };

  useBootstrap();

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
        <Sidebar open={drawerOpen} />
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
