import { useCallback, useMemo } from "react";
import { Box, Button, FormControl, InputLabel, MenuItem, Select, SelectChangeEvent, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ListIcon from "@mui/icons-material/List";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import { useNavigate } from "react-router";
import useStore from "../../../../store/useStore";

const ANNI_DISPONIBILI = 5;

interface DashboardHeaderProps {
  anno: number;
  onAnnoChange: (anno: number) => void;
}

/**
 * Header della dashboard cassa: titolo, select anno e azioni rapide.
 * Non scrolla (flexShrink 0) e resta interattivo anche durante il loading
 * dei dati (react-best-practices §1).
 */
function DashboardHeader({ anno, onAnnoChange }: DashboardHeaderProps) {
  const navigate = useNavigate();
  const getNextOperatingDate = useStore((state) => state.getNextOperatingDate);

  const anniDisponibili = useMemo(() => {
    const annoCorrente = new Date().getFullYear();
    return Array.from({ length: ANNI_DISPONIBILI }, (_, indice) => annoCorrente - ANNI_DISPONIBILI + 1 + indice);
  }, []);

  const handleAnnoChange = useCallback(
    (event: SelectChangeEvent<number>) => {
      onAnnoChange(Number(event.target.value));
    },
    [onAnnoChange]
  );

  const handleNuovaCassa = useCallback(() => {
    const data = getNextOperatingDate();
    const dataStr = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
    navigate(`/gestionale/cassa/details/${dataStr}`);
  }, [getNextOperatingDate, navigate]);

  const handleListaCasse = useCallback(() => {
    navigate("/gestionale/cassa/list");
  }, [navigate]);

  const handleVistaMensile = useCallback(() => {
    navigate("/gestionale/cassa/vista-mensile");
  }, [navigate]);

  return (
    <Box
      sx={{
        flexShrink: 0,
        borderBottom: 1,
        borderColor: "divider",
        bgcolor: "background.paper",
        px: 2,
        py: 1.5,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 2,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
        <Typography
          variant="h5"
          fontWeight="bold"
        >
          Dashboard Cassa
        </Typography>
        <FormControl
          size="small"
          sx={{ minWidth: 110 }}
        >
          <InputLabel id="dashboard-anno-label">Anno</InputLabel>
          <Select
            labelId="dashboard-anno-label"
            value={anno}
            label="Anno"
            onChange={handleAnnoChange}
          >
            {anniDisponibili.map((annoDisponibile) => (
              <MenuItem
                key={annoDisponibile}
                value={annoDisponibile}
              >
                {annoDisponibile}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={handleNuovaCassa}
        >
          Nuova Cassa
        </Button>
        <Button
          variant="outlined"
          color="secondary"
          startIcon={<ListIcon />}
          onClick={handleListaCasse}
        >
          Lista Casse
        </Button>
        <Button
          variant="outlined"
          color="secondary"
          startIcon={<CalendarMonthIcon />}
          onClick={handleVistaMensile}
        >
          Vista Mensile
        </Button>
      </Box>
    </Box>
  );
}

export default DashboardHeader;
