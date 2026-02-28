import React, { ComponentType, LazyExoticComponent } from "react";

/**
 * Mappa dei componenti disponibili per il caricamento dinamico.
 * Questa mappa viene popolata automaticamente usando import.meta.glob di Vite.
 */
const componentModules = import.meta.glob<{ default: ComponentType<unknown> }>("../components/pages/**/*.tsx", { eager: false });

/**
 * Cache per i componenti già caricati per evitare chiamate duplicate
 */
const componentCache = new Map<string, LazyExoticComponent<ComponentType<unknown>>>();

/**
 * Carica dinamicamente un componente React basandosi sul percorso del file.
 *
 * @param filePath - Il percorso del file relativo alla directory components/pages
 *                   Es: "users/UserList.tsx" o "../components/pages/users/UserList.tsx"
 * @returns Un componente React caricato in modo lazy
 *
 * @example
 * const UserList = loadDynamicComponent("users/UserList.tsx");
 * return <Suspense fallback={<Loading />}><UserList /></Suspense>
 */
export function loadDynamicComponent(filePath: string): LazyExoticComponent<ComponentType<unknown>> {
  // Controlla la cache prima
  if (componentCache.has(filePath)) {
    return componentCache.get(filePath)!;
  }

  // Normalizza il percorso del file
  let normalizedPath = filePath;

  // Rimuovi il prefisso "../components/pages/" se presente
  if (normalizedPath.startsWith("../components/pages/")) {
    normalizedPath = normalizedPath.replace("../components/pages/", "");
  } else if (normalizedPath.startsWith("components/pages/")) {
    normalizedPath = normalizedPath.replace("components/pages/", "");
  } else if (normalizedPath.startsWith("/components/pages/")) {
    normalizedPath = normalizedPath.replace("/components/pages/", "");
  }

  // Aggiungi "../components/pages/" all'inizio se non presente
  if (!normalizedPath.startsWith("../components/pages/")) {
    normalizedPath = `../components/pages/${normalizedPath}`;
  }

  // Trova il modulo corrispondente
  const moduleLoader = componentModules[normalizedPath];

  if (!moduleLoader) {
    // Ritorna un componente di fallback che mostra l'errore
    const FallbackComponent = React.lazy(() =>
      Promise.resolve({
        default: () => (
          <div style={{ padding: "20px", color: "red" }}>
            <h2>Componente non trovato</h2>
            <p>Percorso: {filePath}</p>
            <p>Percorso normalizzato: {normalizedPath}</p>
            <p>Componenti disponibili: {Object.keys(componentModules).join(", ")}</p>
          </div>
        ),
      })
    );
    componentCache.set(filePath, FallbackComponent);
    return FallbackComponent;
  }

  // Crea il componente lazy
  const LazyComponent = React.lazy(() =>
    moduleLoader().then((module) => ({
      default: module.default,
    }))
  );

  // Salva nella cache
  componentCache.set(filePath, LazyComponent);

  return LazyComponent;
}

/**
 * Svuota la cache dei componenti (utile per testing o hot reload)
 */
export function clearComponentCache(): void {
  componentCache.clear();
}

/**
 * Ottiene l'elenco di tutti i componenti disponibili
 */
export function getAvailableComponents(): string[] {
  return Object.keys(componentModules);
}
