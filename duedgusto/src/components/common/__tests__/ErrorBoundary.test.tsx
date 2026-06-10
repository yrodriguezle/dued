/* eslint-disable no-console */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("../../../common/logger/logger", () => ({
  default: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const navigateToMock = vi.fn();
vi.mock("../../../common/navigator/navigator", () => ({
  navigateTo: (...args: unknown[]) => navigateToMock(...args),
  setNavigator: vi.fn(),
}));

import ErrorBoundary from "../ErrorBoundary";

// Componente che lancia un errore per testare l'ErrorBoundary
const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error("Test error");
  }
  return <div>Contenuto figlio</div>;
};

describe("ErrorBoundary", () => {
  // Sopprimi gli errori di console da React durante i test dell'error boundary
  const originalConsoleError = console.error;

  beforeEach(() => {
    console.error = vi.fn();
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  it("dovrebbe renderizzare i componenti figli quando non ci sono errori", () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.getByText("Contenuto figlio")).toBeInTheDocument();
  });

  it("dovrebbe mostrare l'interfaccia di fallback quando un figlio lancia un errore", () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText("Oops! Qualcosa è andato storto")).toBeInTheDocument();
    expect(screen.getByText(/Ci scusiamo per l'inconveniente/)).toBeInTheDocument();
  });

  it("dovrebbe mostrare i pulsanti 'Ricarica la Pagina' e 'Vai al Dashboard' nel fallback", () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText("Ricarica la Pagina")).toBeInTheDocument();
    expect(screen.getByText("Vai al Dashboard")).toBeInTheDocument();
  });

  it("dovrebbe catturare l'errore e aggiornare lo stato", () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    // Se l'errore e' stato catturato, il fallback viene mostrato (non i figli)
    expect(screen.queryByText("Contenuto figlio")).not.toBeInTheDocument();
    expect(screen.getByText("Oops! Qualcosa è andato storto")).toBeInTheDocument();
  });
});

describe("ErrorBoundary — variante inline (per-route)", () => {
  const originalConsoleError = console.error;

  beforeEach(() => {
    navigateToMock.mockClear();
    console.error = vi.fn();
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  it("dovrebbe mostrare il fallback inline con i pulsanti 'Riprova' e 'Vai al Dashboard'", () => {
    render(
      <ErrorBoundary variant="inline">
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText("Oops! Qualcosa è andato storto")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Riprova" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Vai al Dashboard" })).toBeInTheDocument();
    // La variante inline NON espone il reload del documento
    expect(screen.queryByRole("button", { name: "Ricarica la Pagina" })).not.toBeInTheDocument();
  });

  it("'Riprova' rimonta i children senza alcun reload del documento (errore transitorio)", () => {
    let shouldThrow = true;
    const ThrowControlled = () => {
      if (shouldThrow) {
        throw new Error("Errore transitorio");
      }
      return <div>Contenuto figlio</div>;
    };

    render(
      <ErrorBoundary variant="inline">
        <ThrowControlled />
      </ErrorBoundary>
    );

    expect(screen.getByText("Oops! Qualcosa è andato storto")).toBeInTheDocument();

    // L'errore transitorio si risolve: il retry deve rimontare i children
    shouldThrow = false;
    fireEvent.click(screen.getByRole("button", { name: "Riprova" }));

    // I children vengono rimontati e renderizzati (nessun reload: in jsdom un
    // reload non rimonterebbe nulla, e navigateTo non viene chiamato)
    expect(screen.getByText("Contenuto figlio")).toBeInTheDocument();
    expect(navigateToMock).not.toHaveBeenCalled();
  });

  it("'Riprova' con errore persistente mostra di nuovo il fallback", () => {
    render(
      <ErrorBoundary variant="inline">
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    fireEvent.click(screen.getByRole("button", { name: "Riprova" }));

    expect(screen.getByText("Oops! Qualcosa è andato storto")).toBeInTheDocument();
  });

  it("'Vai al Dashboard' usa il navigator globale (nessun window.location)", () => {
    render(
      <ErrorBoundary variant="inline">
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    fireEvent.click(screen.getByRole("button", { name: "Vai al Dashboard" }));

    expect(navigateToMock).toHaveBeenCalledWith("/gestionale/dashboard");
  });

  it("il cambio di resetKey azzera lo stato di errore e ri-renderizza i children", () => {
    const { rerender } = render(
      <ErrorBoundary
        variant="inline"
        resetKey="/route-a"
      >
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText("Oops! Qualcosa è andato storto")).toBeInTheDocument();

    // Navigazione verso un'altra route: resetKey cambia, il nuovo children non lancia
    rerender(
      <ErrorBoundary
        variant="inline"
        resetKey="/route-b"
      >
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.getByText("Contenuto figlio")).toBeInTheDocument();
    expect(screen.queryByText("Oops! Qualcosa è andato storto")).not.toBeInTheDocument();
  });

  it("un rerender con lo stesso resetKey NON azzera lo stato di errore", () => {
    const { rerender } = render(
      <ErrorBoundary
        variant="inline"
        resetKey="/route-a"
      >
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    rerender(
      <ErrorBoundary
        variant="inline"
        resetKey="/route-a"
      >
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.getByText("Oops! Qualcosa è andato storto")).toBeInTheDocument();
  });
});
