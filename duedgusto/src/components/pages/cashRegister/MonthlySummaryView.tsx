import React from 'react';
import { Typography, Paper, Grid } from '@mui/material';

interface MonthlySummaryViewProps {
    closure: MonthlyClosure;
}

const MonthlySummaryView: React.FC<MonthlySummaryViewProps> = ({ closure }) => {
    // Calcolo del totale vendite, come da file CALCOLO_RICAVO_CASSA.md
    const totalSales = (closure.totalCash ?? 0) + (closure.totalElectronic ?? 0);

    return (
        <Paper elevation={3} sx={{ padding: 2 }}>
            <Typography variant="h6" gutterBottom>Riepilogo Incassi Mensili</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                (Dati automatici da CashRegisterList)
            </Typography>
            <Grid container spacing={1}>
                <Grid item xs={6}><Typography>Ricavo Totale Mese:</Typography></Grid>
                <Grid item xs={6}><Typography align="right">€ {closure.totalRevenue?.toFixed(2) ?? 'N/A'}</Typography></Grid>

                <Grid item xs={6}><Typography color="green">Pago in Contanti:</Typography></Grid>
                <Grid item xs={6}><Typography align="right" color="green">€ {closure.totalCash?.toFixed(2) ?? 'N/A'}</Typography></Grid>

                <Grid item xs={6}><Typography color="green">Pagamenti Elettronici:</Typography></Grid>
                <Grid item xs={6}><Typography align="right" color="green">€ {closure.totalElectronic?.toFixed(2) ?? 'N/A'}</Typography></Grid>

                <Grid item xs={6}><Typography color="orange">Totale Vendite:</Typography></Grid>
                <Grid item xs={6}><Typography align="right" color="orange">€ {totalSales.toFixed(2)}</Typography></Grid>

                <Grid item xs={6}><Typography>Pagamenti con Fattura:</Typography></Grid>
                <Grid item xs={6}><Typography align="right">€ {closure.invoicePayments?.toFixed(2) ?? 'N/A'}</Typography></Grid>
            </Grid>
        </Paper>
    );
};

export default MonthlySummaryView;
