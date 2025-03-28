import DashboardIcon from "@mui/icons-material/Dashboard";
import GroupIcon from "@mui/icons-material/Group";

import Drawer from "./Drawer";
import NestedList, { MenuItem } from "./NestedList";
import logger from "../../../common/logger/logger";

export const drawerWidth = 240;

const menuItems: MenuItem[] = [
  {
    label: "Dashboard",
    icon: <DashboardIcon />,
    path: "/gestionale",
    onClick: () => logger.log("Dashboard cliccato"),
  },
  {
    label: "Utenti",
    icon: <GroupIcon />,
    children: [
      {
        label: "Profilo",
        // icon: <DashboardIcon />,
        onClick: () => logger.log("Profilo cliccato"),
      },
      {
        label: "Sicurezza",
        // icon: <DashboardIcon />,
        onClick: () => logger.log("Sicurezza cliccato"),
      },
    ],
  },
  // {
  //   label: "Report",
  //   icon: <DashboardIcon />,
  //   children: [
  //     {
  //       label: "Settimanale",
  //       icon: <DashboardIcon />,
  //       children: [
  //         { label: "Gennaio", icon: <DashboardIcon />, onClick: () => logger.log("Gennaio") },
  //         { label: "Febbraio", icon: <DashboardIcon />, onClick: () => logger.log("Febbraio") },
  //       ],
  //     },
  //   ],
  // },
];

interface SidebarProps {
  drawerOpen: boolean;
}

function Sidebar({ drawerOpen }: SidebarProps) {
  return (
    <Drawer variant="permanent" open={drawerOpen}>
      <div style={{ marginTop: `50px` }}></div>
      <NestedList drawerOpen={drawerOpen} items={menuItems} />
    </Drawer>
  );
}

export default Sidebar;
