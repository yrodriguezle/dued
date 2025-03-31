import SwipeableDrawer from "@mui/material/SwipeableDrawer";

import Drawer from "./Drawer";
import NestedList, { MenuItem } from "./NestedList";
import { useCallback, useMemo } from "react";
import useStore from "../../../store/useStore";
import createDataTree from "../../../common/ui/createDataTree";

export const drawerWidth = 240;

// const menuItems: MenuItem[] = [
//   {
//     label: "Dashboard",
//     icon: <DashboardIcon />,
//     path: "/gestionale",
//     onClick: () => logger.log("Dashboard cliccato"),
//   },
//   {
//     label: "Utenti",
//     icon: <GroupIcon />,
//     children: [
//       {
//         label: "Profilo",
//         onClick: () => logger.log("Profilo cliccato"),
//       },
//       {
//         label: "Sicurezza",
//         onClick: () => logger.log("Sicurezza cliccato"),
//       },
//     ],
//   },
// ];

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
  const user = useStore((store) => store.user);

  const menuItems: MenuItem[] = useMemo(() => {
    if (!user || !user?.menus) return [];
    const { menus } = user;
    return createDataTree(menus);
  }, [user]);

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
