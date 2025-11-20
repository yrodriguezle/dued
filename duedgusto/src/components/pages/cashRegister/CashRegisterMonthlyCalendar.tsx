import { useCallback, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Grid,
  Paper,
  Typography,
  IconButton,
  Button,
  CircularProgress,
} from "@mui/material";
import { ChevronLeft, ChevronRight, CheckCircle } from "@mui/icons-material";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);

interface CashRegisterMonthlyCalendarProps {
  open: boolean;
  onClose: () => void;
  onSelectDate: (date: string) => void;
  currentDate: string;
  cashRegisters: CashRegister[];
  loading: boolean;
}

function CashRegisterMonthlyCalendar({
  open,
  onClose,
  onSelectDate,
  currentDate,
  cashRegisters,
  loading,
}: CashRegisterMonthlyCalendarProps) {
  const [displayMonth, setDisplayMonth] = useState<dayjs.Dayjs>(dayjs(currentDate));

  // Map of dates that have saved cash registers
  const savedDates = new Set(cashRegisters.map((cr) => cr.date));

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
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <IconButton size="small" onClick={handlePreviousMonth}>
            <ChevronLeft />
          </IconButton>
          <Typography variant="h6">
            {displayMonth.format("MMMM YYYY").charAt(0).toUpperCase() +
              displayMonth.format("MMMM YYYY").slice(1)}
          </Typography>
          <IconButton size="small" onClick={handleNextMonth}>
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
            <Grid container spacing={0.5} sx={{ mb: 2 }}>
              {weekdayHeaders.map((day) => (
                <Grid item xs={12 / 7} key={day}>
                  <Box sx={{ textAlign: "center", fontWeight: "bold", fontSize: "0.85rem" }}>
                    {day}
                  </Box>
                </Grid>
              ))}
            </Grid>

            {/* Calendar grid */}
            <Grid container spacing={0.5}>
              {calendarDays.map((day, index) => {
                const isCurrentMonth = day !== null;
                const isCurrentDay =
                  isCurrentMonth && displayMonth.month() === dayjs(currentDate).month()
                    ? day === dayjs(currentDate).date()
                    : false;

                const dateString = isCurrentMonth
                  ? displayMonth.date(day).format("YYYY-MM-DD")
                  : "";
                const hasCashRegister = isCurrentMonth && savedDates.has(dateString);

                return (
                  <Grid item xs={12 / 7} key={`${day}-${index}`}>
                    <Paper
                      onClick={() => isCurrentMonth && handleDateSelect(day!)}
                      sx={{
                        p: 1,
                        textAlign: "center",
                        cursor: isCurrentMonth ? "pointer" : "default",
                        backgroundColor: isCurrentMonth ? "#fff" : "#f5f5f5",
                        border: isCurrentDay ? "2px solid #1976d2" : "1px solid #e0e0e0",
                        color: isCurrentMonth ? "#000" : "#ccc",
                        transition: "all 0.2s",
                        position: "relative",
                        minHeight: "60px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexDirection: "column",
                        "&:hover": isCurrentMonth
                          ? {
                              backgroundColor: "#f0f0f0",
                              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                            }
                          : {},
                      }}
                    >
                      {isCurrentMonth && (
                        <>
                          <Typography variant="body2" sx={{ fontWeight: isCurrentDay ? "bold" : "normal" }}>
                            {day}
                          </Typography>
                          {hasCashRegister && (
                            <CheckCircle
                              sx={{
                                fontSize: "1.2rem",
                                color: "#4caf50",
                                mt: 0.5,
                              }}
                            />
                          )}
                        </>
                      )}
                    </Paper>
                  </Grid>
                );
              })}
            </Grid>
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
