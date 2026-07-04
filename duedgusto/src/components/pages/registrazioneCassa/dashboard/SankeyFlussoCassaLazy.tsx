import { lazy, Suspense } from "react";
import { Skeleton } from "@mui/material";
import SankeyErrorBoundary from "./SankeyErrorBoundary";
import FlussoCassaBarreImpilate from "./FlussoCassaBarreImpilate";

// Code splitting: recharts finisce nel chunk async di SankeyFlussoCassa,
// non nel bundle principale (unico import di recharts della nuova dashboard).
const SankeyFlussoCassa = lazy(() => import("./SankeyFlussoCassa"));

const ALTEZZA_SKELETON = 320;

interface SankeyFlussoCassaLazyProps {
  riepilogo: RiepilogoDashboard;
  loading?: boolean;
}

/**
 * Blocco Sankey pronto all'uso per l'orchestratore della dashboard:
 * React.lazy + Suspense (skeleton durante il download del chunk) dentro
 * SankeyErrorBoundary con fallback a barre impilate x-charts. Un crash di
 * Recharts (recharts#6857) degrada al fallback senza toccare il resto
 * della pagina.
 */
function SankeyFlussoCassaLazy({ riepilogo, loading }: SankeyFlussoCassaLazyProps) {
  return (
    <SankeyErrorBoundary
      fallback={
        <FlussoCassaBarreImpilate
          riepilogo={riepilogo}
          loading={loading}
        />
      }
    >
      <Suspense
        fallback={
          <Skeleton
            variant="rounded"
            height={ALTEZZA_SKELETON}
          />
        }
      >
        <SankeyFlussoCassa
          riepilogo={riepilogo}
          loading={loading}
        />
      </Suspense>
    </SankeyErrorBoundary>
  );
}

export default SankeyFlussoCassaLazy;
