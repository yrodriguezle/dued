import { Fragment } from "react";
import { Box, Typography, Divider, Chip, useMediaQuery, useTheme } from "@mui/material";
import formatCurrency from "../../../../common/bones/formatCurrency";

interface MonthlyStats {
  totaleVendite: number;
  ricavoTracciato: number;
  ricavoNonTracciato: number;
  speseTracciate: number;
  speseNonTracciate: number;
  registri: number;
  chiusi: number;
  bozze: number;
}

interface RiepilogoIncassiMensileProps {
  stats: MonthlyStats;
}

interface KpiItem {
  label: string;
  value: number;
  color?: string;
  negative?: boolean;
  minWidth?: number;
}

function RiepilogoIncassiMensile({ stats }: RiepilogoIncassiMensileProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const totaleSpese = stats.speseTracciate + stats.speseNonTracciate;
  const differenza = stats.totaleVendite - totaleSpese;

  const kpis: KpiItem[] = [
    { label: "Totale Vendite", value: stats.totaleVendite, color: "primary.main", minWidth: 100 },
    { label: "Totale Spese", value: totaleSpese, color: "error.main", negative: true, minWidth: 100 },
    { label: "Differenza", value: differenza, color: differenza >= 0 ? "primary.main" : "error.main" },
    { label: "Ricavo tracciato", value: stats.ricavoTracciato, color: "success.main" },
    { label: "Ricavo non tracciato", value: stats.ricavoNonTracciato, color: "warning.main" },
    { label: "Spese tracciate", value: stats.speseTracciate, color: "error.main", negative: true },
    { label: "Spese non tracciate", value: stats.speseNonTracciate, color: "error.main", negative: true },
  ];

  return (
    <Box sx={{ flexShrink: 0, borderBottom: 1, borderColor: "divider", bgcolor: "background.paper", px: { xs: 1, sm: 2 }, py: { xs: 1, sm: 1.5 } }}>
      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: { xs: 1.5, sm: 2.5 } }}>
        {kpis.map((kpi, index) => (
          <Fragment key={kpi.label}>
            {index > 0 && !isMobile && <Divider
              orientation="vertical"
              flexItem
            />}
            <Box sx={{ minWidth: { xs: "auto", sm: kpi.minWidth ?? 90 } }}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ lineHeight: 1 }}
              >
                {kpi.label}
              </Typography>
              <Typography
                variant={isMobile ? "body2" : "body1"}
                fontWeight="bold"
                color={kpi.color}
                sx={{ lineHeight: 1.3 }}
              >
                {kpi.negative && kpi.value > 0 ? `-€ ${formatCurrency(kpi.value)}` : `€ ${formatCurrency(kpi.value)}`}
              </Typography>
            </Box>
          </Fragment>
        ))}
        {!isMobile && <Divider
          orientation="vertical"
          flexItem
        />}
        <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
          <Chip
            label={`${stats.registri} registri`}
            size="small"
            variant="outlined"
          />
          {stats.bozze > 0 && <Chip
            label={`${stats.bozze} bozze`}
            size="small"
            color="warning"
            variant="outlined"
          />}
        </Box>
      </Box>
    </Box>
  );
}

export default RiepilogoIncassiMensile;
