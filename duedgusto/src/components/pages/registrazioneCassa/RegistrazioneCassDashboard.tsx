import { useCallback, useContext, useEffect, useState } from "react";
import { Alert, Box, Button, LinearProgress, Paper, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import PointOfSaleIcon from "@mui/icons-material/PointOfSale";
import { useNavigate } from "react-router";

import PageTitleContext from "../../layout/headerBar/PageTitleContext";
import useStore from "../../../store/useStore";
import DashboardHeader from "./dashboard/DashboardHeader";
import HeroKpiSection from "./dashboard/HeroKpiSection";
import DonutDistribuzioneIncassi from "./dashboard/DonutDistribuzioneIncassi";
import SankeyFlussoCassaLazy from "./dashboard/SankeyFlussoCassaLazy";
import TrendMensile from "./dashboard/TrendMensile";
import useDashboardData from "./dashboard/useDashboardData";
import { periodoMesePrecedente } from "./dashboard/dashboardUtils";

/**
 * Orchestratore della dashboard cassa (change dashboard-charts-redesign):
 * stato periodo (mese + anno) + contratto dati unico `useDashboardData`,
 * composizione delle sezioni presentazionali (hero KPI, Sankey lazy, donut,
 * trend) su griglia 12 colonne. Layout react-best-practices §1: flex column,
 * header fisso, scroll singolo del contenuto. Depth borders-only (Paper
 * outlined).
 *
 * Il periodo parte dal mese precedente (l'ultimo mese completo): il mese in
 * corso ha registri parziali e KPI non confrontabili. L'utente può comunque
 * scegliere qualsiasi mese/anno dall'header.
 */
function RegistrazioneCassDashboard() {
  const { setTitle } = useContext(PageTitleContext);
  const navigate = useNavigate();
  const getNextOperatingDate = useStore((state) => state.getNextOperatingDate);

  const [periodo, setPeriodo] = useState(periodoMesePrecedente);
  const { anno: selectedYear, mese: selectedMonth } = periodo;
  const { riepilogo, meseRiferimento, loading, error, refetch } = useDashboardData({ anno: selectedYear, mese: selectedMonth });

  useEffect(() => {
    setTitle("Dashboard Cassa");
  }, [setTitle]);

  const handleAnnoChange = useCallback((anno: number) => {
    setPeriodo((precedente) => ({ ...precedente, anno }));
  }, []);

  const handleMeseChange = useCallback((mese: number) => {
    setPeriodo((precedente) => ({ ...precedente, mese }));
  }, []);

  const handleRetry = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleNuovaCassa = useCallback(() => {
    const data = getNextOperatingDate();
    const dataStr = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
    navigate(`/gestionale/cassa/details/${dataStr}`);
  }, [getNextOperatingDate, navigate]);

  // Primo caricamento: nessun dato ancora ricevuto (mesi non normalizzati a 12)
  // → skeleton per sezione, struttura e header restano visibili e interattivi.
  const primoCaricamento = loading && riepilogo.mesi.length === 0;
  // Rivalidazione cache-and-network con dati visibili → solo barra sottile.
  const rivalidazione = loading && riepilogo.mesi.length > 0;
  // Anno senza registri (dati arrivati) → empty state unico con CTA.
  const annoVuoto = !loading && !error && riepilogo.mesi.length > 0 && riepilogo.totaliAnno.registri === 0;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "calc(var(--app-height, 100dvh) - 64px)" }}>
      <DashboardHeader
        anno={selectedYear}
        mese={selectedMonth}
        onAnnoChange={handleAnnoChange}
        onMeseChange={handleMeseChange}
      />
      {/* Altezza zero: la barra di rivalidazione non crea gap sotto l'header */}
      <Box sx={{ position: "relative", flexShrink: 0, height: 0, zIndex: 1 }}>
        <LinearProgress sx={{ position: "absolute", top: 0, left: 0, right: 0, visibility: rivalidazione ? "visible" : "hidden" }} />
      </Box>

      <Box sx={{ flex: 1, overflow: "auto", minHeight: 0, px: 2, py: 2 }}>
        {error ? (
          <Alert
            severity="error"
            action={
              <Button
                color="inherit"
                size="small"
                onClick={handleRetry}
              >
                Riprova
              </Button>
            }
          >
            {`Errore nel caricamento della dashboard: ${error.message}`}
          </Alert>
        ) : annoVuoto ? (
          <Paper
            variant="outlined"
            sx={{ p: 6, display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5, textAlign: "center" }}
          >
            <PointOfSaleIcon sx={{ fontSize: 56, color: "text.disabled" }} />
            <Typography
              variant="h6"
              fontWeight={600}
            >
              {`Nessun registro per il ${selectedYear}`}
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
            >
              Crea la prima cassa dell&apos;anno per popolare KPI e grafici.
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleNuovaCassa}
              sx={{ mt: 1 }}
            >
              Nuova Cassa
            </Button>
          </Paper>
        ) : (
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-12">
              <HeroKpiSection
                riepilogo={riepilogo}
                meseRiferimento={meseRiferimento}
                loading={primoCaricamento}
              />
            </div>
            <div className="col-span-12 lg:col-span-8">
              <SankeyFlussoCassaLazy
                riepilogo={riepilogo}
                loading={primoCaricamento}
              />
            </div>
            <div className="col-span-12 lg:col-span-4">
              <DonutDistribuzioneIncassi
                riepilogo={riepilogo}
                loading={primoCaricamento}
              />
            </div>
            <div className="col-span-12">
              <TrendMensile
                riepilogo={riepilogo}
                loading={primoCaricamento}
              />
            </div>
          </div>
        )}
      </Box>
    </Box>
  );
}

export default RegistrazioneCassDashboard;
