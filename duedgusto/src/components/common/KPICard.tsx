import { Box, Paper, Typography } from "@mui/material";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import { SparkLineChart } from "@mui/x-charts/SparkLineChart";
import formatCurrency from "../../common/bones/formatCurrency";

interface KPICardProps {
  label: string;
  value: number;
  highlight?: boolean;
  negative?: boolean;
  /** "compact" (default): card 120px quadrata, comportamento storico invariato. "hero": numero grande con trend e sparkline. */
  variant?: "compact" | "hero";
  /** Variazione % vs periodo precedente (es. +4.2). Indicatore omesso se undefined. */
  trend?: number;
  /** Serie mensile (12 valori) per la sparkline, solo variant "hero". Omessa se la serie ha meno di 2 mesi con dati. */
  sparklineData?: number[];
  /** Riga secondaria sotto il valore (solo variant "hero"). */
  subtitle?: string;
  /** Colore CSS concreto per valore e sparkline (es. da useChartPalette). */
  color?: string;
}

/** Formatta il trend percentuale in it-IT con segno esplicito (es. "+4,2%"). */
function formatTrend(trend: number): string {
  const formatted = Math.abs(trend).toLocaleString("it-IT", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return `${trend >= 0 ? "+" : "-"}${formatted}%`;
}

/** La sparkline è indicativa: va mostrata solo con almeno 2 mesi con dati. */
function hasSparklineData(sparklineData: number[] | undefined): sparklineData is number[] {
  return (sparklineData?.filter((valore) => valore !== 0).length ?? 0) >= 2;
}

function KPICard({ label, value, highlight, negative, variant = "compact", trend, sparklineData, subtitle, color }: KPICardProps) {
  if (variant === "hero") {
    const trendPositivo = (trend ?? 0) >= 0;
    return (
      <Paper
        variant="outlined"
        sx={{
          p: 2.5,
          display: "flex",
          flexDirection: "column",
          gap: 0.5,
          height: "100%",
          ...(highlight && { borderColor: "primary.main", borderWidth: 2 }),
        }}
      >
        <Typography
          variant="overline"
          color="text.secondary"
          sx={{ lineHeight: 1.5, letterSpacing: 1 }}
        >
          {label}
        </Typography>
        <Box sx={{ display: "flex", alignItems: "baseline", gap: 1.5, flexWrap: "wrap" }}>
          <Typography
            variant="h3"
            fontWeight="bold"
            sx={{ fontVariantNumeric: "tabular-nums", color: color ?? "text.primary", lineHeight: 1.1 }}
          >
            {`€ ${formatCurrency(value)}`}
          </Typography>
          {trend !== undefined && (
            <Box
              component="span"
              sx={{ display: "inline-flex", alignItems: "center", gap: 0.25, color: trendPositivo ? "success.main" : "error.main" }}
            >
              {trendPositivo ? <TrendingUpIcon fontSize="small" /> : <TrendingDownIcon fontSize="small" />}
              <Typography
                variant="body2"
                fontWeight={600}
                sx={{ fontVariantNumeric: "tabular-nums" }}
              >
                {formatTrend(trend)}
              </Typography>
            </Box>
          )}
        </Box>
        {subtitle && (
          <Typography
            variant="caption"
            color="text.secondary"
          >
            {subtitle}
          </Typography>
        )}
        {hasSparklineData(sparklineData) && (
          <Box sx={{ mt: "auto", pt: 1 }}>
            <SparkLineChart
              data={sparklineData}
              height={40}
              area
              color={color}
            />
          </Box>
        )}
      </Paper>
    );
  }

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1,
        textAlign: "center",
        flex: "0 0 auto",
        width: "120px",
        aspectRatio: "1 / 1",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
        ...(highlight && { borderColor: "primary.main", borderWidth: 2 }),
      }}
    >
      <Typography
        variant="caption"
        color="text.secondary"
        display="block"
        noWrap
        sx={{ width: "100%" }}
      >
        {label}
      </Typography>
      <Typography
        variant="h6"
        fontWeight="bold"
        color={negative ? "error.main" : "text.primary"}
        noWrap
        sx={{ width: "100%" }}
      >
        {formatCurrency(value)}
      </Typography>
    </Paper>
  );
}

export default KPICard;
