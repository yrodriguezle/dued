import React, { Suspense, useMemo } from "react";
import { Navigate, Route, Routes } from "react-router";
import { isAuthenticated } from "../common/authentication/auth";
import Layout from "../components/layout/Layout";
import { Fallback, routesMapping } from "./routesMapping";
import useStore from "../store/useStore";

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
          .filter((menu) => menu?.path)
          .map((menu) => {
            const routePath = menu?.path.replace("/gestionale/", "") || "/";
            const element = routesMapping.find(({ path }) => path === menu?.path)?.element;
            return <Route key={menu?.path} path={routePath} element={element} />;
          })}
        <Route index element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}

export default ProtectedRoutes;
