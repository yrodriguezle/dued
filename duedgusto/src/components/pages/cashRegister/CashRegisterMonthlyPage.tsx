import { useCallback, useContext, useMemo, useEffect } from "react";
import { useNavigate } from "react-router";
import { Calendar, Views, dateFnsLocalizer, Event } from "react-big-calendar";
import { format, parse, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { it } from "date-fns/locale";
import dayjs from "dayjs";
import { Box, CircularProgress, Paper } from "@mui/material";
import PageTitleContext from "../../layout/headerBar/PageTitleContext";
import useQueryCashRegistersByMonth from "../../../graphql/cashRegister/useQueryCashRegistersByMonth";
import { getCurrentDate } from "../../../common/date/date";
import "react-big-calendar/lib/css/react-big-calendar.css";

const locales = {
  it,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  formats: {
    dateFormat: "d",
    dayFormat: "EEEE d",
    weekdayFormat: "EEEE",
    monthHeaderFormat: "MMMM yyyy",
    dayHeaderFormat: "EEEE d MMM",
    dayRangeHeaderFormat: ({ start, end }: { start: Date; end: Date }) =>
      `${format(start, "d MMM", { locale: it })} – ${format(end, "d MMM yyyy", { locale: it })}`,
  },
  locales,
});

interface CashEvent extends Event {
  registerId: number;
  date: string;
  resource: {
    registerId: number;
    date: string;
  };
}

function CashRegisterMonthlyPage() {
  const navigate = useNavigate();
  const { setTitle } = useContext(PageTitleContext);
  const today = getCurrentDate("YYYY-MM-DD");
  const currentYear = dayjs(today).year();
  const currentMonth = dayjs(today).month() + 1;

  const { cashRegisters, loading } = useQueryCashRegistersByMonth({
    year: currentYear,
    month: currentMonth,
    skip: false,
  });

  // Effetto di impostazione del titolo
  useEffect(() => {
    setTitle("Cassa - Vista Mensile");
  }, [setTitle]);

  // Conversione casse in eventi per Big Calendar
  const events = useMemo<CashEvent[]>(() => {
    return cashRegisters.map((cr: CashRegister) => {
      const date = new Date(cr.date);
      return {
        id: cr.registerId,
        title: `Cassa: €${(cr.closingTotal || 0).toFixed(2)}`,
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
      navigate(`/gestionale/cassa/${event.registerId}`);
    },
    [navigate]
  );

  const handleSelectSlot = useCallback(
    (slotInfo: { start: Date }) => {
      const selectedDate = dayjs(slotInfo.start).format("YYYY-MM-DD");
      navigate(`/gestionale/cassa?date=${selectedDate}`);
    },
    [navigate]
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
        "& .rbc-calendar": {
          fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
        },
        "& .rbc-header": {
          padding: "12px 3px",
          fontWeight: 600,
          fontSize: "0.875rem",
          textTransform: "capitalize",
        },
        "& .rbc-today": {
          backgroundColor: "#e3f2fd",
        },
        "& .rbc-off-range-bg": {
          backgroundColor: "#fafafa",
        },
        "& .rbc-event": {
          padding: "2px 5px",
          backgroundColor: "#1976d2",
          borderRadius: "4px",
          fontSize: "0.75rem",
          cursor: "pointer",
        },
        "& .rbc-event:hover": {
          backgroundColor: "#1565c0",
          boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
        },
        "& .rbc-event-content": {
          padding: "4px",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        },
        "& .rbc-day-slot .rbc-time-slot": {
          display: "none",
        },
        "& .rbc-time-header": {
          display: "none",
        },
        "& .rbc-toolbar": {
          padding: "16px 0",
          gap: "10px",
          flexWrap: "wrap",
          "& button": {
            padding: "6px 12px",
            fontSize: "0.875rem",
            borderRadius: "4px",
            border: "1px solid #e0e0e0",
            backgroundColor: "#fff",
            cursor: "pointer",
            transition: "all 0.2s",
            "&:hover": {
              backgroundColor: "#f5f5f5",
              borderColor: "#bdbdbd",
            },
            "&.rbc-active": {
              backgroundColor: "#1976d2",
              color: "#fff",
              borderColor: "#1976d2",
            },
          },
          "& .rbc-toolbar-label": {
            fontSize: "1.125rem",
            fontWeight: 600,
            flex: "0 0 auto",
          },
        },
        "& .rbc-date-cell": {
          padding: "2px",
          textAlign: "right",
          fontSize: "0.875rem",
        },
      }}
    >
      <Paper elevation={0} sx={{ height: "100%", overflow: "auto" }}>
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: "100%" }}
          view={Views.MONTH}
          views={[Views.MONTH]}
          onSelectEvent={handleSelectEvent}
          onSelectSlot={handleSelectSlot}
          selectable
          popup
          eventPropGetter={() => ({
            style: {
              backgroundColor: "#1976d2",
              borderRadius: "4px",
              opacity: 0.8,
              color: "white",
              border: "0px",
              display: "block",
            },
          })}
          dayPropGetter={(date) => {
            const isToday = dayjs(date).format("YYYY-MM-DD") === today;
            return {
              style: {
                backgroundColor: isToday ? "#e3f2fd" : "transparent",
              },
            };
          }}
        />
      </Paper>
    </Box>
  );
}

export default CashRegisterMonthlyPage;
