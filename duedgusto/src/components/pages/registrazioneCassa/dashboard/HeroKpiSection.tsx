import { Fragment, useMemo } from "react";
import { Box, Chip, Divider, Paper, Skeleton, Typography, useMediaQuery, useTheme } from "@mui/material";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import formatCurrency from "../../../../common/bones/formatCurrency";
import KPICard from "../../../common/KPICard";
import useChartPalette from "./useChartPalette";
import { calcolaTrendPercentuale, MESI_LABEL } from "./dashboardUtils";

interface KpiBandaItem {
  label: string;
  value: number;
  color: string;
  negative?: boolean;
  trend?: number | null;
  minWidth?: number;
}

interface HeroKpiSectionProps {
  riepilogo: RiepilogoDashboard;
  meseRiferimento: RiepilogoMeseDashboard | null;
  loading?: boolean;
}

/** Formatta un importo come la banda della vista mensile (€ / -€ per le spese). */
function formatImporto(value: number, negative?: boolean): string {
  return negative && value > 0 ? `-€ ${formatCurrency(value)}` : `€ ${formatCurrency(value)}`;
}

/**
 * Sezione hero della dashboard: la Differenza del mese di riferimento come
 * unico numero grande della pagina (sparkline 12 mesi + trend vs mese
 * precedente) e banda densa con gli altri 6 KPI gestionali, nello stesso
 * linguaggio visivo di RiepilogoIncassiMensile. In coda i totali annuali
 * compatti.
 */
