import { useState, useCallback, useRef } from "react";
import { Box, Toolbar, IconButton, Button, useMediaQuery, useTheme } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import SummarizeIcon from "@mui/icons-material/Summarize";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import FormikToolbarButton from "../../../common/form/toolbar/FormikToolbarButton";

interface ToolbarNavigazioneMensileProps {
  currentDate: Date;
  monthLabel: string;
  onDateChange: (date: Date) => void;
  onBack: () => void;
  onChiusuraMensile: () => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onPrevYear: () => void;
  onNextYear: () => void;
}

function ToolbarNavigazioneMensile({
  currentDate,
  monthLabel,
  onDateChange,
  onBack,
  onChiusuraMensile,
  onPrevMonth,
  onNextMonth,
  onPrevYear,
  onNextYear,
}: ToolbarNavigazioneMensileProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [pickerOpen, setPickerOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleMonthAccept = useCallback(
    (value: Dayjs | null) => {
      setPickerOpen(false);
      if (value) {
        setTimeout(() => {
          onDateChange(value.startOf("month").toDate());
        }, 200);
      }
    },
    [onDateChange]
  );

  return (
    <Box sx={{ borderBottom: 1, borderColor: "divider", bgcolor: "background.paper", flexShrink: 0 }}>
      <Toolbar
        variant="dense"
        disableGutters
        sx={{ minHeight: 48, height: 48, display: "flex", justifyContent: "space-between" }}
      >
        <Box sx={{ height: 48, display: "flex", alignItems: "stretch" }}>
          {isMobile ? (
            <>
              <IconButton
                size="small"
                onClick={onBack}
                title="Indietro"
                sx={{ height: 48, width: 48 }}
              >
                <ArrowBackIcon />
              </IconButton>
              <IconButton
                size="small"
                onClick={onChiusuraMensile}
                title="Chiusura Mensile"
                sx={{ height: 48, width: 48 }}
              >
                <SummarizeIcon />
              </IconButton>
            </>
          ) : (
            <>
              <FormikToolbarButton
                startIcon={<ArrowBackIcon />}
                onClick={onBack}
              >
                Indietro
              </FormikToolbarButton>
              <FormikToolbarButton
                startIcon={<SummarizeIcon />}
                onClick={onChiusuraMensile}
              >
                Chiusura Mensile
              </FormikToolbarButton>
            </>
          )}
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 0, sm: 0.5 }, pr: { xs: 0.5, sm: 1 } }}>
          <IconButton
            size="small"
            onClick={onPrevYear}
            title="Anno precedente"
          >
            <ChevronLeftIcon fontSize="small" />
            <ChevronLeftIcon
              fontSize="small"
              sx={{ ml: -1.2 }}
            />
          </IconButton>
          <IconButton
            size="small"
            onClick={onPrevMonth}
            title="Mese precedente"
          >
            <ChevronLeftIcon />
          </IconButton>
          <Button
            ref={buttonRef}
            variant="text"
            onClick={() => setPickerOpen(true)}
            sx={{
              minWidth: { xs: 110, sm: 160 },
              textAlign: "center",
              fontWeight: 600,
              textTransform: "capitalize",
              fontSize: isMobile ? "0.875rem" : "1rem",
              color: "text.primary",
            }}
          >
            {monthLabel}
          </Button>
          <DatePicker
            open={pickerOpen}
            onClose={() => setPickerOpen(false)}
            value={dayjs(currentDate)}
            onAccept={handleMonthAccept}
            views={["year", "month"]}
            openTo="month"
            slotProps={{
              textField: { sx: { display: "none" } },
              popper: { anchorEl: buttonRef.current },
            }}
          />
          <IconButton
            size="small"
            onClick={onNextMonth}
            title="Mese successivo"
          >
            <ChevronRightIcon />
          </IconButton>
          <IconButton
            size="small"
            onClick={onNextYear}
            title="Anno successivo"
          >
            <ChevronRightIcon
              fontSize="small"
              sx={{ mr: -1.2 }}
            />
            <ChevronRightIcon fontSize="small" />
          </IconButton>
        </Box>
      </Toolbar>
    </Box>
  );
}

export default ToolbarNavigazioneMensile;
