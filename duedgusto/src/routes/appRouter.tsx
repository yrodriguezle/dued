import { createBrowserRouter, createRoutesFromElements, Route, Navigate } from "react-router";
import React, { Suspense } from "react";
import Root from "./Root";
import ProtectedRoutes from "./ProtectedRoutes";
import { Fallback } from "./RoutesFallback";

const SignInPage = React.lazy(() => import("../components/pages/SignInPage"));

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route
      path="/"
      element={<Root />}
    >
      <Route
        path="gestionale/*"
        element={<ProtectedRoutes />}
      />
      <Route
        path="signin"
        element={
          <Suspense fallback={<Fallback />}>
            <SignInPage />
          </Suspense>
        }
      />
      <Route
        path="*"
        element={<Navigate
          to="/gestionale"
          replace
        />}
      />
      <Route
        index
        element={<Navigate
          to="/gestionale"
          replace
        />}
      />
    </Route>
  )
);

export default router;
