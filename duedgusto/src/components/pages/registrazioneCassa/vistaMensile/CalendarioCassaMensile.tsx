import { Box } from "@mui/material";
import CustomCalendar from "./CustomCalendar";
import type { CashEvent } from "./VistaMensile";

interface CalendarioCassaMensileProps {
  events: CashEvent[];
  currentDate: Date;
  onSelectEvent: (event: CashEvent) => void;
  onSelectSlot: (slotInfo: { start: Date }) => void;
}

function CalendarioCassaMensile({ events, currentDate, onSelectEvent, onSelectSlot }: CalendarioCassaMensileProps) {
  return (
    <Box sx={{ flex: 1, overflow: "hidden", minHeight: 0, maxWidth: 900, mx: "auto", width: "100%" }}>
      <CustomCalendar
        events={events}
        onSelectEvent={onSelectEvent}
        onSelectSlot={onSelectSlot}
        currentDate={currentDate}
      />
    </Box>
  );
}

export default CalendarioCassaMensile;
