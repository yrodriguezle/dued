import { useMemo } from "react";
import { Box, Paper, Skeleton, Typography } from "@mui/material";
import { BarChart } from "@mui/x-charts/BarChart";
import { LineChart } from "@mui/x-charts/LineChart";
import formatCurrency from "../../../../common/bones/formatCurrency";
import useChartPalette from "./useChartPalette";
import { MESI_BREVI, serieDodiciMesi } from "./dashboardUtils";

const ALTEZZA_BARRE = 300;
const ALTEZZA_LINEE = 260;

interface TrendMensileProps {
  riepilogo: RiepilogoDashboard;
  loading?: boolean;
}

const formattaEuro = (value: number | null) => `€ ${formatCurrency(value ?? 0)}`;

/**
 * Sezione trend annuale (unica sezione trend della dashboard):
 * - barre Vendite vs Spese sui 12 mesi (asse X sempre completo Gen–Dic);
 * - linee Differenza (ambra) e Ricavo tracciato / non tracciato.
 * Colori esclusivamente da useChartPalette, tooltip in euro.
 */
function TrendMensile({ riepilogo, loading }: TrendMensileProps) {
  const palette = useChartPalette();
  const { mesi, totaliAnno, anno } = riepilogo;

  const serieVendite = useMemo(() => serieDodiciMesi(mesi, (mese) => mese.totaleVendite), [mesi]);
  const serieSpese = useMemo(() => serieDodiciMesi(mesi, (mese) => mese.totaleSpese), [mesi]);
  const serieDifferenza = useMemo(() => serieDodiciMesi(mesi, (mese) => mese.differenza), [mesi]);
  const serieTracciato = useMemo(() => serieDodiciMesi(mesi, (mese) => mese.ricavoTracciato), [mesi]);
  const serieNonTracciato = useMemo(() => serieDodiciMesi(mesi, (mese) => mese.ricavoNonTracciato), [mesi]);

  if (loading) {
    return (
      <Paper
        variant="outlined"
        sx={{ p: 2.5 }}
        data-testid="trend-skeleton"
      >
        <Skeleton
          variant="text"
          width={200}
          height={28}
        />
        <Skeleton
          variant="rounded"
          height={ALTEZZA_BARRE}
          sx={{ mt: 2 }}
        />
      </Paper>
    );
  }

  return (
    <Paper
      variant="outlined"
      sx={{ p: 2.5 }}
    >
      <Typography
        variant="subtitle1"
        fontWeight={600}
        sx={{ mb: 1 }}
      >
        {`Trend mensile ${anno}`}
      </Typography>

      {totaliAnno.registri === 0 ? (
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: ALTEZZA_BARRE }}>
          <Typography
            variant="body2"
            color="text.secondary"
          >
            {`Nessun dato per il ${anno}.`}
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <BarChart
            xAxis={[{ scaleType: "band", data: MESI_BREVI }]}
            series={[
              { data: serieVendite, label: "Vendite", color: palette.vendite, valueFormatter: formattaEuro },
              { data: serieSpese, label: "Spese", color: palette.spese, valueFormatter: formattaEuro },
            ]}
            height={ALTEZZA_BARRE}
          />
          <LineChart
            xAxis={[{ scaleType: "point", data: MESI_BREVI }]}
            series={[
              { data: serieDifferenza, label: "Differenza", color: palette.netto, valueFormatter: formattaEuro },
              { data: serieTracciato, label: "Ricavo tracciato", color: palette.tracciato, valueFormatter: formattaEuro },
              { data: serieNonTracciato, label: "Ricavo non tracciato", color: palette.nonTracciato, valueFormatter: formattaEuro },
            ]}
            height={ALTEZZA_LINEE}
          />
        </Box>
      )}
    </Paper>
  );
}

export default TrendMensile;
