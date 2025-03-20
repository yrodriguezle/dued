import { Navigate, Outlet, Route, Routes } from "react-router";
import { isAuthenticated } from "../common/authentication/auth";

const Layout = () => (
  <div>
    <div>Layout</div>
    <Outlet />
  </div>
);

const HomePage = () => <div>HomePage</div>;

function ProtectedRoutes() {
  if (!isAuthenticated()) {
    return <Navigate to={"/login"} replace />;
  }
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
      </Route>
    </Routes>
  );
}

export default ProtectedRoutes;
