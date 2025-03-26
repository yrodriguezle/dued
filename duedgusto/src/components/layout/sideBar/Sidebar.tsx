import DashboardIcon from "@mui/icons-material/Dashboard";

import Drawer from "./Drawer";
import NestedList, { MenuItem } from "./NestedList";
import logger from "../../../common/logger/logger";

export const drawerWidth = 240;

const menuItems: MenuItem[] = [
  {
    label: "Dashboard",
    icon: <DashboardIcon />,
    onClick: () => logger.log("Dashboard cliccato"),
  },
  {
    label: "Utenti",
    icon: <DashboardIcon />,
    children: [
      { label: "Profilo", icon: <DashboardIcon />, onClick: () => logger.log("Profilo cliccato") },
      { label: "Sicurezza", icon: <DashboardIcon />, onClick: () => logger.log("Sicurezza cliccato") },
    ],
  },
  {
    label: "Report",
    icon: <DashboardIcon />,
    children: [
      {
        label: "Settimanale",
        icon: <DashboardIcon />,
        children: [
          { label: "Gennaio", icon: <DashboardIcon />, onClick: () => logger.log("Gennaio") },
          { label: "Febbraio", icon: <DashboardIcon />, onClick: () => logger.log("Febbraio") },
        ],
      },
    ],
  },
];

interface SidebarProps {
  drawerOpen: boolean;
}

function Sidebar({ drawerOpen }: SidebarProps) {
  return (
    <Drawer variant="permanent" open={drawerOpen}>
      <div style={{ marginTop: `42px` }}></div>
      <NestedList drawerOpen={drawerOpen} items={menuItems} />
      {/* <List>
        {["Inbox", "Starred", "Send email", "Drafts"].map((text, index) => (
          <ListItem key={text} disablePadding sx={{ display: "block" }}>
            <ListItemButton
              sx={[
                {
                  minHeight: 48,
                  px: 2.5,
                },
                open ? { justifyContent: "initial" } : { justifyContent: "center" },
              ]}
            >
              <ListItemIcon
                sx={[
                  {
                    minWidth: 0,
                    justifyContent: "center",
                  },
                  open
                    ? {
                        mr: 3,
                      }
                    : {
                        mr: "auto",
                      },
                ]}
              >
                {index % 2 === 0 ? <InboxIcon /> : <MailIcon />}
              </ListItemIcon>
              <ListItemText
                primary={text}
                sx={[
                  open
                    ? {
                        opacity: 1,
                      }
                    : {
                        opacity: 0,
                      },
                ]}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <Divider />
      <List>
        {["All mail", "Trash", "Spam"].map((text, index) => (
          <ListItem key={text} disablePadding sx={{ display: "block" }}>
            <ListItemButton
              sx={[
                {
                  minHeight: 48,
                  px: 2.5,
                },
                open
                  ? {
                      justifyContent: "initial",
                    }
                  : {
                      justifyContent: "center",
                    },
              ]}
            >
              <ListItemIcon
                sx={[
                  {
                    minWidth: 0,
                    justifyContent: "center",
                  },
                  open
                    ? {
                        mr: 3,
                      }
                    : {
                        mr: "auto",
                      },
                ]}
              >
                {index % 2 === 0 ? <InboxIcon /> : <MailIcon />}
              </ListItemIcon>
              <ListItemText
                primary={text}
                sx={[
                  open
                    ? {
                        opacity: 1,
                      }
                    : {
                        opacity: 0,
                      },
                ]}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List> */}
    </Drawer>
  );
}

export default Sidebar;
