import { useMemo } from "react";
import { Box, Paper, Skeleton, Typography } from "@mui/material";
import { BarChart } from "@mui/x-charts/BarChart";
import formatCurrency from "../../../../common/bones/formatCurrency";
import useChartPalette from "./useChartPalette";
import { clampaFlussoCassa } from "./flussoCassaUtils";

const ALTEZZA_GRAFICO = 240;

const formattaEuro = (value: number | null) => `€ ${formatCurrency(value ?? 0)}`;

interface FlussoCassaBarreImpilateProps {
  riepilogo: RiepilogoDashboard;
  loading?: boolean;
}

/**
 * Rappresentazione compatta del flusso di cassa a barre impilate orizzontali
 * (x-charts, NESSUNA dipendenza da Recharts): stessa semantica informativa
 * del Sankey — riga "Ricavi" (tracciato / non tracciato) e riga "Impieghi"
 * (spese tracciate / non tracciate / netto) con gli STESSI aggregati clampati
 * di clampaFlussoCassa. Usata come fallback di SankeyErrorBoundary ed
 * esportata anche come componente autonomo.
 */
function FlussoCassaBarreImpilate({ riepilogo, loading }: FlussoCassaBarreImpilateProps) {
  const palette = useChartPalette();
  const { totaliAnno, anno } = riepilogo;

  const flusso = useMemo(() => clampaFlussoCassa(totaliAnno), [totaliAnno]);

  const serieFlusso = useMemo(
    () => [
      { data: [flusso.ricavoTracciato, 0], label: "Ricavo tracciato", color: palette.tracciato, stack: "flusso", valueFormatter: formattaEuro },
      { data: [flusso.ricavoNonTracciato, 0], label: "Ricavo non tracciato", color: palette.nonTracciato, stack: "flusso", valueFormatter: formattaEuro },
      { data: [0, flusso.speseTracciate], label: "Spese tracciate", color: palette.spese, stack: "flusso", valueFormatter: formattaEuro },
      { data: [0, flusso.speseNonTracciate], label: "Spese non tracciate", color: palette.linkAlpha(palette.spese), stack: "flusso", valueFormatter: formattaEuro },
      { data: [0, flusso.netto], label: "Netto", color: palette.netto, stack: "flusso", valueFormatter: formattaEuro },
    ],
    [flusso, palette]
  );

  if (loading) {
    return (
      <Paper
        variant="outlined"
        sx={{ p: 2.5, height: "100%" }}
        data-testid="flusso-barre-skeleton"
      >
        <Skeleton
          variant="text"
          width={200}
          height={28}
        />
        <Skeleton
          variant="rounded"
          height={ALTEZZA_GRAFICO}
          sx={{ mt: 2 }}
        />
      </Paper>
    );
  }

  return (
    <Paper
      variant="outlined"
      sx={{ p: 2.5, height: "100%", display: "flex", flexDirection: "column" }}
    >
      <Typography
        variant="subtitle1"
        fontWeight={600}
      >
        {`Flusso di cassa ${anno}`}
      </Typography>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ mb: 1 }}
      >
        Ricavi (tracciato / non tracciato) e impieghi (spese e netto)
      </Typography>

      {totaliAnno.registri === 0 ? (
        <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: ALTEZZA_GRAFICO }}>
          <Typography
            variant="body2"
            color="text.secondary"
          >
            {`Nessun dato per il ${anno}.`}
          </Typography>
        </Box>
      ) : (
        <BarChart
          layout="horizontal"
          yAxis={[{ scaleType: "band", data: ["Ricavi", "Impieghi"], width: 70 }]}
          xAxis={[{ valueFormatter: (value: number | null) => formatCurrency(value ?? 0) }]}
          series={serieFlusso}
          height={ALTEZZA_GRAFICO}
        />
      )}

      {flusso.nettoNegativo && (
        <Typography
          variant="caption"
          color="error.main"
          fontWeight={600}
          sx={{ mt: 1 }}
        >
          {`Netto negativo (€ ${formatCurrency(flusso.nettoReale)}): le spese superano le vendite del ${anno}.`}
        </Typography>
      )}
      {flusso.note.length > 0 && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ mt: flusso.nettoNegativo ? 0.5 : 1, fontStyle: "italic" }}
        >
          {flusso.note.join(" ")}
        </Typography>
      )}
    </Paper>
  );
}

export default FlussoCassaBarreImpilate;
