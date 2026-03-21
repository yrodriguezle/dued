import { useMemo, useCallback } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek } from "date-fns";
import dayjs from "dayjs";
import { Box, Typography, useTheme, useMediaQuery, alpha, Tooltip } from "@mui/material";
import useStore from "../../../../store/useStore";
import type { CashEvent } from "./RegistroCassaVistaMensile";

const STATO_CONFIG: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "Bozza", color: "warning.main" },
  CLOSED: { label: "Chiuso", color: "success.main" },
  RECONCILED: { label: "Riconciliato", color: "info.main" },
};

const WEEKDAYS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

interface CustomCalendarProps {
  events: CashEvent[];
  onSelectEvent: (event: CashEvent) => void;
  onSelectSlot: (slotInfo: { start: Date }) => void;
  currentDate?: Date;
}

export function CustomCalendar({ events, onSelectEvent, onSelectSlot, currentDate = new Date() }: CustomCalendarProps) {
  const muiTheme = useTheme();
  const isDark = muiTheme.palette.mode === "dark";
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("sm"));
  const isOpen = useStore((store) => store.isOpen);
  const giorniNonLavorativi = useStore((store) => store.giorniNonLavorativi);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: monthEnd });

  // Padding: assicuriamo che il calendario abbia righe complete (multipli di 7)
  const paddedDays = useMemo(() => {
    const remainder = calendarDays.length % 7;
    if (remainder === 0) return calendarDays;
    const lastDay = calendarDays[calendarDays.length - 1];
    const extraDays = eachDayOfInterval({
      start: new Date(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate() + 1),
      end: new Date(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate() + (7 - remainder)),
    });
    return [...calendarDays, ...extraDays];
  }, [calendarDays]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, CashEvent[]> = {};
    events.forEach((event) => {
      const dateKey = format(event.start, "yyyy-MM-dd");
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(event);
    });
    return map;
  }, [events]);

  // Funzione per trovare un giorno non lavorativo corrispondente a una data
  const getGiornoNonLavorativo = useCallback(
    (dateKey: string): GiornoNonLavorativo | undefined => {
      if (!giorniNonLavorativi || giorniNonLavorativi.length === 0) return undefined;
      const mmdd = dateKey.substring(5); // "MM-DD"
      return giorniNonLavorativi.find((g) => {
        if (g.ricorrente) {
          return g.data.substring(5) === mmdd;
        }
        return g.data === dateKey;
      });
    },
    [giorniNonLavorativi],
  );

  const handleDayClick = useCallback(
    (date: Date) => {
      onSelectSlot({ start: date });
    },
    [onSelectSlot]
  );

  const todayKey = dayjs().format("YYYY-MM-DD");
  const currentMonthStr = format(monthStart, "M");

  // Calcola il numero di righe per gestire l'altezza delle celle
  const numRows = paddedDays.length / 7;

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column", p: { xs: 0.5, sm: 1.5 } }}>
      {/* Header giorni della settimana */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: "1px",
          mb: 0.5,
          flexShrink: 0,
        }}
      >
        {WEEKDAYS.map((day, i) => (
          <Box
            key={day}
            sx={{
              py: { xs: 0.25, sm: 0.75 },
              textAlign: "center",
              fontWeight: 600,
              fontSize: { xs: "0.65rem", sm: "0.8rem" },
              color: i >= 5 ? "text.secondary" : "text.primary",
            }}
          >
            {day}
          </Box>
        ))}
      </Box>

      {/* Griglia giorni */}
      <Box
        sx={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gridTemplateRows: `repeat(${numRows}, 1fr)`,
          gap: "1px",
          bgcolor: isDark ? "divider" : "grey.300",
          border: 1,
          borderColor: isDark ? "divider" : "grey.300",
          borderRadius: 1,
          overflow: "hidden",
          minHeight: 0,
        }}
      >
        {paddedDays.map((date) => {
          const dateKey = format(date, "yyyy-MM-dd");
          const dayEvents = eventsByDate[dateKey] || [];
          const isToday = dateKey === todayKey;
          const isCurrentMonth = format(date, "M") === currentMonthStr;
          const isDayOpen = isOpen(date);
          const isDisabled = !isCurrentMonth;
          const giornoNonLav = getGiornoNonLavorativo(dateKey);

          // Il primo evento del giorno (normalmente uno solo)
          const event = dayEvents[0];
          const statoConfig = event ? STATO_CONFIG[event.stato] : null;

          return (
            <Box
              key={dateKey}
              onClick={() => {
                if (isDisabled) return;
                if (event) {
                  onSelectEvent(event);
                } else if (isDayOpen) {
                  handleDayClick(date);
                }
              }}
              sx={{
                bgcolor: isDisabled
                  ? isDark
                    ? alpha(muiTheme.palette.background.paper, 0.3)
                    : "grey.100"
                  : giornoNonLav
                    ? isDark
                      ? alpha(muiTheme.palette.error.main, 0.12)
                      : alpha(muiTheme.palette.error.main, 0.06)
                    : isToday
                      ? isDark
                        ? alpha(muiTheme.palette.primary.main, 0.08)
                        : alpha(muiTheme.palette.primary.main, 0.06)
                      : isDark
                        ? "background.paper"
                        : "background.paper",
                cursor: isDisabled ? "default" : !isDayOpen && !event ? "default" : "pointer",
                opacity: isDisabled ? 0.4 : 1,
                display: "flex",
                flexDirection: "column",
                position: "relative",
                overflow: "hidden",
                transition: "background-color 0.15s",
                minHeight: { xs: 44, sm: "auto" },
                ...(!isDisabled && (isDayOpen || event)
                  ? {
                      "&:hover": {
                        bgcolor: isDark ? alpha(muiTheme.palette.primary.main, 0.12) : alpha(muiTheme.palette.primary.main, 0.08),
                      },
                    }
                  : {}),
              }}
            >
              {/* Barra stato laterale */}
              {event && statoConfig && (
                <Box
                  sx={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    bottom: 0,
                    width: 3,
                    bgcolor: statoConfig.color,
                  }}
                />
              )}

              {/* Numero giorno */}
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", px: { xs: 0.25, sm: 0.75 }, pt: { xs: 0.25, sm: 0.5 } }}>
                <Typography
                  sx={{
                    fontSize: { xs: "0.65rem", sm: "0.8rem" },
                    fontWeight: isToday ? 700 : 400,
                    color: isCurrentMonth ? "text.primary" : "text.disabled",
                    ...(isToday
                      ? {
                          bgcolor: "primary.main",
                          color: "primary.contrastText",
                          borderRadius: "50%",
                          width: { xs: 18, sm: 22 },
                          height: { xs: 18, sm: 22 },
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          lineHeight: 1,
                        }
                      : {}),
                  }}
                >
                  {format(date, "d")}
                </Typography>

                {/* Label stato compatto */}
                {event && statoConfig && (
                  <Typography
                    sx={{
                      fontSize: { xs: "0.5rem", sm: "0.6rem" },
                      fontWeight: 600,
                      color: statoConfig.color,
                      textTransform: "uppercase",
                      letterSpacing: "0.02em",
                    }}
                  >
                    {isMobile ? statoConfig.label.charAt(0) : statoConfig.label}
                  </Typography>
                )}
              </Box>

              {/* Contenuto evento */}
              {event ? (
                <Box sx={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", px: { xs: 0.25, sm: 0.75 }, pb: { xs: 0.25, sm: 0.5 } }}>
                  <Typography
                    sx={{
                      fontSize: { xs: "0.7rem", sm: "0.95rem" },
                      fontWeight: 700,
                      color: event.revenue >= 0 ? "text.primary" : "error.main",
                      lineHeight: 1.2,
                    }}
                  >
                    {isMobile ? `${event.revenue.toFixed(0)}` : `\u20AC ${event.revenue.toFixed(2)}`}
                  </Typography>
                  {!isMobile && (
                    <Box sx={{ display: "flex", gap: 0.5, mt: 0.25, flexWrap: "wrap" }}>
                      {event.contanti > 0 && <Typography sx={{ fontSize: "0.6rem", color: "success.main" }}>{`C: ${event.contanti.toFixed(0)}`}</Typography>}
                      {event.elettronici > 0 && <Typography sx={{ fontSize: "0.6rem", color: "info.main" }}>{`E: ${event.elettronici.toFixed(0)}`}</Typography>}
                      {event.fatture > 0 && <Typography sx={{ fontSize: "0.6rem", color: "text.secondary" }}>{`F: ${event.fatture.toFixed(0)}`}</Typography>}
                    </Box>
                  )}
                </Box>
              ) : (
                isCurrentMonth &&
                !isDayOpen && (
                  <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {giornoNonLav ? (
                      <Tooltip title={giornoNonLav.descrizione}>
                        <Typography sx={{ fontSize: "0.6rem", color: "error.main", fontWeight: 600, textAlign: "center", lineHeight: 1.2, px: 0.25 }}>
                          {isMobile ? giornoNonLav.descrizione.substring(0, 3).toUpperCase() : giornoNonLav.descrizione}
                        </Typography>
                      </Tooltip>
                    ) : (
                      <Typography sx={{ fontSize: "0.65rem", color: "text.disabled", fontWeight: 500 }}>CHIUSO</Typography>
                    )}
                  </Box>
                )
              )}
            </Box>
          );
        })}
      </Box>

      {/* Legenda */}
      <Box sx={{ display: "flex", gap: 2, mt: 1, flexShrink: 0, justifyContent: "flex-end" }}>
        {Object.entries(STATO_CONFIG).map(([, cfg]) => (
          <Box
            key={cfg.label}
            sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
          >
            <Box sx={{ width: 10, height: 10, borderRadius: "2px", bgcolor: cfg.color }} />
            <Typography
              variant="caption"
              color="text.secondary"
            >
              {cfg.label}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

export default CustomCalendar;
