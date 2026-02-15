import { useContext, useEffect, useState, useMemo } from "react";
import { Box, Card, CardContent, Typography, Grid, Button, Select, MenuItem, FormControl, InputLabel, CircularProgress } from "@mui/material";
import { useNavigate } from "react-router";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import PointOfSaleIcon from "@mui/icons-material/PointOfSale";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import ListIcon from "@mui/icons-material/List";
import AddIcon from "@mui/icons-material/Add";
import EuroIcon from "@mui/icons-material/Euro";
import CreditCardIcon from "@mui/icons-material/CreditCard";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

import PageTitleContext from "../../layout/headerBar/PageTitleContext";
import useQueryYearlySummary from "../../../graphql/cashRegister/useQueryYearlySummary";
import useStore from "../../../store/useStore";

const CHART_COLORS = {
  primary: "#1976d2",
  secondary: "#9c27b0",
  success: "#2e7d32",
  warning: "#ed6c02",
  error: "#d32f2f",
  info: "#0288d1",
  cash: "#4caf50",
  electronic: "#2196f3",
};

const MONTH_NAMES = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];

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

function RegistrazioneCassDashboard() {
  const navigate = useNavigate();
  const { setTitle } = useContext(PageTitleContext);
  const getNextOperatingDate = useStore((state) => state.getNextOperatingDate);

  // Anno e mese correnti
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 0-11 -> 1-12

  // Anno selezionato (default: anno corrente)
  const [selectedYear, setSelectedYear] = useState(currentYear);

  // Genera lista anni disponibili (ultimi 5 anni)
  const availableYears = useMemo(() => {
    return Array.from({ length: 5 }, (_, i) => currentYear - 4 + i);
  }, [currentYear]);

  // Recupera dati annuali
  const { data: yearlyData, loading: loadingYearlyData } = useQueryYearlySummary({
    year: selectedYear,
  });

  useEffect(() => {
    setTitle("Dashboard Cassa");
  }, [setTitle]);

  // Dati del mese da mostrare:
  // - Se anno selezionato = anno corrente: mostra mese corrente
  // - Se anno selezionato != anno corrente: mostra il mese con più ricavo
  const displayMonthData = useMemo(() => {
    if (selectedYear === currentYear) {
      // Anno corrente: mostra il mese corrente
      return yearlyData.monthlyData.find((m) => m.month === currentMonth) || {
        month: currentMonth,
        year: selectedYear,
        totalRevenue: 0,
        totalCash: 0,
        totalElectronic: 0,
        count: 0,
      };
    } else {
      // Anno passato: trova il mese con più ricavo
      const monthWithMostRevenue = yearlyData.monthlyData.reduce((max, month) =>
        month.totalRevenue > max.totalRevenue ? month : max
        , yearlyData.monthlyData[0] || {
          month: 1,
          year: selectedYear,
          totalRevenue: 0,
          totalCash: 0,
          totalElectronic: 0,
          count: 0,
        });
      return monthWithMostRevenue;
    }
  }, [yearlyData.monthlyData, currentMonth, selectedYear, currentYear]);

  // Prepara dati per grafico trend mensile
  const monthlyChartData = useMemo(() => {
    return yearlyData.monthlyData.map((month) => ({
      name: MONTH_NAMES[month.month - 1],
      ricavo: parseFloat(month.totalRevenue?.toFixed(2) || "0"),
      contanti: parseFloat(month.totalCash?.toFixed(2) || "0"),
      elettronici: parseFloat(month.totalElectronic?.toFixed(2) || "0"),
    }));
  }, [yearlyData.monthlyData]);

  // Prepara dati per grafico breakdown pagamenti annuali
  const paymentBreakdownData = useMemo(() => {
    return [
      { name: "Contanti", value: yearlyData.yearlyTotals.totalCash, color: CHART_COLORS.cash },
      { name: "Elettronici", value: yearlyData.yearlyTotals.totalElectronic, color: CHART_COLORS.electronic },
    ];
  }, [yearlyData.yearlyTotals]);

  // Calcola trend mese visualizzato vs mese precedente
  const monthTrend = useMemo(() => {
    const displayMonth = displayMonthData.month;
    const prevMonth = displayMonth === 1 ? 12 : displayMonth - 1;
    const prevMonthData = yearlyData.monthlyData.find((m) => m.month === prevMonth);

    if (!prevMonthData || prevMonthData.totalRevenue === 0) return undefined;

    const diff = displayMonthData.totalRevenue - prevMonthData.totalRevenue;
    return (diff / prevMonthData.totalRevenue) * 100;
  }, [yearlyData.monthlyData, displayMonthData]);

  if (loadingYearlyData) {
    return (
      <Box sx={{ p: 3, display: "flex", justifyContent: "center", alignItems: "center", height: "50vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ px: 3, pt: 3, pb: 0 }}>
      {/* Header con selettore anno e azioni */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3, flexWrap: "wrap", gap: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Typography variant="h4" fontWeight="bold">
            Dashboard Cassa
          </Typography>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Anno</InputLabel>
            <Select value={selectedYear} label="Anno" onChange={(e) => setSelectedYear(Number(e.target.value))}>
              {availableYears.map((year) => (
                <MenuItem key={year} value={year}>
                  {year}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={() => {
              const date = getNextOperatingDate();
              const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
              navigate(`/gestionale/cassa/${dateStr}`);
            }}
          >
            Nuova Cassa
          </Button>
          <Button variant="outlined" startIcon={<ListIcon />} onClick={() => navigate("/gestionale/cassa/list")}>
            Lista Casse
          </Button>
          <Button variant="outlined" startIcon={<CalendarMonthIcon />} onClick={() => navigate("/gestionale/cassa/monthly")}>
            Vista Mensile
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* KPI Mese Visualizzato */}
        <Grid item xs={12}>
          <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
            {selectedYear === currentYear
              ? `Statistiche ${MONTH_NAMES[displayMonthData.month - 1]} ${selectedYear}`
              : `Statistiche ${MONTH_NAMES[displayMonthData.month - 1]} ${selectedYear} (Mese Migliore)`
            }
          </Typography>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KPICard
            title={`Ricavo ${MONTH_NAMES[displayMonthData.month - 1]}`}
            value={`€ ${displayMonthData.totalRevenue?.toFixed(2) || "0.00"}`}
            subtitle={`${displayMonthData.count} registrazioni`}
            trend={monthTrend}
            icon={<PointOfSaleIcon sx={{ fontSize: 48 }} />}
            color="primary"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KPICard
            title="Pago in contanti Mese"
            value={`€ ${displayMonthData.totalCash?.toFixed(2) || "0.00"}`}
            icon={<AccountBalanceWalletIcon sx={{ fontSize: 48 }} />}
            color="success"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KPICard
            title="Pagamenti Elettronici Mese"
            value={`€ ${displayMonthData.totalElectronic?.toFixed(2) || "0.00"}`}
            icon={<CreditCardIcon sx={{ fontSize: 48 }} />}
            color="info"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KPICard
            title="Media Giornaliera Mese"
            value={`€ ${(displayMonthData.count > 0 ? displayMonthData.totalRevenue / displayMonthData.count : 0)?.toFixed(2) || "0.00"}`}
            subtitle={`${displayMonthData.count} giorni registrati`}
            icon={<TrendingUpIcon sx={{ fontSize: 48 }} />}
            color="secondary"
          />
        </Grid>

        {/* KPI Annuali */}
        <Grid item xs={12}>
          <Typography variant="h6" gutterBottom sx={{ mt: 2, mb: 2 }}>
            Statistiche Anno {selectedYear}
          </Typography>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KPICard
            title={`Ricavo Totale ${selectedYear}`}
            value={`€ ${yearlyData.yearlyTotals.totalRevenue?.toFixed(2) || "0.00"}`}
            subtitle={`${yearlyData.yearlyTotals.count} registrazioni`}
            icon={<EuroIcon sx={{ fontSize: 48 }} />}
            color="primary"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KPICard
            title="Pago in contanti Anno"
            value={`€ ${yearlyData.yearlyTotals.totalCash?.toFixed(2) || "0.00"}`}
            icon={<AccountBalanceWalletIcon sx={{ fontSize: 48 }} />}
            color="success"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KPICard
            title="Pagamenti Elettronici Anno"
            value={`€ ${yearlyData.yearlyTotals.totalElectronic?.toFixed(2) || "0.00"}`}
            icon={<CreditCardIcon sx={{ fontSize: 48 }} />}
            color="info"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KPICard
            title="Media Giornaliera Anno"
            value={`€ ${yearlyData.yearlyTotals.averageDaily?.toFixed(2) || "0.00"}`}
            subtitle={`${yearlyData.yearlyTotals.count} giorni lavorati`}
            icon={<TrendingUpIcon sx={{ fontSize: 48 }} />}
            color="secondary"
          />
        </Grid>

        {/* Grafico Trend Ricavi Mensili */}
        <Grid item xs={12} lg={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Trend Ricavi Mensili {selectedYear}
              </Typography>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={monthlyChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value) => `€ ${Number(value).toFixed(2)}`} />
                  <Legend />
                  <Bar dataKey="ricavo" name="Ricavo Totale" fill={CHART_COLORS.primary} />
                  <Bar dataKey="contanti" name="Pago in contanti" fill={CHART_COLORS.cash} />
                  <Bar dataKey="elettronici" name="Pagamenti Elettronici" fill={CHART_COLORS.electronic} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Grafico Breakdown Pagamenti */}
        <Grid item xs={12} lg={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Distribuzione Pagamenti {selectedYear}
              </Typography>
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie
                    data={paymentBreakdownData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${percent !== undefined ? (percent * 100).toFixed(0) : '0'}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {paymentBreakdownData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `€ ${Number(value).toFixed(2)}`} />
                </PieChart>
              </ResponsiveContainer>
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  <strong>Ricavo Totale:</strong> € {yearlyData.yearlyTotals.totalRevenue?.toFixed(2) || "0.00"}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <strong>Giorni con differenze:</strong> {yearlyData.yearlyTotals.totalDaysWithDifferences}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <strong>IVA totale:</strong> € {yearlyData.yearlyTotals.totalVat?.toFixed(2) || "0.00"}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Grafico Trend Lineare */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Andamento Ricavi {selectedYear}
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value) => `€ ${Number(value).toFixed(2)}`} />
                  <Legend />
                  <Line type="monotone" dataKey="ricavo" name="Ricavo Totale" stroke={CHART_COLORS.primary} strokeWidth={2} fill="none" />
                  <Line type="monotone" dataKey="contanti" name="Pago in contanti" stroke={CHART_COLORS.cash} strokeWidth={2} fill="none" />
                  <Line type="monotone" dataKey="elettronici" name="Pagamenti Elettronici" stroke={CHART_COLORS.electronic} strokeWidth={2} fill="none" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

export default RegistrazioneCassDashboard;
