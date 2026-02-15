import React, { Suspense, useMemo } from "react";
import { Navigate, Route, Routes } from "react-router";
import { isAuthenticated } from "../common/authentication/auth";
import Layout from "../components/layout/Layout";
import { Fallback } from "./RoutesFallback";
import useStore from "../store/useStore";
import { loadDynamicComponent } from "./dynamicComponentLoader";

const HomePage = React.lazy(() => import("../components/pages/dashboard/HomePage.tsx"));
const MonthlyClosureDetails = React.lazy(() => import("../components/pages/registrazioneCassa/MonthlyClosureDetails.tsx"));
const CashRegisterMonthlyPage = React.lazy(() => import("../components/pages/registrazioneCassa/CashRegisterMonthlyPage.tsx"));
const CashRegisterDetails = React.lazy(() => import("../components/pages/registrazioneCassa/CashRegisterDetails.tsx"));

function ProtectedRoutes() {
  const utente = useStore((store) => store.utente);
  const inProgressGlobal = useStore((store) => store.inProgress.global);
  const getNextOperatingDate = useStore((store) => store.getNextOperatingDate);
  const menuRoutes = useMemo(() => utente?.menus || [], [utente?.menus]);

  if (!isAuthenticated()) {
    return <Navigate to={"/signin"} replace />;
  }

  // Wait for utente data to load before rendering routes
  if (inProgressGlobal || !utente) {
    return <Fallback />;
  }

  const cassaRedirectDate = getNextOperatingDate();
  const cassaRedirectPath = `/gestionale/cassa/${cassaRedirectDate.getFullYear()}-${String(cassaRedirectDate.getMonth() + 1).padStart(2, "0")}-${String(cassaRedirectDate.getDate()).padStart(2, "0")}`;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="dashboard" element={
          <Suspense fallback={<Fallback />}>
            <HomePage />
          </Suspense>
        } />
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="cassa/details" element={<Navigate to={cassaRedirectPath} replace />} />
        <Route path="cassa/monthly" element={
          <Suspense fallback={<Fallback />}>
            <CashRegisterMonthlyPage />
          </Suspense>
        } />
        <Route path="cassa/monthly-closure/new" element={
          <Suspense fallback={<Fallback />}>
            <MonthlyClosureDetails />
          </Suspense>
        } />
        <Route path="cassa/monthly-closure/:id" element={
          <Suspense fallback={<Fallback />}>
            <MonthlyClosureDetails />
          </Suspense>
        } />
        <Route path="cassa/:date" element={
          <Suspense fallback={<Fallback />}>
            <CashRegisterDetails />
          </Suspense>
        } />
        {menuRoutes
          .filter((menu) => menu?.percorso && menu?.percorsoFile)
          .map((menu) => {
            // Convert /gestionale/cassa/details to cassa/details and support dynamic routes
            const routePath = menu?.percorso.replace("/gestionale/", "") || "/";
            // Skip cassa/details - handled by dedicated redirect route above
            if (routePath === "cassa/details") return null;
            const finalPath = routePath;
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
