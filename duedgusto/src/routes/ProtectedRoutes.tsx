import React, { Suspense, useMemo } from "react";
import { Navigate, Route, Routes } from "react-router";
import { isAuthenticated } from "../common/authentication/auth";
import Layout from "../components/layout/Layout";
import { Fallback } from "./routesMapping";
import useStore from "../store/useStore";
import { loadDynamicComponent } from "./dynamicComponentLoader";

const HomePage = React.lazy(() => import("../components/pages/HomePage.tsx"));

function ProtectedRoutes() {
  const user = useStore((store) => store.user);
  const menuRoutes = useMemo(() => user?.menus || [], [user?.menus]);

  if (!isAuthenticated()) {
    return <Navigate to={"/signin"} replace />;
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route
          index
          element={
            <Suspense fallback={<Fallback />}>
              <HomePage />
            </Suspense>
          }
        />
        {menuRoutes
          .filter((menu) => menu?.path && menu?.filePath)
          .map((menu) => {
            const routePath = menu?.path.replace("/gestionale/", "") || "/";
            const DynamicComponent = loadDynamicComponent(menu?.filePath || "");

            return (
              <Route
                key={menu?.path}
                path={routePath}
                element={
                  <Suspense fallback={<Fallback />}>
                    <DynamicComponent />
                  </Suspense>
                }
              />
            );
          })}
        <Route index element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}

export default ProtectedRoutes;
