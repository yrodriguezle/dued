 
import { Navigate, Route, RouterProvider, createBrowserRouter, createRoutesFromElements } from "react-router-dom";
import Root from "./routes/Root";
import ErrorPage from "./routes/ErrorPage";
import FallbackLoader from "./common/fallbackLoader/FallbackLoader";
import ProtectedRoutes from "./routes/ProtectedRoutes";
import { protectedLoader } from "./routes/protectedLoader";
import LoginPage from "./components/pages/LoginPage";
import publicLoader from "./routes/publicLoader";

function App() {
  return (
    <RouterProvider
      router={createBrowserRouter(
        createRoutesFromElements(
          <Route path="/" element={<Root />} errorElement={<ErrorPage />}>
            <Route path="/gestionale/*" element={<ProtectedRoutes />} loader={protectedLoader} />
            <Route path="/login" element={<LoginPage />} loader={publicLoader} />
            <Route path="*" element={<Navigate to={"/gestionale"} replace />} />
            <Route path="/" element={<Navigate to={"/gestionale"} replace />} />
          </Route>,
        ),
      )}
      fallbackElement={FallbackLoader}
    />
  )
}

export default App
