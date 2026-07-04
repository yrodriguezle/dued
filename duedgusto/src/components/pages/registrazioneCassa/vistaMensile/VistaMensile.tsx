import { useCallback, useContext, useMemo, useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Box, LinearProgress } from "@mui/material";
import dayjs from "dayjs";
import "dayjs/locale/it";
import PageTitleContext from "../../../layout/headerBar/PageTitleContext";
import formatCurrency from "../../../../common/bones/formatCurrency";
import useQueryCashRegistersByMonth from "../../../../graphql/registroCassa/useQueryCashRegistersByMonth";
import useRegistroCassaSubscription from "../../../../graphql/subscriptions/useRegistroCassaSubscription";
import ToolbarNavigazioneMensile from "./ToolbarNavigazioneMensile";
import RiepilogoIncassiMensile from "./RiepilogoIncassiMensile";
import CalendarioCassaMensile from "./CalendarioCassaMensile";
import { statoRegistroCassa } from "../../../../common/globals/constants";

dayjs.locale("it");

export interface CashEvent {
  id: number | string;
  title: string;
  start: Date;
  end: Date;
  date: string;
  stato: string;
  revenue: number;
  spese: number;
  differenza: number;
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

  // Metriche mensili:
  // - Totale Vendite = Σ totaleVendite (fallback: movimento fisico + elettronici + fatture)
  // - Ricavo tracciato = Σ contante tracciato + elettronici + fatture
  // - Ricavo non tracciato = Σ movimento fisico - Σ contante tracciato (ECC)
  // - Spese tracciate = Σ speseFornitori (DDT/fattura); non tracciate = Σ speseGiornaliere
  const monthlyStats = useMemo(() => {
    return cashRegisters.reduce(
      (acc, cr: RegistroCassa) => {
        const movimentoCassa = (cr.totaleChiusura ?? 0) - (cr.totaleApertura ?? 0);
        const contanteTracciato = cr.incassoContanteTracciato ?? 0;
        const elettronici = cr.incassiElettronici ?? 0;
        const fatture = cr.incassiFattura ?? 0;
        // Totale Vendite — valore server quando disponibile (backend unica fonte di
        // verità); fallback con la stessa formula backend/KPI giornaliero.
        const venditeRegistro = cr.totaleVendite ?? movimentoCassa + elettronici + fatture;
        return {
          totaleVendite: acc.totaleVendite + venditeRegistro,
          ricavoTracciato: acc.ricavoTracciato + contanteTracciato + elettronici + fatture,
          ricavoNonTracciato: acc.ricavoNonTracciato + (movimentoCassa - contanteTracciato),
          speseTracciate: acc.speseTracciate + (cr.speseFornitori || 0),
          speseNonTracciate: acc.speseNonTracciate + (cr.speseGiornaliere || 0),
          registri: acc.registri + 1,
          chiusi: acc.chiusi + (cr.stato === statoRegistroCassa.CLOSED || cr.stato === statoRegistroCassa.RECONCILED ? 1 : 0),
          bozze: acc.bozze + (cr.stato === statoRegistroCassa.DRAFT ? 1 : 0),
        };
      },
      { totaleVendite: 0, ricavoTracciato: 0, ricavoNonTracciato: 0, speseTracciate: 0, speseNonTracciate: 0, registri: 0, chiusi: 0, bozze: 0 }
    );
  }, [cashRegisters]);

  // Eventi per il calendario
  const events = useMemo<CashEvent[]>(() => {
    return cashRegisters.map((cr: RegistroCassa, index: number) => {
      const date = new Date(cr.data);
      // Revenue — valore server con fallback alla stessa formula backend/KPI
      // giornaliero: movimento fisico di cassa + elettronici + fatture.
      const movimentoCassa = (cr.totaleChiusura ?? 0) - (cr.totaleApertura ?? 0);
      const revenue = cr.totaleVendite ?? movimentoCassa + (cr.incassiElettronici || 0) + (cr.incassiFattura || 0);
      const spese = (cr.speseFornitori || 0) + (cr.speseGiornaliere || 0);

      return {
        id: cr.id || index,
        title: `\u20AC ${formatCurrency(revenue)}`,
        start: date,
        end: date,
        date: cr.data,
        stato: cr.stato,
        revenue,
        spese,
        differenza: revenue - spese,
      };
    });
  }, [cashRegisters]);

  const handleSelectEvent = useCallback(
    (event: CashEvent) => {
      const eventDate = dayjs(event.start).format("YYYY-MM-DD");
      navigate(`/gestionale/cassa/details/${eventDate}`);
    },
    [navigate]
  );

  const handleSelectSlot = useCallback(
    (slotInfo: { start: Date }) => {
      const selectedDate = dayjs(slotInfo.start).format("YYYY-MM-DD");
      navigate(`/gestionale/cassa/details/${selectedDate}`);
    },
    [navigate]
  );

  const navigateToMonth = useCallback(
    (date: Date) => {
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      navigate(`/gestionale/cassa/vista-mensile?year=${year}&month=${month}`, { replace: true });
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
    navigate(`/gestionale/cassa/chiusura-mensile/new?anno=${currentYear}&mese=${currentMonth}`);
  }, [navigate, currentYear, currentMonth]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "calc(100dvh - 64px)" }}>
      <ToolbarNavigazioneMensile
        currentDate={currentDate}
        monthLabel={monthLabel}
        onDateChange={handleDateChange}
        onBack={handleBack}
        onChiusuraMensile={handleChiusuraMensile}
        onRefresh={refresh}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
        onPrevYear={handlePrevYear}
        onNextYear={handleNextYear}
      />
      {/* Altezza zero: la barra si sovrappone ai KPI senza creare gap tra toolbar e riepilogo */}
      <Box sx={{ position: "relative", flexShrink: 0, height: 0, zIndex: 1 }}>
        <LinearProgress sx={{ position: "absolute", top: 0, left: 0, right: 0, visibility: loading ? "visible" : "hidden" }} />
      </Box>
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
