import { useEffect } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router";

import Root from "./routes/Root";
import ProtectedRoutes from "./routes/ProtectedRoutes";
import SignInPage from "./components/pages/SignInPage";
import { setNavigator } from "./common/navigator/navigator";
import useBootstrap from "./components/authentication/useBootstrap";

function App() {
  const navigate = useNavigate();
  useEffect(() => {
    setNavigator(navigate);
  }, [navigate]);

  useBootstrap();

  return (
    <Routes>
      <Route path="/" element={<Root />}>
        <Route path="gestionale/*" element={<ProtectedRoutes />} />
        <Route path="signin" element={<SignInPage />} />

        <Route path="*" element={<Navigate to={"/gestionale"} replace />} />
        <Route path="/" element={<Navigate to={"/gestionale"} replace />} />
      </Route>
    </Routes>
  );
}

export default App;
