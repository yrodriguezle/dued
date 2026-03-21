import { useCallback, useState } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Box, Paper, Typography, IconButton, Button, CircularProgress, useTheme } from "@mui/material";
import { ChevronLeft, ChevronRight, CheckCircle } from "@mui/icons-material";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);

interface CashRegisterMonthlyCalendarProps {
  open: boolean;
  onClose: () => void;
  onSelectDate: (date: string) => void;
  currentDate: string;
  cashRegisters: RegistroCassa[];
  loading: boolean;
}

function CashRegisterMonthlyCalendar({ open, onClose, onSelectDate, currentDate, cashRegisters, loading }: CashRegisterMonthlyCalendarProps) {
  const theme = useTheme();
  const [displayMonth, setDisplayMonth] = useState<dayjs.Dayjs>(dayjs(currentDate));

  // Map of dates that have saved cash registers
  const savedDates = new Set(cashRegisters.map((cr) => cr.data));

  const handlePreviousMonth = useCallback(() => {
    setDisplayMonth((prev) => prev.subtract(1, "month"));
  }, []);

  const handleNextMonth = useCallback(() => {
    setDisplayMonth((prev) => prev.add(1, "month"));
  }, []);

  const handleDateSelect = (day: number) => {
    const selectedDate = displayMonth.date(day).format("YYYY-MM-DD");
    onSelectDate(selectedDate);
    onClose();
  };

  // Get calendar grid (days from previous month + current month + days from next month)
  const getDaysInCalendar = () => {
    const startOfMonth = displayMonth.startOf("month");
    const endOfMonth = displayMonth.endOf("month");
    const startDay = startOfMonth.day(); // 0 = Sunday, 1 = Monday, etc.
    const daysInMonth = endOfMonth.date();

    const days: (number | null)[] = [];

    // Add days from previous month
    for (let i = startDay - 1; i >= 0; i--) {
      days.push(null);
    }

    // Add days of current month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }

    // Add days from next month to fill the grid
    const remainingDays = (42 - days.length) % 7;
    for (let i = 1; i <= remainingDays; i++) {
      days.push(null);
    }

    return days;
  };

  const calendarDays = getDaysInCalendar();
  const weekdayHeaders = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <IconButton
            size="small"
            onClick={handlePreviousMonth}
          >
            <ChevronLeft />
          </IconButton>
          <Typography variant="h6">{displayMonth.format("MMMM YYYY").charAt(0).toUpperCase() + displayMonth.format("MMMM YYYY").slice(1)}</Typography>
          <IconButton
            size="small"
            onClick={handleNextMonth}
          >
            <ChevronRight />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box sx={{ mt: 2 }}>
            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-1 mb-4">
              {weekdayHeaders.map((day) => (
                <div key={day}>
                  <Box sx={{ textAlign: "center", fontWeight: "bold", fontSize: "0.85rem" }}>{day}</Box>
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, index) => {
                const isCurrentMonth = day !== null;
                const isCurrentDay = isCurrentMonth && displayMonth.month() === dayjs(currentDate).month() ? day === dayjs(currentDate).date() : false;

                const dateString = isCurrentMonth ? displayMonth.date(day).format("YYYY-MM-DD") : "";
                const hasCashRegister = isCurrentMonth && savedDates.has(dateString);

                return (
                  <div key={`${day}-${index}`}>
                    <Paper
                      onClick={() => isCurrentMonth && handleDateSelect(day!)}
                      sx={{
                        p: 1,
                        textAlign: "center",
                        cursor: isCurrentMonth ? "pointer" : "default",
                        backgroundColor: isCurrentMonth ? "background.paper" : "grey.100",
                        border: isCurrentDay ? `2px solid ${theme.palette.info.main}` : 1,
                        borderColor: isCurrentDay ? "info.main" : "grey.300",
                        color: isCurrentMonth ? "text.primary" : "text.disabled",
                        transition: "all 0.2s",
                        position: "relative",
                        minHeight: "60px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexDirection: "column",
                        "&:hover": isCurrentMonth
                          ? {
                              backgroundColor: "action.hover",
                              boxShadow: 2,
                            }
                          : {},
                      }}
                    >
                      {isCurrentMonth && (
                        <>
                          <Typography
                            variant="body2"
                            sx={{ fontWeight: isCurrentDay ? "bold" : "normal" }}
                          >
                            {day}
                          </Typography>
                          {hasCashRegister && (
                            <CheckCircle
                              sx={{
                                fontSize: "1.2rem",
                                color: "success.light",
                                mt: 0.5,
                              }}
                            />
                          )}
                        </>
                      )}
                    </Paper>
                  </div>
                );
              })}
            </div>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Chiudi</Button>
      </DialogActions>
    </Dialog>
  );
}

export default CashRegisterMonthlyCalendar;
