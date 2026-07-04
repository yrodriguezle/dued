import { useMemo } from "react";
import { alpha, useTheme } from "@mui/material";

/**
 * Palette semantica centralizzata per TUTTI i grafici della dashboard cassa
 * (x-charts E Recharts): unica fonte colore derivata dal tema MUI attivo.
 * Nessun componente grafico deve hardcodare hex: cambiando theme.tsx (o il
 * mode dark/light a runtime) cambiano automaticamente tutti i grafici.
 */
export interface ChartPalette {
  /** Vendite / identità del brand (ambra). */
  vendite: string;
  /** Ricavo tracciato (contante tracciato + elettronici + fatture). */
  tracciato: string;
  /** Ricavo non tracciato. */
  nonTracciato: string;
  /** Incassi elettronici. */
  elettronici: string;
  /** Incassi con fattura. */
  fatture: string;
  /** Spese (tracciate e non). */
  spese: string;
  /** Netto / differenza. */
  netto: string;
  /** Alpha per i link del Sankey (e sfondi delicati). */
  linkAlpha: (color: string) => string;
  /** Stile tooltip coerente dark/light per i grafici non temizzati (Recharts). */
  tooltip: {
    backgroundColor: string;
    border: string;
    color: string;
  };
}

function useChartPalette(): ChartPalette {
  const theme = useTheme();
  return useMemo(
    () => ({
      vendite: theme.palette.primary.main,
      tracciato: theme.palette.success.main,
      nonTracciato: theme.palette.warning.main,
      elettronici: theme.palette.info.main,
      fatture: theme.palette.secondary.main,
      spese: theme.palette.error.main,
      netto: theme.palette.primary.main,
      linkAlpha: (color: string) => alpha(color, 0.35),
      tooltip: {
        backgroundColor: theme.palette.background.paper,
        border: `1px solid ${theme.palette.divider}`,
        color: theme.palette.text.primary,
      },
    }),
    [theme]
  );
}

export default useChartPalette;
