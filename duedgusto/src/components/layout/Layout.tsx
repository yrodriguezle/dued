import { useState } from "react";
import { Outlet } from "react-router";
import Box from "@mui/material/Box";
import { useTheme } from "@mui/material";

import HeaderBar from "./headerBar/HeaderBar";
import Sidebar from "./sideBar/Sidebar";
import useSideBar from "./sideBar/useSideBar";

function Layout() {
  const [headerHeight, setHeaderHeight] = useState(64);
  const theme = useTheme();
  const { drawerOpen, drawerSwipeable, mobileDrawerOpen, toggleDrawer, setMobileDrawerOpen, onCloseSwipeable, onListItemClick } = useSideBar();

  return (
    <Box sx={{ height: "100vh", overflow: "hidden" }}>
      <HeaderBar drawerOpen={drawerOpen} setHeaderHeight={setHeaderHeight} toggleDrawer={toggleDrawer} />
      <Box
        sx={{
          display: "flex",
          marginTop: `${headerHeight}px`,
          transition: "margin 0.3s",
          height: `calc(100vh - ${headerHeight}px)`,
          overflow: "hidden",
        }}
      >
        <Sidebar
          drawerOpen={drawerOpen}
          drawerSwipeable={drawerSwipeable}
          mobileDrawerOpen={mobileDrawerOpen}
          setMobileDrawerOpen={setMobileDrawerOpen}
          onListItemClick={onListItemClick}
          onCloseSwipeable={onCloseSwipeable}
        />
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            minWidth: 0,
            overflow: "auto",
            transition: "margin 0.3s",
            backgroundColor: theme.palette.mode === "dark" ? "transparent" : theme.palette.grey[100],
          }}
        >
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}

export default Layout;
