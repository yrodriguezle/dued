import { useEffect, useState } from "react";
import { useMediaQuery, useTheme } from "@mui/material";
import { getDrawerOpen, setDrawerOpen } from "../../../common/ui/drawer";

function useSideBar() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [drawerSwipeable, setDrawerSwipeable] = useState(isMobile);
  const [drawerOpen, setOpen] = useState(getDrawerOpen());
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const toggleDrawer = () => {
    if (drawerSwipeable) {
      setMobileDrawerOpen((prev) => !prev);
    } else {
      setOpen((prev) => {
        setTimeout(() => setDrawerOpen(!prev), 0);
        return !prev;
      });
    }
  };

  const onListItemClick = (hasChildren: boolean) => {
    if (drawerSwipeable) {
      if (!hasChildren) {
        setMobileDrawerOpen((prev) => !prev);
        if (!isMobile) {
          setDrawerSwipeable(false);
        }
      }
    } else if (!drawerOpen) {
      setDrawerSwipeable(true);
      setMobileDrawerOpen((prev) => !prev);
    }
  };

  const onCloseSwipeable = () => {
    if (!isMobile) {
      setDrawerSwipeable(false);
    }
    setMobileDrawerOpen(false)
  };

  useEffect(() => {
    if (isMobile) {
      setDrawerSwipeable(true);
    }
  }, [isMobile])

  useEffect(() => {
    if (drawerSwipeable) {
      setOpen(false);
      setTimeout(() => {
        setDrawerOpen(false);
      }, 0);
    }
  }, [drawerSwipeable]);

  return {
    drawerOpen,
    drawerSwipeable,
    mobileDrawerOpen,
    toggleDrawer,
    setMobileDrawerOpen,
    onListItemClick,
    onCloseSwipeable,
  };
}

export default useSideBar