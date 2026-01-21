import React, { Suspense, useMemo } from "react";
import { Navigate, Route, Routes } from "react-router";
import { isAuthenticated } from "../common/authentication/auth";
import Layout from "../components/layout/Layout";
import { Fallback } from "./RoutesFallback";
import useStore from "../store/useStore";
import { loadDynamicComponent } from "./dynamicComponentLoader";

const HomePage = React.lazy(() => import("../components/pages/dashboard/HomePage.tsx"));

function ProtectedRoutes() {
  const utente = useStore((store) => store.utente);
  const inProgressGlobal = useStore((store) => store.inProgress.global);
  const menuRoutes = useMemo(() => utente?.menus || [], [utente?.menus]);

  if (!isAuthenticated()) {
    return <Navigate to={"/signin"} replace />;
  }

  // Wait for utente data to load before rendering routes
  if (inProgressGlobal || !utente) {
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
          .filter((menu) => menu?.percorso && menu?.percorsoFile)
          .map((menu) => {
            // Convert /gestionale/cassa/details to cassa/details and support dynamic routes
            const routePath = menu?.percorso.replace("/gestionale/", "") || "/";
            // Support routes with parameters: /gestionale/cassa/details -> cassa/:date
            const finalPath = routePath === "cassa/details" ? "cassa/:date" : routePath;
            const DynamicComponent = loadDynamicComponent(menu?.percorsoFile || "");

            return (
              <Route
                key={menu?.percorso}
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
