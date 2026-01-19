import SwipeableDrawer from "@mui/material/SwipeableDrawer";

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

  const renderDrawer = useCallback(
    (open: boolean) => (
      <Drawer variant="permanent" open={open}>
        <div style={{ marginTop: `50px` }}></div>
        <NestedList items={menuItems} drawerOpen={open} onListItemClick={onListItemClick} />
      </Drawer>
    ),
    [menuItems, onListItemClick]
  );

  return drawerSwipeable ? (
    <SwipeableDrawer open={mobileDrawerOpen} onOpen={() => setMobileDrawerOpen(true)} onClose={onCloseSwipeable} disableBackdropTransition={!iOS} disableDiscovery={iOS}>
      {renderDrawer(true)}
    </SwipeableDrawer>
  ) : (
    renderDrawer(drawerOpen)
  );
}

export default Sidebar;
