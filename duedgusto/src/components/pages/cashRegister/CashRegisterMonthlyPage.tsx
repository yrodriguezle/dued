import { useCallback, useContext, useMemo, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Box, CircularProgress } from "@mui/material";
import dayjs from "dayjs";
import PageTitleContext from "../../layout/headerBar/PageTitleContext";
import useQueryCashRegistersByMonth from "../../../graphql/cashRegister/useQueryCashRegistersByMonth";
import CustomCalendar from "./CustomCalendar";

interface CashEvent {
  id: number | string;
  title: string;
  start: Date;
  end: Date;
  registerId?: number;
  date: string;
  resource?: {
    registerId: number;
    date: string;
  };
}

function CashRegisterMonthlyPage() {
  const navigate = useNavigate();
  const { setTitle } = useContext(PageTitleContext);
  const [searchParams] = useSearchParams();

  // Leggi anno e mese dai parametri URL, altrimenti usa la data corrente
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

  // Aggiorna currentDate quando cambiano i parametri URL
  useEffect(() => {
    setCurrentDate(initialDate);
  }, [initialDate]);

  const currentYear = dayjs(currentDate).year();
  const currentMonth = dayjs(currentDate).month() + 1;

  const { cashRegisters, loading } = useQueryCashRegistersByMonth({
    year: currentYear,
    month: currentMonth,
    skip: false,
  });

  // Effetto di impostazione del titolo
  useEffect(() => {
    setTitle("Cassa - Vista Mensile");
  }, [setTitle]);

  // Conversione casse in eventi per Custom Calendar
  const events = useMemo<CashEvent[]>(() => {
    return cashRegisters.map((cr: CashRegister, index: number) => {
      const date = new Date(cr.date);
      // Calcola ricavo: (chiusura + fatture) - (apertura + spese)
      const revenue =
        (cr.closingTotal || 0) + (cr.invoicePayments || 0) -
        (cr.openingTotal || 0) - (cr.supplierExpenses || 0) - (cr.dailyExpenses || 0);

      return {
        id: cr.registerId || index,
        title: `Ricavo: €${revenue.toFixed(2)}`,
        start: date,
        end: date,
        registerId: cr.registerId,
        date: cr.date,
        resource: {
          registerId: cr.registerId,
          date: cr.date,
        },
      };
    });
  }, [cashRegisters]);

  const handleSelectEvent = useCallback(
    (event: CashEvent) => {
      // Extract date from event and navigate to that date
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

  const handleMonthChange = useCallback(
    (date: Date) => {
      setCurrentDate(date);
    },
    []
  );

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        height: "calc(100vh - 64px - 41px)",
        padding: 2,
        overflow: "hidden",
        fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
      }}
    >
      <CustomCalendar
        events={events}
        onSelectEvent={handleSelectEvent}
        onSelectSlot={handleSelectSlot}
        currentDate={currentDate}
        onMonthChange={handleMonthChange}
      />
    </Box>
  );
}

export default CashRegisterMonthlyPage;
