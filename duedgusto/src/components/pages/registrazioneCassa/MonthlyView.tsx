import { useContext, useEffect, useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import dayjs from "dayjs";

import PageTitleContext from "../../layout/headerBar/PageTitleContext";
import { useQuery } from "@apollo/client";
import { getMonthlySummary } from "../../../graphql/cashRegister/queries";

function MonthlyView() {
  const { setTitle } = useContext(PageTitleContext);
  const [selectedDate, setSelectedDate] = useState(dayjs());

  const { data, loading } = useQuery(getMonthlySummary, {
    variables: {
      anno: selectedDate.year(),
      mese: selectedDate.month() + 1,
    },
  });

  const summary = data?.cashManagement?.monthlySummary;

  useEffect(() => {
    setTitle("Vista Mensile Cassa");
  }, [setTitle]);

  const handlePreviousMonth = () => {
    setSelectedDate((prev) => prev.subtract(1, "month"));
  };

  const handleNextMonth = () => {
    setSelectedDate((prev) => prev.add(1, "month"));
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Caricamento vista mensile...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header con navigazione mese */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">
          Vista Mensile Cassa
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <IconButton onClick={handlePreviousMonth}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h5" sx={{ minWidth: 200, textAlign: "center" }}>
            {selectedDate.format("MMMM YYYY")}
          </Typography>
          <IconButton onClick={handleNextMonth}>
            <ArrowForwardIcon />
          </IconButton>
        </Box>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom variant="overline">
                Vendite Totali
              </Typography>
              <Typography variant="h5" color="primary.main" fontWeight="bold">
                € {summary?.totaleVendite?.toFixed(2) || "0.00"}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom variant="overline">
                Contanti
              </Typography>
              <Typography variant="h5" color="success.main" fontWeight="bold">
                € {summary?.totaleContanti?.toFixed(2) || "0.00"}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom variant="overline">
                Pagamenti Elettronici
              </Typography>
              <Typography variant="h5" color="info.main" fontWeight="bold">
                € {summary?.totaleElettronici?.toFixed(2) || "0.00"}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom variant="overline">
                Media Giornaliera
              </Typography>
              <Typography variant="h5" color="secondary.main" fontWeight="bold">
                € {summary?.mediaGiornaliera?.toFixed(2) || "0.00"}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Detailed Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Riepilogo Dettagliato
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>
                    <Typography variant="subtitle2" fontWeight="bold">
                      Metrica
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="subtitle2" fontWeight="bold">
                      Valore
                    </Typography>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell>Totale Vendite Mese</TableCell>
                  <TableCell align="right">€ {summary?.totaleVendite?.toFixed(2) || "0.00"}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Totale Contanti</TableCell>
                  <TableCell align="right">€ {summary?.totaleContanti?.toFixed(2) || "0.00"}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Totale Pagamenti Elettronici</TableCell>
                  <TableCell align="right">€ {summary?.totaleElettronici?.toFixed(2) || "0.00"}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Media Giornaliera</TableCell>
                  <TableCell align="right">€ {summary?.mediaGiornaliera?.toFixed(2) || "0.00"}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Giorni con Differenze</TableCell>
                  <TableCell align="right">{summary?.giorniConDifferenze || 0}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>IVA Totale (10%)</TableCell>
                  <TableCell align="right">€ {summary?.totaleIva?.toFixed(2) || "0.00"}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Placeholder per calendario */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Calendario Mensile
          </Typography>
          <Box
            sx={{
              height: 300,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              bgcolor: "action.hover",
              borderRadius: 1,
            }}
          >
            <Typography color="text.secondary">
              Calendario con vendite giornaliere disponibile dopo implementazione backend
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}

export default MonthlyView;
