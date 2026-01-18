import React, { useContext, useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { Box, Typography, CircularProgress, Alert, Paper, Grid, Button } from '@mui/material';
import { useQueryChiusuraMensile } from '../../../graphql/monthlyClosure/queries';
import PageTitleContext from '../../layout/headerBar/PageTitleContext';
import MonthlySummaryView from './MonthlySummaryView';
import MonthlyExpensesDataGrid from './MonthlyExpensesDataGrid';
import dayjs from 'dayjs';
import { useMutation } from '@apollo/client';
import { mutationMutazioneChiusuraMensile } from '../../../graphql/suppliers/mutations';

const MonthlyClosureDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { setTitle } = useContext(PageTitleContext);
    const chiusuraId = parseInt(id || '0', 10);

    const { chiusuraMensile: initialChiusura, loading, error } = useQueryChiusuraMensile({ chiusuraId });
    const [chiusuraMensile, setChiusuraMensile] = useState<MonthlyClosure | undefined>(undefined);

    const [mutazioneChiusuraMensile, { loading: mutationLoading }] = useMutation(mutationMutazioneChiusuraMensile);

    useEffect(() => {
        if (initialChiusura) {
            setChiusuraMensile(initialChiusura);
        }
    }, [initialChiusura]);

    useEffect(() => {
        if (chiusuraMensile) {
            setTitle(`Chiusura Mensile - ${dayjs().month(chiusuraMensile.mese - 1).format('MMMM')} ${chiusuraMensile.anno}`);
        } else {
            setTitle('Dettagli Chiusura Mensile');
        }
    }, [chiusuraMensile, setTitle]);

    const handleExpensesChange = (updatedExpenses: MonthlyExpense[]) => {
        if (chiusuraMensile) {
            const speseAggiuntive = updatedExpenses.reduce((acc, expense) => acc + expense.importo, 0);
            const ricavoNetto = (chiusuraMensile.ricavoTotale || 0) - speseAggiuntive;

            setChiusuraMensile({
                ...chiusuraMensile,
                spese: updatedExpenses,
                speseAggiuntive,
                ricavoNetto,
            });
        }
    };

    const handleSaveChanges = (stato: "BOZZA" | "CHIUSA") => {
        if (chiusuraMensile) {
            const input: ChiusuraMensileInput = {
                chiusuraId: chiusuraMensile.chiusuraId,
                anno: chiusuraMensile.anno,
                mese: chiusuraMensile.mese,
                ultimoGiornoLavorativo: chiusuraMensile.ultimoGiornoLavorativo,
                note: chiusuraMensile.note || "",
                stato,
                spese: chiusuraMensile.spese.map(e => ({
                    spesaId: e.spesaId > 0 ? e.spesaId : undefined,
                    descrizione: e.descrizione,
                    importo: e.importo,
                    categoria: e.categoria || undefined,
                    pagamentoId: e.pagamentoId || undefined,
                }))
            };
            mutazioneChiusuraMensile({ variables: { chiusura: input } });
        }
    };

    if (loading) {
        return <CircularProgress />;
    }

    if (error) {
        return <Alert severity="error">Errore nel caricamento dei dettagli della chiusura: {error.message}</Alert>;
    }

    if (!chiusuraMensile) {
        return <Alert severity="warning">Chiusura non trovata.</Alert>;
    }

    return (
        <Box sx={{ padding: 3 }}>
            <Paper sx={{ padding: 3 }}>
                <Typography variant="h4" gutterBottom>
                    CHIUSURA MENSILE - {dayjs().month(chiusuraMensile.mese - 1).format('MMMM')} {chiusuraMensile.anno}
                </Typography>

                <Grid container spacing={3}>
                    {/* Riepilogo Incassi */}
                    <Grid item xs={12}>
                        <MonthlySummaryView closure={chiusuraMensile} />
                    </Grid>

                    {/* Spese Mensili Aggiuntive */}
                    <Grid item xs={12}>
                        <MonthlyExpensesDataGrid
                            expenses={chiusuraMensile.spese}
                            onExpensesChange={handleExpensesChange}
                        />
                    </Grid>

                    {/* Riepilogo Finale */}
                    <Grid item xs={12}>
                        <Paper elevation={3} sx={{ padding: 2 }}>
                            <Typography variant="h6">Riepilogo Finale</Typography>
                            <Grid container spacing={1}>
                                <Grid item xs={6}><Typography>Ricavo Totale Mese:</Typography></Grid>
                                <Grid item xs={6}><Typography align="right">€ {chiusuraMensile.ricavoTotale?.toFixed(2) ?? 'N/A'}</Typography></Grid>

                                <Grid item xs={6}><Typography>(-) Spese Aggiuntive:</Typography></Grid>
                                <Grid item xs={6}><Typography align="right" color="error">€ {chiusuraMensile.speseAggiuntive?.toFixed(2) ?? 'N/A'}</Typography></Grid>

                                <Grid item xs={12}><hr /></Grid>

                                <Grid item xs={6}><Typography variant="h6">RICAVO NETTO MENSILE:</Typography></Grid>
                                <Grid item xs={6}><Typography variant="h6" align="right">€ {chiusuraMensile.ricavoNetto?.toFixed(2) ?? 'N/A'}</Typography></Grid>
                            </Grid>
                        </Paper>
                    </Grid>

                    {/* Note e Azioni */}
                    <Grid item xs={12}>
                        <Typography>Note: {chiusuraMensile.note}</Typography>
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
