/**
 * Router Test Wrapper
 *
 * Fornisce un wrapper MemoryRouter per testare componenti
 * che dipendono da React Router (useNavigate, useLocation, ecc.)
 */
import { ReactNode } from "react";
import { MemoryRouter } from "react-router";

interface RouterTestWrapperProps {
  initialEntries?: string[];
  children: ReactNode;
}

/**
 * Wrapper MemoryRouter per i test.
 * Avvolge i children in un MemoryRouter con le entries iniziali fornite.
 */
export const RouterTestWrapper = ({ initialEntries = ["/"], children }: RouterTestWrapperProps) => (
  <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
);

/**
 * Factory per creare un wrapper MemoryRouter come componente wrapper
 * compatibile con renderHook di @testing-library/react.
 */
// eslint-disable-next-line react-refresh/only-export-components
export const createRouterWrapper =
  (initialEntries: string[] = ["/"]) =>
  ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
  );

export default RouterTestWrapper;
