import { Navigate, Route, Routes } from "react-router";
import Root from "./routes/Root";
import ProtectedRoutes from "./routes/ProtectedRoutes";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Root />}>
        <Route path="/gestionale/*" element={<ProtectedRoutes />} />
        <Route path="login" element={<div>login</div>} />

        <Route path="*" element={<Navigate to={"/gestionale"} replace />} />
        <Route path="/" element={<Navigate to={"/gestionale"} replace />} />
      </Route>
    </Routes>
  );
}

export default App;
