import { useMemo } from "react";
import { Box, Paper, Skeleton, Typography } from "@mui/material";
import { PieChart } from "@mui/x-charts/PieChart";
import formatCurrency from "../../../../common/bones/formatCurrency";
import useChartPalette from "./useChartPalette";

const ALTEZZA_GRAFICO = 260;

interface FettaDonut {
  id: string;
  label: string;
  /** Valore reale (può essere negativo per il non tracciato). */
  valoreReale: number;
  /** Valore clampato a ≥ 0 usato nel grafico. */
  valore: number;
  color: string;
}

interface DonutDistribuzioneIncassiProps {
  riepilogo: RiepilogoDashboard;
  loading?: boolean;
}

/**
 * Donut della distribuzione incassi dell'anno: 4 fette semantiche
 * (contante tracciato / elettronici / fatture / non tracciato) con i colori
 * della palette condivisa. I segmenti ≤ 0 sono esclusi dal grafico ma restano
 * in legenda a zero; i negativi sono clampati con nota testuale.
 */
function DonutDistribuzioneIncassi({ riepilogo, loading }: DonutDistribuzioneIncassiProps) {
  const palette = useChartPalette();
  const { totaliAnno, anno } = riepilogo;

  const fette = useMemo<FettaDonut[]>(
    () => [
      {
        id: "contante-tracciato",
        label: "Contante tracciato",
        valoreReale: totaliAnno.incassoContanteTracciato,
        valore: Math.max(totaliAnno.incassoContanteTracciato, 0),
        color: palette.tracciato,
      },
      {
        id: "elettronici",
        label: "Elettronici",
        valoreReale: totaliAnno.incassiElettronici,
        valore: Math.max(totaliAnno.incassiElettronici, 0),
        color: palette.elettronici,
      },
      {
        id: "fatture",
        label: "Fatture",
        valoreReale: totaliAnno.incassiFattura,
        valore: Math.max(totaliAnno.incassiFattura, 0),
        color: palette.fatture,
      },
      {
        id: "non-tracciato",
        label: "Non tracciato",
        valoreReale: totaliAnno.ricavoNonTracciato,
        valore: Math.max(totaliAnno.ricavoNonTracciato, 0),
        color: palette.nonTracciato,
      },
    ],
    [totaliAnno, palette]
  );

  // Solo i segmenti > 0 vengono disegnati nel grafico
  const fetteVisibili = useMemo(() => fette.filter((fetta) => fetta.valore > 0), [fette]);
  const totaleFette = useMemo(() => fetteVisibili.reduce((acc, fetta) => acc + fetta.valore, 0), [fetteVisibili]);
  const fetteClampate = useMemo(() => fette.filter((fetta) => fetta.valoreReale < 0), [fette]);

  const serieDonut = useMemo(
    () => [
      {
        data: fetteVisibili.map((fetta) => ({ id: fetta.id, value: fetta.valore, label: fetta.label, color: fetta.color })),
        innerRadius: "60%",
        outerRadius: "90%",
        valueFormatter: (item: { value: number }) => {
          const percentuale = totaleFette > 0 ? (item.value / totaleFette) * 100 : 0;
          return `€ ${formatCurrency(item.value)} (${percentuale.toLocaleString("it-IT", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%)`;
        },
      },
    ],
    [fetteVisibili, totaleFette]
  );

  if (loading) {
    return (
      <Paper
        variant="outlined"
        sx={{ p: 2.5, height: "100%" }}
        data-testid="donut-skeleton"
      >
        <Skeleton
          variant="text"
          width={200}
          height={28}
        />
        <Skeleton
          variant="circular"
          width={ALTEZZA_GRAFICO * 0.8}
          height={ALTEZZA_GRAFICO * 0.8}
          sx={{ mx: "auto", mt: 2 }}
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
        sx={{ mb: 1 }}
      >
        Distribuzione incassi
      </Typography>

      {fetteVisibili.length === 0 ? (
        <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: ALTEZZA_GRAFICO }}>
          <Typography
            variant="body2"
            color="text.secondary"
          >
            {`Nessun incasso per il ${anno}.`}
          </Typography>
        </Box>
      ) : (
        <Box sx={{ flex: 1, display: "flex", flexDirection: { xs: "column", lg: "row" }, alignItems: "center", gap: 2 }}>
          <Box sx={{ position: "relative", flex: "1 1 auto", width: "100%", minWidth: 0 }}>
            <PieChart
              series={serieDonut}
              height={ALTEZZA_GRAFICO}
              hideLegend
            />
            {/* Centro del donut: totale vendite dell'anno */}
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                pointerEvents: "none",
              }}
            >
              <Typography
                variant="caption"
                color="text.secondary"
              >
                {`Vendite ${anno}`}
              </Typography>
              <Typography
                variant="h6"
                fontWeight="bold"
                sx={{ fontVariantNumeric: "tabular-nums" }}
              >
                {`€ ${formatCurrency(totaliAnno.totaleVendite)}`}
              </Typography>
            </Box>
          </Box>

          {/* Legenda: tutte e 4 le categorie, anche quelle a zero */}
          <Box
            component="ul"
            sx={{ listStyle: "none", m: 0, p: 0, display: "flex", flexDirection: { xs: "row", lg: "column" }, flexWrap: "wrap", gap: 1, minWidth: { lg: 190 } }}
          >
            {fette.map((fetta) => {
              const percentuale = totaleFette > 0 ? (fetta.valore / totaleFette) * 100 : 0;
              return (
                <Box
                  component="li"
                  key={fetta.id}
                  sx={{ display: "flex", alignItems: "center", gap: 1 }}
                >
                  <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: fetta.color, flexShrink: 0 }} />
                  <Box>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ lineHeight: 1 }}
                    >
                      {fetta.label}
                    </Typography>
                    <Typography
                      variant="body2"
                      fontWeight={600}
                      sx={{ lineHeight: 1.3, fontVariantNumeric: "tabular-nums" }}
                    >
                      {`€ ${formatCurrency(fetta.valore)} · ${percentuale.toLocaleString("it-IT", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>
      )}

      {fetteClampate.length > 0 && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ mt: 1, fontStyle: "italic" }}
        >
          {fetteClampate.map((fetta) => `${fetta.label} negativo (€ ${formatCurrency(fetta.valoreReale)}): mostrato a 0 nel grafico.`).join(" ")}
        </Typography>
      )}
    </Paper>
  );
}

export default DonutDistribuzioneIncassi;
