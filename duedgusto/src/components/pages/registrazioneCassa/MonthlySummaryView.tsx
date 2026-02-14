import React from 'react';
import { Typography, Paper, Grid, Divider } from '@mui/material';

interface MonthlySummaryViewProps {
    closure: ChiusuraMensile;
}

const MonthlySummaryView: React.FC<MonthlySummaryViewProps> = ({ closure }) => {
    const totaleVendite = (closure.totaleContantiCalcolato ?? 0) + (closure.totaleElettroniciCalcolato ?? 0);

    return (
        <Paper elevation={3} sx={{ padding: 2 }}>
            <Typography variant="h6" gutterBottom>Riepilogo Incassi Mensili</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                (Dati calcolati automaticamente dai registri giornalieri inclusi)
            </Typography>
            <Grid container spacing={1}>
                <Grid item xs={6}><Typography>Ricavo Totale Mese:</Typography></Grid>
                <Grid item xs={6}><Typography align="right">€ {closure.ricavoTotaleCalcolato.toFixed(2)}</Typography></Grid>

                <Grid item xs={6}><Typography color="green">Pago in Contanti:</Typography></Grid>
                <Grid item xs={6}><Typography align="right" color="green">€ {closure.totaleContantiCalcolato.toFixed(2)}</Typography></Grid>

                <Grid item xs={6}><Typography color="green">Pagamenti Elettronici:</Typography></Grid>
                <Grid item xs={6}><Typography align="right" color="green">€ {closure.totaleElettroniciCalcolato.toFixed(2)}</Typography></Grid>

                <Grid item xs={6}><Typography color="orange">Totale Vendite:</Typography></Grid>
                <Grid item xs={6}><Typography align="right" color="orange">€ {totaleVendite.toFixed(2)}</Typography></Grid>

                <Grid item xs={6}><Typography>Pagamenti con Fattura:</Typography></Grid>
                <Grid item xs={6}><Typography align="right">€ {closure.totaleFattureCalcolato.toFixed(2)}</Typography></Grid>

                <Grid item xs={12}><Divider sx={{ my: 1 }} /></Grid>

                {/* Dettaglio IVA */}
                <Grid item xs={6}><Typography fontWeight="bold">Imponibile:</Typography></Grid>
                <Grid item xs={6}><Typography align="right" fontWeight="bold">€ {closure.totaleImponibileCalcolato.toFixed(2)}</Typography></Grid>

                <Grid item xs={6}><Typography fontWeight="bold">IVA:</Typography></Grid>
                <Grid item xs={6}><Typography align="right" fontWeight="bold">€ {closure.totaleIvaCalcolato.toFixed(2)}</Typography></Grid>

                <Grid item xs={6}><Typography fontWeight="bold">Totale Lordo:</Typography></Grid>
                <Grid item xs={6}><Typography align="right" fontWeight="bold">€ {closure.totaleLordoCalcolato.toFixed(2)}</Typography></Grid>

                {/* Differenze di cassa */}
                {closure.totaleDifferenzeCassaCalcolato !== 0 && (
                    <>
                        <Grid item xs={12}><Divider sx={{ my: 1 }} /></Grid>
                        <Grid item xs={6}>
                            <Typography color={closure.totaleDifferenzeCassaCalcolato < 0 ? 'error' : 'success.main'}>
                                Differenze di cassa aggregate:
                            </Typography>
                        </Grid>
                        <Grid item xs={6}>
                            <Typography
                                align="right"
                                color={closure.totaleDifferenzeCassaCalcolato < 0 ? 'error' : 'success.main'}
                            >
                                € {closure.totaleDifferenzeCassaCalcolato.toFixed(2)}
                            </Typography>
                        </Grid>
                    </>
                )}
            </Grid>
        </Paper>
    );
};

export default MonthlySummaryView;
