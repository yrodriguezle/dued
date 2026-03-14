/**
 * Data Router Test Wrapper
 *
 * Fornisce un wrapper createMemoryRouter + RouterProvider per testare componenti
 * che dipendono dal Data Router context (useBlocker, useLoaderData, ecc.)
 *
 * Il routerTestWrapper.tsx standard usa MemoryRouter che non supporta queste API.
 */
import { ReactNode } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";

interface DataRouterTestWrapperProps {
  initialEntries?: string[];
  children: ReactNode;
}

/**
 * Wrapper Data Router per i test.
 * Crea un router con createMemoryRouter e lo renderizza con RouterProvider.
 * Supporta useBlocker e altre API del data router.
 */
export const DataRouterTestWrapper = ({ initialEntries = ["/"], children }: DataRouterTestWrapperProps) => {
  const router = createMemoryRouter(
    [
      {
        path: "*",
        element: children,
      },
    ],
    { initialEntries }
  );

  return <RouterProvider router={router} />;
};

/**
 * Factory per creare un wrapper Data Router compatibile con renderHook.
 */
// eslint-disable-next-line react-refresh/only-export-components
export const createDataRouterWrapper =
  (initialEntries: string[] = ["/"]) =>
  ({ children }: { children: ReactNode }) => {
    const router = createMemoryRouter(
      [
        {
          path: "*",
          element: children,
        },
      ],
      { initialEntries }
    );

    return <RouterProvider router={router} />;
  };

export default DataRouterTestWrapper;
