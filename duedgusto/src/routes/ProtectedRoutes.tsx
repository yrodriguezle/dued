import { Navigate, Route, Routes } from "react-router";
import { isAuthenticated } from "../common/authentication/auth";
import Layout from "../components/layout/Layout";

const HomePage = () => <div>HomePage</div>;

function ProtectedRoutes() {
  if (!isAuthenticated()) {
    return <Navigate to={"/signin"} replace />;
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