function HeroKpiSection({ riepilogo, meseRiferimento, loading }: HeroKpiSectionProps) {
  const theme = useTheme();
  const palette = useChartPalette();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const { mesi, totaliAnno, anno } = riepilogo;

  // Trend della Differenza e delle Vendite vs mese precedente (null → omesso).
  // Gennaio non ha mese precedente disponibile nell'anno selezionato.
  const mesePrecedente = useMemo(() => {
    if (!meseRiferimento || meseRiferimento.mese <= 1) return null;
    const precedente = mesi[meseRiferimento.mese - 2] ?? null;
    return precedente && precedente.registri > 0 ? precedente : null;
  }, [mesi, meseRiferimento]);

  const trendDifferenza = useMemo(
    () => (meseRiferimento ? calcolaTrendPercentuale(meseRiferimento.differenza, mesePrecedente?.differenza) : null),
    [meseRiferimento, mesePrecedente]
  );

  const trendVendite = useMemo(
    () => (meseRiferimento ? calcolaTrendPercentuale(meseRiferimento.totaleVendite, mesePrecedente?.totaleVendite) : null),
    [meseRiferimento, mesePrecedente]
  );

  // Sparkline della differenza mensile: indicativa, solo con almeno 2 mesi con dati.
  const sparklineDifferenza = useMemo(() => {
    const mesiConDati = mesi.filter((mese) => mese.registri > 0).length;
    if (mesiConDati < 2) return undefined;
    return mesi.map((mese) => mese.differenza);
  }, [mesi]);

  const bandaKpi = useMemo<KpiBandaItem[]>(() => {
    if (!meseRiferimento) return [];
    return [
      { label: "Totale Vendite", value: meseRiferimento.totaleVendite, color: palette.vendite, trend: trendVendite, minWidth: 110 },
      { label: "Totale Spese", value: meseRiferimento.totaleSpese, color: palette.spese, negative: true, minWidth: 110 },
      { label: "Ricavo tracciato", value: meseRiferimento.ricavoTracciato, color: palette.tracciato },
      { label: "Ricavo non tracciato", value: meseRiferimento.ricavoNonTracciato, color: palette.nonTracciato },
      { label: "Spese tracciate", value: meseRiferimento.speseTracciate, color: palette.spese, negative: true },
      { label: "Spese non tracciate", value: meseRiferimento.speseNonTracciate, color: palette.spese, negative: true },
    ];
  }, [meseRiferimento, palette, trendVendite]);

  const kpiAnnuali = useMemo<KpiBandaItem[]>(
    () => [
      { label: "Vendite", value: totaliAnno.totaleVendite, color: palette.vendite },
      { label: "Spese", value: totaliAnno.totaleSpese, color: palette.spese, negative: true },
      { label: "Differenza", value: totaliAnno.differenza, color: totaliAnno.differenza >= 0 ? palette.netto : palette.spese },
      { label: "Ricavo tracciato", value: totaliAnno.ricavoTracciato, color: palette.tracciato },
      { label: "Ricavo non tracciato", value: totaliAnno.ricavoNonTracciato, color: palette.nonTracciato },
    ],
    [totaliAnno, palette]
  );

  if (loading) {
    return (
      <Paper
        variant="outlined"
        sx={{ p: 2.5 }}
        data-testid="hero-kpi-skeleton"
      >
        <Skeleton
          variant="text"
          width={220}
          height={28}
        />
        <Box sx={{ display: "flex", gap: 2.5, flexWrap: "wrap", mt: 1 }}>
          <Skeleton
            variant="rounded"
            width={320}
            height={140}
          />
          <Skeleton
            variant="rounded"
            sx={{ flex: 1, minWidth: 240 }}
            height={140}
          />
        </Box>
      </Paper>
    );
  }

  const labelMeseRiferimento = meseRiferimento ? `${MESI_LABEL[meseRiferimento.mese - 1]} ${anno}` : null;

  return (
    <Paper
      variant="outlined"
      sx={{ p: 2.5 }}
    >
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1, mb: 1.5 }}>
        <Typography
          variant="subtitle1"
          fontWeight={600}
        >
          {labelMeseRiferimento ? `KPI di ${labelMeseRiferimento}` : `KPI ${anno}`}
        </Typography>
        {meseRiferimento && (
          <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
            <Chip
              label={`${meseRiferimento.registri} registri`}
              size="small"
              variant="outlined"
            />
            {meseRiferimento.bozze > 0 && (
              <Chip
                label={`${meseRiferimento.bozze} bozze`}
                size="small"
                color="warning"
                variant="outlined"
              />
            )}
          </Box>
        )}
      </Box>

      {meseRiferimento ? (
        <Box sx={{ display: "flex", gap: 2.5, flexWrap: "wrap", alignItems: "stretch" }}>
          {/* Hero: la Differenza è l'unico numero grande della pagina */}
          <Box sx={{ flex: "1 1 300px", maxWidth: { md: 420 } }}>
            <KPICard
              variant="hero"
              label="Differenza"
              value={meseRiferimento.differenza}
              subtitle={labelMeseRiferimento ?? undefined}
              trend={trendDifferenza ?? undefined}
              sparklineData={sparklineDifferenza}
              color={meseRiferimento.differenza >= 0 ? palette.netto : palette.spese}
            />
          </Box>

          {/* Banda densa: gli altri 6 KPI del mese, stile RiepilogoIncassiMensile */}
          <Box sx={{ flex: "2 1 380px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: { xs: 1.5, sm: 2.5 } }}>
            {bandaKpi.map((kpi, index) => (
              <Fragment key={kpi.label}>
                {index > 0 && !isMobile && (
                  <Divider
                    orientation="vertical"
                    flexItem
                  />
                )}
                <Box sx={{ minWidth: { xs: "auto", sm: kpi.minWidth ?? 90 } }}>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ lineHeight: 1 }}
                  >
                    {kpi.label}
                  </Typography>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <Typography
                      variant={isMobile ? "body2" : "body1"}
                      fontWeight="bold"
                      sx={{ lineHeight: 1.3, color: kpi.color, fontVariantNumeric: "tabular-nums" }}
                    >
                      {formatImporto(kpi.value, kpi.negative)}
                    </Typography>
                    {kpi.trend != null && (
                      <Box
                        component="span"
                        sx={{ display: "inline-flex", alignItems: "center", color: kpi.trend >= 0 ? "success.main" : "error.main" }}
                      >
                        {kpi.trend >= 0 ? <TrendingUpIcon sx={{ fontSize: 14 }} /> : <TrendingDownIcon sx={{ fontSize: 14 }} />}
                        <Typography
                          variant="caption"
                          fontWeight={600}
                          sx={{ fontVariantNumeric: "tabular-nums" }}
                        >
                          {`${kpi.trend >= 0 ? "+" : "-"}${Math.abs(kpi.trend).toLocaleString("it-IT", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </Box>
              </Fragment>
            ))}
          </Box>
        </Box>
      ) : (
        <Typography
          variant="body2"
          color="text.secondary"
        >
          {`Nessun registro per il ${anno}.`}
        </Typography>
      )}

      {/* Totali annuali compatti */}
      <Divider sx={{ my: 2 }} />
      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: { xs: 1.5, sm: 2.5 } }}>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ minWidth: 72 }}
        >
          {`Totali ${anno}`}
        </Typography>
        {kpiAnnuali.map((kpi, index) => (
          <Fragment key={kpi.label}>
            {index > 0 && !isMobile && (
              <Divider
                orientation="vertical"
                flexItem
              />
            )}
            <Box>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ lineHeight: 1 }}
              >
                {kpi.label}
              </Typography>
              <Typography
                variant="body2"
                fontWeight="bold"
                sx={{ lineHeight: 1.3, color: kpi.color, fontVariantNumeric: "tabular-nums" }}
              >
                {formatImporto(kpi.value, kpi.negative)}
              </Typography>
            </Box>
          </Fragment>
        ))}
        <Divider
          orientation="vertical"
          flexItem
          sx={{ display: { xs: "none", sm: "block" } }}
        />
        <Chip
          label={`${totaliAnno.registri} registri`}
          size="small"
          variant="outlined"
        />
        {totaliAnno.bozze > 0 && (
          <Chip
            label={`${totaliAnno.bozze} bozze`}
            size="small"
            color="warning"
            variant="outlined"
          />
        )}
      </Box>
    </Paper>
  );
}

export default HeroKpiSection;
