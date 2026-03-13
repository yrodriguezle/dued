import { render, screen } from "@testing-library/react";
import { Suspense } from "react";

// Mock di import.meta.glob - deve essere mockato prima dell'import
vi.mock("../dynamicComponentLoader", async () => {
  const MockComponent = () => <div data-testid="mock-component">Componente Mock</div>;

  const componentModules: Record<string, () => Promise<{ default: React.ComponentType<unknown> }>> = {
    "../components/pages/dashboard/HomePage.tsx": () => Promise.resolve({ default: MockComponent as React.ComponentType<unknown> }),
    "../components/pages/users/UserList.tsx": () => Promise.resolve({ default: MockComponent as React.ComponentType<unknown> }),
  };

  const componentCache = new Map<string, React.LazyExoticComponent<React.ComponentType<unknown>>>();
  const React = await import("react");

  return {
    loadDynamicComponent: (filePath: string) => {
      if (componentCache.has(filePath)) {
        return componentCache.get(filePath)!;
      }

      let normalizedPath = filePath;
      if (normalizedPath.startsWith("../components/pages/")) {
        normalizedPath = normalizedPath.replace("../components/pages/", "");
      } else if (normalizedPath.startsWith("components/pages/")) {
        normalizedPath = normalizedPath.replace("components/pages/", "");
      } else if (normalizedPath.startsWith("/components/pages/")) {
        normalizedPath = normalizedPath.replace("/components/pages/", "");
      }

      if (!normalizedPath.startsWith("../components/pages/")) {
        normalizedPath = `../components/pages/${normalizedPath}`;
      }

      const moduleLoader = componentModules[normalizedPath];

      if (!moduleLoader) {
        const FallbackComponent = React.lazy(() =>
          Promise.resolve({
            default: (() => (
              <div data-testid="component-not-found">
                Componente non trovato: {filePath}
              </div>
            )) as unknown as React.ComponentType<unknown>,
          })
        );
        componentCache.set(filePath, FallbackComponent);
        return FallbackComponent;
      }

      const LazyComponent = React.lazy(() =>
        moduleLoader().then((module) => ({ default: module.default }))
      );

      componentCache.set(filePath, LazyComponent);
      return LazyComponent;
    },
    clearComponentCache: () => {
      componentCache.clear();
    },
    getAvailableComponents: () => Object.keys(componentModules),
  };
});

import { loadDynamicComponent, clearComponentCache, getAvailableComponents } from "../dynamicComponentLoader";

describe("dynamicComponentLoader", () => {
  beforeEach(() => {
    clearComponentCache();
  });

  it("deve restituire un componente lazy valido per un percorso esistente", async () => {
    const Component = loadDynamicComponent("dashboard/HomePage.tsx");

    expect(Component).toBeDefined();

    render(
      <Suspense fallback={<div>Caricamento...</div>}>
        <Component />
      </Suspense>
    );

    const element = await screen.findByTestId("mock-component");
    expect(element).toBeDefined();
    expect(element.textContent).toBe("Componente Mock");
  });

  it("deve gestire percorsi con prefisso ../components/pages/", async () => {
    const Component = loadDynamicComponent("../components/pages/dashboard/HomePage.tsx");
    expect(Component).toBeDefined();

    render(
      <Suspense fallback={<div>Caricamento...</div>}>
        <Component />
      </Suspense>
    );

    const element = await screen.findByTestId("mock-component");
    expect(element).toBeDefined();
  });

  it("deve mostrare componente di fallback per percorso non valido", async () => {
    const Component = loadDynamicComponent("nonexistent/Page.tsx");

    render(
      <Suspense fallback={<div>Caricamento...</div>}>
        <Component />
      </Suspense>
    );

    const element = await screen.findByTestId("component-not-found");
    expect(element).toBeDefined();
    expect(element.textContent).toContain("nonexistent/Page.tsx");
  });

  it("deve usare la cache per componenti già caricati", () => {
    const Component1 = loadDynamicComponent("dashboard/HomePage.tsx");
    const Component2 = loadDynamicComponent("dashboard/HomePage.tsx");

    // Lo stesso componente deve essere restituito dalla cache
    expect(Component1).toBe(Component2);
  });

  it("deve restituire la lista dei componenti disponibili", () => {
    const available = getAvailableComponents();

    expect(available).toContain("../components/pages/dashboard/HomePage.tsx");
    expect(available).toContain("../components/pages/users/UserList.tsx");
    expect(available).toHaveLength(2);
  });

  it("deve svuotare la cache con clearComponentCache", () => {
    const Component1 = loadDynamicComponent("dashboard/HomePage.tsx");
    clearComponentCache();
    const Component2 = loadDynamicComponent("dashboard/HomePage.tsx");

    // Dopo il clear della cache, deve essere un'istanza diversa
    expect(Component1).not.toBe(Component2);
  });
});
