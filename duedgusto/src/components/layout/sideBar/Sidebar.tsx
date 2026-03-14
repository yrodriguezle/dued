import SwipeableDrawer from "@mui/material/SwipeableDrawer";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";

import Drawer from "./Drawer";
import NestedList, { MenuItem } from "./NestedList";
import { useCallback, useMemo } from "react";
import useStore from "../../../store/useStore";
import createDataTree from "../../../common/ui/createDataTree";

export const drawerWidth = 240;

interface SidebarProps {
  drawerOpen: boolean;
  drawerSwipeable: boolean;
  mobileDrawerOpen: boolean;
  setMobileDrawerOpen: (mobileOpen: boolean) => void;
  onListItemClick: (hasChildren: boolean) => void;
  onCloseSwipeable: () => void;
}

const iOS = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);

function Sidebar({ drawerOpen, drawerSwipeable, mobileDrawerOpen, setMobileDrawerOpen, onListItemClick, onCloseSwipeable }: SidebarProps) {
  const utente = useStore((store) => store.utente);

  const menuItems: MenuItem[] = useMemo(() => {
    if (!utente || !utente?.menus) return [];
    const { menus } = utente;
    return createDataTree(menus);
  }, [utente]);

  const appVersion = (window as Global).appVersion;

  const renderDrawer = useCallback(
    (open: boolean) => (
      <Drawer
        variant="permanent"
        open={open}
      >
        <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
          <Box sx={{ flexShrink: 0, height: 50 }} />
          <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden" }}>
            <NestedList
              items={menuItems}
              drawerOpen={open}
              onListItemClick={onListItemClick}
            />
          </Box>
          {open && appVersion && (
            <Typography
              variant="caption"
              sx={{ p: 1, textAlign: "center", color: "text.secondary" }}
            >
              v{appVersion}
            </Typography>
          )}
        </Box>
      </Drawer>
    ),
    [menuItems, onListItemClick, appVersion]
  );

  return drawerSwipeable ? (
    <SwipeableDrawer
      open={mobileDrawerOpen}
      onOpen={() => setMobileDrawerOpen(true)}
      onClose={onCloseSwipeable}
      disableBackdropTransition={!iOS}
      disableDiscovery={iOS}
    >
      {renderDrawer(true)}
    </SwipeableDrawer>
  ) : (
    renderDrawer(drawerOpen)
  );
}

export default Sidebar;
