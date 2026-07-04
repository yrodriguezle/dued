import { Component, ErrorInfo, ReactNode } from "react";
import logger from "../../../../common/logger/logger";

interface SankeyErrorBoundaryProps {
  /** Contenuto mostrato al posto del Sankey in caso di crash (FlussoCassaBarreImpilate). */
  fallback: ReactNode;
  children: ReactNode;
}

interface SankeyErrorBoundaryState {
  hasError: boolean;
}

/**
 * Error boundary di classe che isola il blocco Sankey: un errore di rendering
 * di Recharts (rischio noto recharts#6857 con React 19) NON deve far crashare
 * il resto della dashboard. Al primo errore logga via logger (non console) e
 * monta il fallback a barre impilate x-charts: degradazione silenziosa.
 */
class SankeyErrorBoundary extends Component<SankeyErrorBoundaryProps, SankeyErrorBoundaryState> {
  state: SankeyErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): SankeyErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    logger.error("SankeyErrorBoundary: errore di rendering del Sankey (possibile recharts#6857 con React 19), attivo il fallback a barre impilate.", error, errorInfo.componentStack);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

export default SankeyErrorBoundary;
