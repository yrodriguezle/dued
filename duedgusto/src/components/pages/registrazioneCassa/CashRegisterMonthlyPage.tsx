import { useCallback, useContext, useMemo, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Box, Typography, Toolbar, IconButton, CircularProgress, Divider, Chip } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import SummarizeIcon from "@mui/icons-material/Summarize";
import dayjs from "dayjs";
import "dayjs/locale/it";
import PageTitleContext from "../../layout/headerBar/PageTitleContext";
import useQueryCashRegistersByMonth from "../../../graphql/cashRegister/useQueryCashRegistersByMonth";
import FormikToolbarButton from "../../common/form/toolbar/FormikToolbarButton";
import CustomCalendar from "./CustomCalendar";

dayjs.locale("it");

export interface CashEvent {
  id: number | string;
  title: string;
  start: Date;
  end: Date;
  registerId?: number;
  date: string;
  stato: string;
  revenue: number;
  contanti: number;
  elettronici: number;
  fatture: number;
}

function CashRegisterMonthlyPage() {
  const navigate = useNavigate();
  const { setTitle } = useContext(PageTitleContext);
  const [searchParams] = useSearchParams();

  const yearParam = searchParams.get("year");
  const monthParam = searchParams.get("month");

  const initialDate = useMemo(() => {
    if (yearParam && monthParam) {
      const year = parseInt(yearParam, 10);
      const month = parseInt(monthParam, 10);
      if (!isNaN(year) && !isNaN(month) && month >= 1 && month <= 12) {
        return new Date(year, month - 1, 1);
      }
    }
    return new Date();
  }, [yearParam, monthParam]);

  const [currentDate, setCurrentDate] = useState(initialDate);

  useEffect(() => {
    setCurrentDate(initialDate);
  }, [initialDate]);

  const currentYear = dayjs(currentDate).year();
  const currentMonth = dayjs(currentDate).month() + 1;
  const monthLabel = dayjs(currentDate).format("MMMM YYYY");

  const { cashRegisters, loading } = useQueryCashRegistersByMonth({
    year: currentYear,
    month: currentMonth,
    skip: false,
  });

  useEffect(() => {
    setTitle("Cassa - Vista Mensile");
  }, [setTitle]);

  // Metriche mensili calcolate dai registri
  const monthlyStats = useMemo(() => {
    const totals = cashRegisters.reduce(
      (acc, cr: RegistroCassa) => {
        const revenue = (cr.totaleChiusura || 0) + (cr.incassiFattura || 0) - (cr.totaleApertura || 0) - (cr.speseFornitori || 0) - (cr.speseGiornaliere || 0);
        return {
          ricavo: acc.ricavo + revenue,
          contanti: acc.contanti + (cr.incassoContanteTracciato || 0),
          elettronici: acc.elettronici + (cr.incassiElettronici || 0),
          fatture: acc.fatture + (cr.incassiFattura || 0),
          registri: acc.registri + 1,
          chiusi: acc.chiusi + (cr.stato === "CLOSED" || cr.stato === "RECONCILED" ? 1 : 0),
          riconciliati: acc.riconciliati + (cr.stato === "RECONCILED" ? 1 : 0),
          bozze: acc.bozze + (cr.stato === "DRAFT" ? 1 : 0),
        };
      },
      { ricavo: 0, contanti: 0, elettronici: 0, fatture: 0, registri: 0, chiusi: 0, riconciliati: 0, bozze: 0 }
    );
    return totals;
  }, [cashRegisters]);

  // Eventi per il calendario
  const events = useMemo<CashEvent[]>(() => {
    return cashRegisters.map((cr: RegistroCassa, index: number) => {
      const date = new Date(cr.data);
      const revenue = (cr.totaleChiusura || 0) + (cr.incassiFattura || 0) - (cr.totaleApertura || 0) - (cr.speseFornitori || 0) - (cr.speseGiornaliere || 0);

      return {
        id: cr.id || index,
        title: `\u20AC ${revenue.toFixed(2)}`,
        start: date,
        end: date,
        registerId: cr.id,
        date: cr.data,
        stato: cr.stato,
        revenue,
        contanti: cr.incassoContanteTracciato || 0,
        elettronici: cr.incassiElettronici || 0,
        fatture: cr.incassiFattura || 0,
      };
    });
  }, [cashRegisters]);

  const handleSelectEvent = useCallback(
    (event: CashEvent) => {
      const eventDate = dayjs(event.start).format("YYYY-MM-DD");
      navigate(`/gestionale/cassa/${eventDate}`);
    },
    [navigate]
  );

  const handleSelectSlot = useCallback(
    (slotInfo: { start: Date }) => {
      const selectedDate = dayjs(slotInfo.start).format("YYYY-MM-DD");
      navigate(`/gestionale/cassa/${selectedDate}`);
    },
    [navigate]
  );

  const handlePrevMonth = useCallback(() => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  }, []);

  const handleNextMonth = useCallback(() => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  }, []);

  const handlePrevYear = useCallback(() => {
    setCurrentDate((prev) => new Date(prev.getFullYear() - 1, prev.getMonth(), 1));
  }, []);

  const handleNextYear = useCallback(() => {
    setCurrentDate((prev) => new Date(prev.getFullYear() + 1, prev.getMonth(), 1));
  }, []);

  const handleBack = useCallback(() => {
    navigate("/gestionale/cassa/details");
  }, [navigate]);

  const handleChiusuraMensile = useCallback(() => {
    navigate(`/gestionale/cassa/monthly-closure/new?anno=${currentYear}&mese=${currentMonth}`);
  }, [navigate, currentYear, currentMonth]);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "50vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "calc(100vh - 64px)" }}>
      {/* Toolbar */}
      <Box sx={{ borderBottom: 1, borderColor: "divider", bgcolor: "background.paper", flexShrink: 0 }}>
        <Toolbar variant="dense" disableGutters sx={{ minHeight: 48, height: 48, display: "flex", justifyContent: "space-between" }}>
          <Box sx={{ height: 48, display: "flex", alignItems: "stretch" }}>
            <FormikToolbarButton startIcon={<ArrowBackIcon />} onClick={handleBack}>
              Indietro
            </FormikToolbarButton>
            <FormikToolbarButton startIcon={<SummarizeIcon />} onClick={handleChiusuraMensile}>
              Chiusura Mensile
            </FormikToolbarButton>
          </Box>

          {/* Navigazione mese e anno */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, pr: 1 }}>
            <IconButton size="small" onClick={handlePrevYear} title="Anno precedente">
              <ChevronLeftIcon fontSize="small" />
              <ChevronLeftIcon fontSize="small" sx={{ ml: -1.2 }} />
            </IconButton>
            <IconButton size="small" onClick={handlePrevMonth} title="Mese precedente">
              <ChevronLeftIcon />
            </IconButton>
            <Typography variant="body1" sx={{ minWidth: 160, textAlign: "center", fontWeight: 600, textTransform: "capitalize" }}>
              {monthLabel}
            </Typography>
            <IconButton size="small" onClick={handleNextMonth} title="Mese successivo">
              <ChevronRightIcon />
            </IconButton>
            <IconButton size="small" onClick={handleNextYear} title="Anno successivo">
              <ChevronRightIcon fontSize="small" sx={{ mr: -1.2 }} />
              <ChevronRightIcon fontSize="small" />
            </IconButton>
          </Box>
        </Toolbar>
      </Box>

      {/* KPI Strip */}
      {cashRegisters.length > 0 && (
        <Box sx={{ flexShrink: 0, borderBottom: 1, borderColor: "divider", bgcolor: "background.paper", px: 2, py: 1.5 }}>
          <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 3 }}>
            <Box sx={{ minWidth: 110 }}>
              <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1 }}>
                Ricavo Totale
              </Typography>
              <Typography variant="h6" fontWeight="bold" color="primary.main" sx={{ lineHeight: 1.3 }}>
                {`\u20AC ${monthlyStats.ricavo.toFixed(2)}`}
              </Typography>
            </Box>
            <Divider orientation="vertical" flexItem />
            <Box sx={{ minWidth: 100 }}>
              <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1 }}>
                Contanti
              </Typography>
              <Typography variant="body1" fontWeight="bold" color="success.main" sx={{ lineHeight: 1.3 }}>
                {`\u20AC ${monthlyStats.contanti.toFixed(2)}`}
              </Typography>
            </Box>
            <Box sx={{ minWidth: 100 }}>
              <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1 }}>
                Elettronici
              </Typography>
              <Typography variant="body1" fontWeight="bold" color="info.main" sx={{ lineHeight: 1.3 }}>
                {`\u20AC ${monthlyStats.elettronici.toFixed(2)}`}
              </Typography>
            </Box>
            <Box sx={{ minWidth: 90 }}>
              <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1 }}>
                Fatture
              </Typography>
              <Typography variant="body1" fontWeight="bold" sx={{ lineHeight: 1.3 }}>
                {`\u20AC ${monthlyStats.fatture.toFixed(2)}`}
              </Typography>
            </Box>
            <Divider orientation="vertical" flexItem />
            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              <Chip label={`${monthlyStats.registri} registri`} size="small" variant="outlined" />
              {monthlyStats.riconciliati > 0 && <Chip label={`${monthlyStats.riconciliati} riconciliati`} size="small" color="success" variant="outlined" />}
              {monthlyStats.bozze > 0 && <Chip label={`${monthlyStats.bozze} bozze`} size="small" color="warning" variant="outlined" />}
            </Box>
          </Box>
        </Box>
      )}

      {/* Calendario */}
      <Box sx={{ flex: 1, overflow: "hidden", minHeight: 0 }}>
        <CustomCalendar events={events} onSelectEvent={handleSelectEvent} onSelectSlot={handleSelectSlot} currentDate={currentDate} />
      </Box>
    </Box>
  );
}

export default CashRegisterMonthlyPage;
