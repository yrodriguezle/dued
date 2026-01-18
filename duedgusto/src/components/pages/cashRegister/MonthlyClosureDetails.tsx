import React, { useContext, useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { Box, Typography, CircularProgress, Alert, Paper, Grid, Button } from '@mui/material';
import { useQueryMonthlyClosure } from '../../../graphql/monthlyClosure/queries';
import PageTitleContext from '../../layout/headerBar/PageTitleContext';
import MonthlySummaryView from './MonthlySummaryView';
import MonthlyExpensesDataGrid from './MonthlyExpensesDataGrid';
import dayjs from 'dayjs';
import { useMutationMonthlyClosure } from '../../../graphql/monthlyClosure/mutations';

const MonthlyClosureDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { setTitle } = useContext(PageTitleContext);
    const closureId = parseInt(id || '0', 10);

    const { monthlyClosure: initialClosure, loading, error } = useQueryMonthlyClosure({ id: closureId });
    const [monthlyClosure, setMonthlyClosure] = useState<MonthlyClosure | undefined>(undefined);

    const { mutateMonthlyClosure, loading: mutationLoading } = useMutationMonthlyClosure();

    useEffect(() => {
        if (initialClosure) {
            setMonthlyClosure(initialClosure);
        }
    }, [initialClosure]);

    useEffect(() => {
        if (monthlyClosure) {
            setTitle(`Chiusura Mensile - ${dayjs().month(monthlyClosure.month - 1).format('MMMM')} ${monthlyClosure.year}`);
        } else {
            setTitle('Dettagli Chiusura Mensile');
        }
    }, [monthlyClosure, setTitle]);

    const handleExpensesChange = (updatedExpenses: MonthlyExpense[]) => {
        if (monthlyClosure) {
            const additionalExpenses = updatedExpenses.reduce((acc, expense) => acc + expense.amount, 0);
            const netRevenue = (monthlyClosure.totalRevenue || 0) - additionalExpenses;

            setMonthlyClosure({
                ...monthlyClosure,
                expenses: updatedExpenses,
                additionalExpenses,
                netRevenue,
            });
        }
    };

    const handleSaveChanges = (status: "BOZZA" | "CHIUSA") => {
        if (monthlyClosure) {
            const input: MonthlyClosureInput = {
                id: monthlyClosure.id,
                year: monthlyClosure.year,
                month: monthlyClosure.month,
                lastBusinessDay: monthlyClosure.lastBusinessDay,
                notes: monthlyClosure.notes || "",
                status,
                expenses: monthlyClosure.expenses.map(e => ({
                    id: e.id > 0 ? e.id : undefined,
                    description: e.description,
                    amount: e.amount,
                    category: e.category || undefined,
                    paymentId: e.paymentId || undefined,
                }))
            };
            mutateMonthlyClosure({ variables: { input } });
        }
    };


    if (loading) {
        return <CircularProgress />;
    }

    if (error) {
        return <Alert severity="error">Errore nel caricamento dei dettagli della chiusura: {error.message}</Alert>;
    }

    if (!monthlyClosure) {
        return <Alert severity="warning">Chiusura non trovata.</Alert>;
    }

    return (
        <Box sx={{ padding: 3 }}>
            <Paper sx={{ padding: 3 }}>
                <Typography variant="h4" gutterBottom>
                    CHIUSURA MENSILE - {dayjs().month(monthlyClosure.month - 1).format('MMMM')} {monthlyClosure.year}
                </Typography>

                <Grid container spacing={3}>
                    {/* Riepilogo Incassi */}
                    <Grid item xs={12}>
                        <MonthlySummaryView closure={monthlyClosure} />
                    </Grid>

                    {/* Spese Mensili Aggiuntive */}
                    <Grid item xs={12}>
                        <MonthlyExpensesDataGrid 
                            expenses={monthlyClosure.expenses}
                            onExpensesChange={handleExpensesChange}
                        />
                    </Grid>

                    {/* Riepilogo Finale */}
                    <Grid item xs={12}>
                        <Paper elevation={3} sx={{ padding: 2 }}>
                            <Typography variant="h6">Riepilogo Finale</Typography>
                            <Grid container spacing={1}>
                                <Grid item xs={6}><Typography>Ricavo Totale Mese:</Typography></Grid>
                                <Grid item xs={6}><Typography align="right">€ {monthlyClosure.totalRevenue?.toFixed(2) ?? 'N/A'}</Typography></Grid>
                                
                                <Grid item xs={6}><Typography>(-) Spese Aggiuntive:</Typography></Grid>
                                <Grid item xs={6}><Typography align="right" color="error">€ {monthlyClosure.additionalExpenses?.toFixed(2) ?? 'N/A'}</Typography></Grid>
                                
                                <Grid item xs={12}><hr /></Grid>

                                <Grid item xs={6}><Typography variant="h6">RICAVO NETTO MENSILE:</Typography></Grid>
                                <Grid item xs={6}><Typography variant="h6" align="right">€ {monthlyClosure.netRevenue?.toFixed(2) ?? 'N/A'}</Typography></Grid>
                            </Grid>
                        </Paper>
                    </Grid>

                    {/* Note e Azioni */}
                    <Grid item xs={12}>
                        <Typography>Note: {monthlyClosure.notes}</Typography>
                    </Grid>

                    <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                        <Button variant="outlined" onClick={() => handleSaveChanges("BOZZA")} disabled={mutationLoading}>Salva Bozza</Button>
                        <Button variant="contained" onClick={() => handleSaveChanges("CHIUSA")} disabled={mutationLoading}>Chiudi Mese</Button>
                        <Button variant="text">Annulla</Button>
                    </Grid>
                </Grid>
            </Paper>
        </Box>
    );
};

export default MonthlyClosureDetails;
