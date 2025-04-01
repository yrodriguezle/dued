import React, { Suspense } from "react";
import Backdrop from "@mui/material/Backdrop";
import CircularProgress from "@mui/material/CircularProgress";

export const Fallback = () => {
  return (
    <Backdrop open={true} sx={{ color: "#fff", zIndex: (theme) => theme.zIndex.drawer + 1 }}>
      <CircularProgress color="inherit" />
    </Backdrop>
  );
};

const SettingsDetails = React.lazy(() => import("../components/pages/settings/SettingsDetails.tsx"));
const UserList = React.lazy(() => import("../components/pages/users/UserList.tsx"));
const UserDetails = React.lazy(() => import("../components/pages/users/UserDetails.tsx"));
const RoleList = React.lazy(() => import("../components/pages/roles/RoleList.tsx"));
const RoleDetails = React.lazy(() => import("../components/pages/roles/RoleDetails.tsx"));
const MenuList = React.lazy(() => import("../components/pages/menu/MenuList.tsx"));
const MenuDetails = React.lazy(() => import("../components/pages/menu/MenuDetails.tsx"));

// eslint-disable-next-line react-refresh/only-export-components
export const routesMapping = [
  {
    path: "/gestionale/settings",
    element: (
      <Suspense fallback={<Fallback />}>
        <SettingsDetails />
      </Suspense>
    ),
  },
  {
    path: "/gestionale/users-list",
    element: (
      <Suspense fallback={<Fallback />}>
        <UserList />
      </Suspense>
    ),
  },
  {
    path: "/gestionale/users-details",
    element: (
      <Suspense fallback={<Fallback />}>
        <UserDetails />
      </Suspense>
    ),
  },
  {
    path: "/gestionale/roles-list",
    element: (
      <Suspense fallback={<Fallback />}>
        <RoleList />
      </Suspense>
    ),
  },
  {
    path: "/gestionale/roles-details",
    element: (
      <Suspense fallback={<Fallback />}>
        <RoleDetails />
      </Suspense>
    ),
  },
  {
    path: "/gestionale/menus-list",
    element: (
      <Suspense fallback={<Fallback />}>
        <MenuList />
      </Suspense>
    ),
  },
  {
    path: "/gestionale/menus-details",
    element: (
      <Suspense fallback={<Fallback />}>
        <MenuDetails />
      </Suspense>
    ),
  },
];
