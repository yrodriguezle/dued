import { useContext, useEffect } from "react";
import { Box, Card, CardContent, Typography, Grid, Button } from "@mui/material";
import { useNavigate } from "react-router";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import PointOfSaleIcon from "@mui/icons-material/PointOfSale";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import ListIcon from "@mui/icons-material/List";
import AddIcon from "@mui/icons-material/Add";

import PageTitleContext from "../../layout/headerBar/PageTitleContext";
import useQueryDashboardKPIs from "../../../graphql/cashRegister/useQueryDashboardKPIs";

interface KPICardProps {
  title: string;
  value: string;
  subtitle?: string;
  trend?: number;
  color?: string;
  icon?: React.ReactNode;
}

function KPICard({ title, value, subtitle, trend, color = "primary", icon }: KPICardProps) {
  return (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <Box>
            <Typography color="text.secondary" gutterBottom variant="overline">
              {title}
            </Typography>
            <Typography variant="h4" component="div" color={`${color}.main`} fontWeight="bold">
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {subtitle}
              </Typography>
            )}
            {trend !== undefined && (
              <Box sx={{ display: "flex", alignItems: "center", mt: 1 }}>
                {trend >= 0 ? (
                  <TrendingUpIcon color="success" fontSize="small" />
                ) : (
                  <TrendingDownIcon color="error" fontSize="small" />
                )}
                <Typography
                  variant="body2"
                  color={trend >= 0 ? "success.main" : "error.main"}
                  sx={{ ml: 0.5 }}
                >
                  {trend >= 0 ? "+" : ""}
                  {trend.toFixed(1)}%
                </Typography>
              </Box>
            )}
          </Box>
          {icon && (
            <Box sx={{ color: `${color}.main`, opacity: 0.3 }}>
              {icon}
            </Box>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}

function CashRegisterDashboard() {
  const navigate = useNavigate();
  const { setTitle } = useContext(PageTitleContext);
  const { kpis, loading } = useQueryDashboardKPIs();

  useEffect(() => {
    setTitle("Dashboard Cassa");
  }, [setTitle]);

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Caricamento dashboard...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">
          Dashboard Cassa
        </Typography>
        <Box>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={() => navigate("/gestionale/cassa/new")}
            sx={{ mr: 1 }}
          >
            Nuova Cassa
          </Button>
          <Button
            variant="outlined"
            startIcon={<ListIcon />}
            onClick={() => navigate("/gestionale/cassa/list")}
            sx={{ mr: 1 }}
          >
            Lista Casse
          </Button>
          <Button
            variant="outlined"
            startIcon={<CalendarMonthIcon />}
            onClick={() => navigate("/gestionale/cassa/monthly")}
          >
            Vista Mensile
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* KPI Cards */}
        <Grid item xs={12} sm={6} md={3}>
          <KPICard
            title="Vendite Oggi"
            value={`€ ${kpis?.todaySales?.toFixed(2) || "0.00"}`}
            icon={<PointOfSaleIcon sx={{ fontSize: 48 }} />}
            color="primary"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KPICard
            title="Differenza Cassa Oggi"
            value={`€ ${kpis?.todayDifference >= 0 ? "+" : ""}${kpis?.todayDifference?.toFixed(2) || "0.00"}`}
            subtitle={Math.abs(kpis?.todayDifference || 0) > 5 ? "Superata soglia!" : "Nella norma"}
            icon={<PointOfSaleIcon sx={{ fontSize: 48 }} />}
            color={Math.abs(kpis?.todayDifference || 0) > 5 ? "warning" : "success"}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KPICard
            title="Vendite Mese"
            value={`€ ${kpis?.monthSales?.toFixed(2) || "0.00"}`}
            trend={kpis?.weekTrend}
            icon={<CalendarMonthIcon sx={{ fontSize: 48 }} />}
            color="info"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KPICard
            title="Media Giornaliera"
            value={`€ ${kpis?.monthAverage?.toFixed(2) || "0.00"}`}
            subtitle="Media mensile"
            icon={<TrendingUpIcon sx={{ fontSize: 48 }} />}
            color="secondary"
          />
        </Grid>

        {/* Placeholder per grafici futuri */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Trend Vendite Ultimi 30 Giorni
              </Typography>
              <Box
                sx={{
                  height: 300,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  bgcolor: "action.hover",
                  borderRadius: 1,
                }}
              >
                <Typography color="text.secondary">
                  Grafico disponibile dopo implementazione backend
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Breakdown Pagamenti
              </Typography>
              <Box
                sx={{
                  height: 300,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  bgcolor: "action.hover",
                  borderRadius: 1,
                }}
              >
                <Typography color="text.secondary">
                  Grafico disponibile dopo implementazione backend
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

export default CashRegisterDashboard;
