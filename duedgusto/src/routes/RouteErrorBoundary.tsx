import { ReactNode } from "react";
import { useLocation } from "react-router";
import ErrorBoundary from "../components/common/ErrorBoundary";

interface RouteErrorBoundaryProps {
  children: ReactNode;
}

// Boundary per-route: contiene il crash di una pagina nella sola area contenuto
// (la shell — sidebar/header — resta montata) e azzera lo stato di errore al
// cambio di pathname via resetKey (NO key={pathname}: il remount forzato
// romperebbe le route parametriche come cassa/details/:date).
function RouteErrorBoundary({ children }: RouteErrorBoundaryProps) {
  const location = useLocation();
  return (
    <ErrorBoundary
      variant="inline"
      resetKey={location.pathname}
    >
      {children}
    </ErrorBoundary>
  );
}

export default RouteErrorBoundary;
