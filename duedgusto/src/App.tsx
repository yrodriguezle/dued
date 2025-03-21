import { Navigate, Route, Routes } from "react-router";
import Root from "./routes/Root";
import ProtectedRoutes from "./routes/ProtectedRoutes";
import SignInPage from "./components/pages/SignInPage";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Root />}>
        <Route path="/gestionale/*" element={<ProtectedRoutes />} />
        <Route path="signin" element={<SignInPage />} />

        <Route path="*" element={<Navigate to={"/gestionale"} replace />} />
        <Route path="/" element={<Navigate to={"/gestionale"} replace />} />
      </Route>
    </Routes>
  );
}

export default App;
