import { useCallback, useContext, useMemo, useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Box, LinearProgress } from "@mui/material";
import dayjs from "dayjs";
import "dayjs/locale/it";
import PageTitleContext from "../../../layout/headerBar/PageTitleContext";
import useQueryCashRegistersByMonth from "../../../../graphql/cashRegister/useQueryCashRegistersByMonth";
import useRegistroCassaSubscription from "../../../../graphql/subscriptions/useRegistroCassaSubscription";
import ToolbarNavigazioneMensile from "./ToolbarNavigazioneMensile";
import RiepilogoIncassiMensile from "./RiepilogoIncassiMensile";
import CalendarioCassaMensile from "./CalendarioCassaMensile";

dayjs.locale("it");

export interface CashEvent {
  id: number | string;
  title: string;
  start: Date;
  end: Date;
  date: string;
  stato: string;
  revenue: number;
  contanti: number;
  elettronici: number;
  fatture: number;
}

function VistaMensile() {
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

  const { cashRegisters, loading, refresh } = useQueryCashRegistersByMonth({
    year: currentYear,
    month: currentMonth,
    skip: false,
  });

  // Subscription: aggiorna la vista quando un registro cassa viene modificato/chiuso
  const { data: subscriptionData } = useRegistroCassaSubscription();
  const lastEventRef = useRef(subscriptionData);

  useEffect(() => {
    if (subscriptionData && subscriptionData !== lastEventRef.current) {
      lastEventRef.current = subscriptionData;
      refresh();
    }
  }, [subscriptionData, refresh]);

  useEffect(() => {
    setTitle("Cassa - Vista Mensile");
  }, [setTitle]);

  // Metriche mensili — stesse formule del riepilogo giornaliero (SummaryDataGrid)
  const monthlyStats = useMemo(() => {
    return cashRegisters.reduce(
      (acc, cr: RegistroCassa) => {
        const movimento = (cr.totaleChiusura || 0) - (cr.totaleApertura || 0);
        const contantiDichiarati = cr.incassoContanteTracciato ?? 0;
        const elettronici = cr.incassiElettronici ?? 0;
        const fatture = cr.incassiFattura ?? 0;
        return {
          contanti: acc.contanti + contantiDichiarati,
          elettronici: acc.elettronici + elettronici,
          totaleVendite: acc.totaleVendite + movimento + elettronici + fatture,
          fatture: acc.fatture + fatture,
          spese: acc.spese + (cr.speseFornitori || 0) + (cr.speseGiornaliere || 0),
          registri: acc.registri + 1,
          chiusi: acc.chiusi + (cr.stato === "CLOSED" || cr.stato === "RECONCILED" ? 1 : 0),
          bozze: acc.bozze + (cr.stato === "DRAFT" ? 1 : 0),
        };
      },
      { totaleVendite: 0, contanti: 0, elettronici: 0, fatture: 0, spese: 0, registri: 0, chiusi: 0, bozze: 0 }
    );
  }, [cashRegisters]);

  // Eventi per il calendario
  const events = useMemo<CashEvent[]>(() => {
    return cashRegisters.map((cr: RegistroCassa, index: number) => {
      const date = new Date(cr.data);
      const revenue = (cr.totaleChiusura || 0) - (cr.totaleApertura || 0) + (cr.incassiElettronici || 0);

      return {
        id: cr.id || index,
        title: `\u20AC ${revenue.toFixed(2)}`,
        start: date,
        end: date,
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

  const navigateToMonth = useCallback(
    (date: Date) => {
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      navigate(`/gestionale/cassa/monthly?year=${year}&month=${month}`, { replace: true });
    },
    [navigate]
  );

  const handlePrevMonth = useCallback(() => {
    navigateToMonth(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  }, [currentDate, navigateToMonth]);

  const handleNextMonth = useCallback(() => {
    navigateToMonth(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  }, [currentDate, navigateToMonth]);

  const handlePrevYear = useCallback(() => {
    navigateToMonth(new Date(currentDate.getFullYear() - 1, currentDate.getMonth(), 1));
  }, [currentDate, navigateToMonth]);

  const handleNextYear = useCallback(() => {
    navigateToMonth(new Date(currentDate.getFullYear() + 1, currentDate.getMonth(), 1));
  }, [currentDate, navigateToMonth]);

  const handleDateChange = useCallback(
    (date: Date) => {
      navigateToMonth(date);
    },
    [navigateToMonth]
  );

  const handleBack = useCallback(() => {
    navigate("/gestionale/cassa/details");
  }, [navigate]);

  const handleChiusuraMensile = useCallback(() => {
    navigate(`/gestionale/cassa/monthly-closure/new?anno=${currentYear}&mese=${currentMonth}`);
  }, [navigate, currentYear, currentMonth]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "calc(100dvh - 64px)" }}>
      <ToolbarNavigazioneMensile
        currentDate={currentDate}
        monthLabel={monthLabel}
        onDateChange={handleDateChange}
        onBack={handleBack}
        onChiusuraMensile={handleChiusuraMensile}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
        onPrevYear={handlePrevYear}
        onNextYear={handleNextYear}
      />
      <LinearProgress sx={{ flexShrink: 0, visibility: loading ? "visible" : "hidden" }} />
      <RiepilogoIncassiMensile stats={monthlyStats} />
      <CalendarioCassaMensile
        events={events}
        currentDate={currentDate}
        onSelectEvent={handleSelectEvent}
        onSelectSlot={handleSelectSlot}
      />
    </Box>
  );
}

export default VistaMensile;
