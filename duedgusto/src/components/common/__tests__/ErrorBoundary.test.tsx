/* eslint-disable no-console */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("../../../common/logger/logger", () => ({
  default: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
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
