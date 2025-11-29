import { useMemo, useCallback } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek } from "date-fns";
import { it } from "date-fns/locale";
import dayjs from "dayjs";
import { Box, Paper, Grid, Typography, Button, useTheme } from "@mui/material";
import { ChevronLeft, ChevronRight } from "@mui/icons-material";
import useStore from "../../../store/useStore";

interface CalendarEvent {
  id: string | number;
  title: string;
  start: Date;
  end: Date;
  registerId?: number;
  date?: string;
  resource?: {
    registerId: number;
    date: string;
  };
}

interface CustomCalendarProps<T extends CalendarEvent = CalendarEvent> {
  events: T[];
  onSelectEvent: (event: T) => void;
  onSelectSlot: (slotInfo: { start: Date }) => void;
  currentDate?: Date;
  onMonthChange?: (date: Date) => void;
}

export function CustomCalendar<T extends CalendarEvent = CalendarEvent>({
  events,
  onSelectEvent,
  onSelectSlot,
  currentDate = new Date(),
  onMonthChange,
}: CustomCalendarProps<T>) {
  const muiTheme = useTheme();
  const isDark = muiTheme.palette.mode === "dark";
  const { isOpen } = useStore((store) => ({
    isOpen: store.isOpen,
  }));

  // Colori dinamici basati sul tema
  const colors = {
    border: isDark ? muiTheme.palette.divider : "#e0e0e0",
    buttonBg: isDark ? muiTheme.palette.action.hover : "#fff",
    buttonBgHover: isDark ? muiTheme.palette.action.selected : "#f5f5f5",
    buttonBorderHover: isDark ? muiTheme.palette.divider : "#bdbdbd",
    todayBg: isDark ? muiTheme.palette.action.selected : "#e3f2fd",
    offMonthBg: isDark ? muiTheme.palette.background.paper : "#fafafa",
    currentMonthBg: isDark ? muiTheme.palette.background.paper : "#fff",
    eventBg: muiTheme.palette.primary.main,
    eventBgHover: muiTheme.palette.primary.dark,
    textPrimary: isDark ? muiTheme.palette.text.primary : "#000",
    textSecondary: isDark ? muiTheme.palette.text.secondary : "#999",
    disabledBg: isDark ? muiTheme.palette.action.disabledBackground : "#f0f0f0",
  };

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const calendarStart = startOfWeek(monthStart);
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: monthEnd });

  // Organizzare gli eventi per data (YYYY-MM-DD)
  const eventsByDate = useMemo(() => {
    const map: { [key: string]: T[] } = {};
    events.forEach((event) => {
      const dateKey = format(event.start, "yyyy-MM-dd");
      if (!map[dateKey]) {
        map[dateKey] = [];
      }
      map[dateKey].push(event);
    });
    return map;
  }, [events]);

  const handlePrevMonth = useCallback(() => {
    const prevMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    onMonthChange?.(prevMonth);
  }, [currentDate, onMonthChange]);

  const handleNextMonth = useCallback(() => {
    const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    onMonthChange?.(nextMonth);
  }, [currentDate, onMonthChange]);

  const handleDayClick = useCallback(
    (date: Date) => {
      onSelectSlot({ start: date });
    },
    [onSelectSlot]
  );

  const weekDays = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];
  const today = dayjs().format("yyyy-MM-dd");
  const monthLabel = format(monthStart, "MMMM yyyy", { locale: it });

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Toolbar */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "16px 0",
          gap: "10px",
          flexWrap: "wrap",
        }}
      >
        <Button
          onClick={handlePrevMonth}
          startIcon={<ChevronLeft />}
          sx={{
            padding: "6px 12px",
            fontSize: "0.875rem",
            borderRadius: "4px",
            border: `1px solid ${colors.border}`,
            backgroundColor: colors.buttonBg,
            cursor: "pointer",
            transition: "all 0.2s",
            "&:hover": {
              backgroundColor: colors.buttonBgHover,
              borderColor: colors.buttonBorderHover,
            },
          }}
        >
          Precedente
        </Button>

        <Typography
          sx={{
            fontSize: "1.125rem",
            fontWeight: 600,
            flex: "0 0 auto",
            textTransform: "capitalize",
          }}
        >
          {monthLabel}
        </Typography>

        <Button
          onClick={handleNextMonth}
          endIcon={<ChevronRight />}
          sx={{
            padding: "6px 12px",
            fontSize: "0.875rem",
            borderRadius: "4px",
            border: `1px solid ${colors.border}`,
            backgroundColor: colors.buttonBg,
            cursor: "pointer",
            transition: "all 0.2s",
            "&:hover": {
              backgroundColor: colors.buttonBgHover,
              borderColor: colors.buttonBorderHover,
            },
          }}
        >
          Successivo
        </Button>
      </Box>

      {/* Calendar Grid */}
      <Paper elevation={0} sx={{ flex: 1, overflow: "auto" }}>
        <Box sx={{ padding: "16px" }}>
          {/* Weekday Headers */}
          <Grid container spacing={1} sx={{ marginBottom: "8px" }}>
            {weekDays.map((day) => (
              <Grid item xs={12 / 7} key={day}>
                <Box
                  sx={{
                    padding: "12px 3px",
                    fontWeight: 600,
                    fontSize: "0.875rem",
                    textAlign: "center",
                    textTransform: "capitalize",
                  }}
                >
                  {day}
                </Box>
              </Grid>
            ))}
          </Grid>

          {/* Calendar Days Grid */}
          <Grid container spacing={1}>
            {calendarDays.map((date) => {
              const dateKey = format(date, "yyyy-MM-dd");
              const dayEvents = eventsByDate[dateKey] || [];
              const isToday = dateKey === today;
              const isCurrentMonth = format(date, "M") === format(monthStart, "M");
              const isDayOpen = isOpen(date);
              const isDisabled = !isDayOpen && isCurrentMonth;

              return (
                <Grid item xs={12 / 7} key={dateKey}>
                  <Box
                    onClick={() => !isDisabled && handleDayClick(date)}
                    sx={{
                      minHeight: "120px",
                      padding: "8px",
                      border: `1px solid ${colors.border}`,
                      borderRadius: "4px",
                      backgroundColor: isDisabled
                        ? colors.disabledBg
                        : isToday
                        ? colors.todayBg
                        : isCurrentMonth
                        ? colors.currentMonthBg
                        : colors.offMonthBg,
                      cursor: isDisabled ? "not-allowed" : "pointer",
                      opacity: isDisabled ? 0.6 : 1,
                      transition: "all 0.2s",
                      "&:hover": !isDisabled
                        ? {
                            backgroundColor: isToday ? colors.todayBg : colors.buttonBgHover,
                            borderColor: colors.buttonBorderHover,
                          }
                        : undefined,
                      display: "flex",
                      flexDirection: "column",
                      position: "relative",
                    }}
                  >
                    {isDisabled && (
                      <Box
                        sx={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          backgroundColor: "rgba(0,0,0,0.1)",
                          borderRadius: "4px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          zIndex: 1,
                        }}
                      >
                        <Typography variant="caption" sx={{ fontWeight: "bold", color: "text.disabled" }}>
                          CHIUSO
                        </Typography>
                      </Box>
                    )}

                    {/* Day number */}
                    <Typography
                      sx={{
                        fontSize: "0.875rem",
                        fontWeight: isToday ? 700 : 400,
                        textAlign: "right",
                        marginBottom: "4px",
                        color: isCurrentMonth ? colors.textPrimary : colors.textSecondary,
                      }}
                    >
                      {format(date, "d")}
                    </Typography>

                    {/* Events */}
                    <Box sx={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
                      {dayEvents.map((event) => (
                        <Box
                          key={event.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectEvent(event);
                          }}
                          sx={{
                            padding: "4px",
                            backgroundColor: colors.eventBg,
                            borderRadius: "4px",
                            fontSize: "0.75rem",
                            color: "white",
                            cursor: "pointer",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            transition: "all 0.2s",
                            "&:hover": {
                              backgroundColor: colors.eventBgHover,
                              boxShadow: `0 2px 4px ${isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)"}`,
                            },
                          }}
                          title={event.title}
                        >
                          {event.title}
                        </Box>
                      ))}
                    </Box>
                  </Box>
                </Grid>
              );
            })}
          </Grid>
        </Box>
      </Paper>
    </Box>
  );
}

export default CustomCalendar;
