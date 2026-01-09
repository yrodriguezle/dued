import React, { Suspense, useMemo } from "react";
import { Navigate, Route, Routes } from "react-router";
import { isAuthenticated } from "../common/authentication/auth";
import Layout from "../components/layout/Layout";
import { Fallback } from "./RoutesFallback";
import useStore from "../store/useStore";
import { loadDynamicComponent } from "./dynamicComponentLoader";

const HomePage = React.lazy(() => import("../components/pages/dashboard/HomePage.tsx"));

function ProtectedRoutes() {
  const user = useStore((store) => store.user);
  const inProgress = useStore((store) => store.inProgress);
  const menuRoutes = useMemo(() => user?.menus || [], [user?.menus]);

  if (!isAuthenticated()) {
    return <Navigate to={"/signin"} replace />;
  }

  // Wait for user data to load before rendering routes
  if (inProgress.global || !user) {
    return <Fallback />;
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="dashboard" element={
          <Suspense fallback={<Fallback />}>
            <HomePage />
          </Suspense>
        } />
        <Route index element={<Navigate to="dashboard" replace />} />
        {menuRoutes
          .filter((menu) => menu?.path && menu?.filePath)
          .map((menu) => {
            // Convert /gestionale/cassa/details to cassa/details and support dynamic routes
            const routePath = menu?.path.replace("/gestionale/", "") || "/";
            // Support routes with parameters: /gestionale/cassa/details -> cassa/:id
            const finalPath = routePath === "cassa/details" ? "cassa/:id" : routePath;
            const DynamicComponent = loadDynamicComponent(menu?.filePath || "");

            return (
              <Route
                key={menu?.path}
                path={finalPath}
                element={
                  <Suspense fallback={<Fallback />}>
                    <DynamicComponent />
                  </Suspense>
                }
              />
            );
          })}
        <Route path="*" element={<Navigate to="/gestionale/dashboard" replace />} />
      </Route>
    </Routes>
  );
}

export default ProtectedRoutes;
