import React, { useContext, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Box, Typography, CircularProgress, Alert, Paper, Grid, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import { useQueryChiusuraMensile } from '../../../graphql/chiusureMensili/queries';
import { mutationAggiungiSpesaLibera, mutationChiudiChiusuraMensile, mutationEliminaChiusuraMensile } from '../../../graphql/chiusureMensili/mutations';
import PageTitleContext from '../../layout/headerBar/PageTitleContext';
import MonthlySummaryView from './MonthlySummaryView';
import MonthlyExpensesDataGrid from './MonthlyExpensesDataGrid';
import dayjs from 'dayjs';
import { useMutation } from '@apollo/client';

const MonthlyClosureDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { setTitle } = useContext(PageTitleContext);
  const chiusuraId = parseInt(id || '0', 10);

  const { chiusuraMensile, loading, error, refetch } = useQueryChiusuraMensile({ chiusuraId });

  const [aggiungiSpesaLibera, { loading: addExpenseLoading }] = useMutation(mutationAggiungiSpesaLibera);
  const [chiudiChiusura, { loading: closeLoading }] = useMutation(mutationChiudiChiusuraMensile);
  const [eliminaChiusura, { loading: deleteLoading }] = useMutation(mutationEliminaChiusuraMensile);

  const [localSpeseLibere, setLocalSpeseLibere] = useState<SpesaMensileLibera[]>([]);

  useEffect(() => {
    if (chiusuraMensile) {
      setLocalSpeseLibere(chiusuraMensile.speseLibere);
    }
  }, [chiusuraMensile]);

  useEffect(() => {
    if (chiusuraMensile) {
      setTitle(`Chiusura Mensile - ${dayjs().month(chiusuraMensile.mese - 1).format('MMMM')} ${chiusuraMensile.anno}`);
    } else {
      setTitle('Dettagli Chiusura Mensile');
    }
  }, [chiusuraMensile, setTitle]);

  const handleExpensesChange = (updatedExpenses: SpesaMensileLibera[]) => {
    setLocalSpeseLibere(updatedExpenses);
  };

  const handleSaveExpenses = async () => {
    if (!chiusuraMensile) return;

    const newExpenses = localSpeseLibere.filter(e => e.spesaId < 0);
    for (const expense of newExpenses) {
      await aggiungiSpesaLibera({
        variables: {
          chiusuraId: chiusuraMensile.chiusuraId,
          descrizione: expense.descrizione,
          importo: expense.importo,
          categoria: expense.categoria,
        },
      });
    }
    refetch();
  };

  const handleChiudiMese = async () => {
    if (!chiusuraMensile) return;

    // Prima salva eventuali spese nuove
    const newExpenses = localSpeseLibere.filter(e => e.spesaId < 0);
    for (const expense of newExpenses) {
      await aggiungiSpesaLibera({
        variables: {
          chiusuraId: chiusuraMensile.chiusuraId,
          descrizione: expense.descrizione,
          importo: expense.importo,
          categoria: expense.categoria,
        },
      });
    }

    await chiudiChiusura({
      variables: { chiusuraId: chiusuraMensile.chiusuraId },
    });
    refetch();
  };

  const handleElimina = async () => {
    if (!chiusuraMensile) return;
    await eliminaChiusura({
      variables: { chiusuraId: chiusuraMensile.chiusuraId },
    });
    navigate('/gestionale/cassa/monthly-closure');
  };

  const isMutating = addExpenseLoading || closeLoading || deleteLoading;
  const isReadOnly = chiusuraMensile?.stato !== 'BOZZA';

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
          CHIUSURA MENSILE - {dayjs().month(chiusuraMensile.mese - 1).format('MMMM').toUpperCase()} {chiusuraMensile.anno}
        </Typography>

        <Grid container spacing={3}>
          {/* Riepilogo Incassi */}
          <Grid item xs={12}>
            <MonthlySummaryView closure={chiusuraMensile} />
          </Grid>

          {/* Registri Giornalieri Inclusi */}
          <Grid item xs={12}>
            <Paper elevation={3} sx={{ padding: 2 }}>
              <Typography variant="h6" gutterBottom>Registri Giornalieri Inclusi</Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Data</TableCell>
                      <TableCell align="right">Vendite Totali</TableCell>
                      <TableCell align="right">Contanti</TableCell>
                      <TableCell align="right">Elettronici</TableCell>
                      <TableCell align="right">Fattura</TableCell>
                      <TableCell>Stato</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {chiusuraMensile.registriInclusi.map((ri) => (
                      <TableRow key={ri.registroId}>
                        <TableCell>{dayjs(ri.registro.data).format('DD/MM/YYYY')}</TableCell>
                        <TableCell align="right">€ {(ri.registro.totaleVendite ?? 0).toFixed(2)}</TableCell>
                        <TableCell align="right">€ {(ri.registro.incassoContanteTracciato ?? 0).toFixed(2)}</TableCell>
                        <TableCell align="right">€ {(ri.registro.incassiElettronici ?? 0).toFixed(2)}</TableCell>
                        <TableCell align="right">€ {(ri.registro.incassiFattura ?? 0).toFixed(2)}</TableCell>
                        <TableCell>{ri.registro.stato}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>

          {/* Spese Mensili Libere */}
          <Grid item xs={12}>
            <MonthlyExpensesDataGrid
              expenses={localSpeseLibere}
              onExpensesChange={handleExpensesChange}
              readOnly={isReadOnly}
            />
          </Grid>

          {/* Pagamenti Fornitori Inclusi */}
          {chiusuraMensile.pagamentiInclusi.length > 0 && (
            <Grid item xs={12}>
              <Paper elevation={3} sx={{ padding: 2 }}>
                <Typography variant="h6" gutterBottom>Pagamenti Fornitori Inclusi</Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Data Pagamento</TableCell>
                        <TableCell align="right">Importo</TableCell>
                        <TableCell>Metodo</TableCell>
                        <TableCell>Note</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {chiusuraMensile.pagamentiInclusi.map((pi) => (
                        <TableRow key={pi.pagamentoId}>
                          <TableCell>{dayjs(pi.pagamento.dataPagamento).format('DD/MM/YYYY')}</TableCell>
                          <TableCell align="right">€ {pi.pagamento.importo.toFixed(2)}</TableCell>
                          <TableCell>{pi.pagamento.metodoPagamento || '-'}</TableCell>
                          <TableCell>{pi.pagamento.note || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Grid>
          )}

          {/* Riepilogo Finale */}
          <Grid item xs={12}>
            <Paper elevation={3} sx={{ padding: 2 }}>
              <Typography variant="h6">Riepilogo Finale</Typography>
              <Grid container spacing={1}>
                <Grid item xs={6}><Typography>Ricavo Totale Mese:</Typography></Grid>
                <Grid item xs={6}><Typography align="right">€ {chiusuraMensile.ricavoTotaleCalcolato.toFixed(2)}</Typography></Grid>

                <Grid item xs={6}><Typography>(-) Spese Aggiuntive:</Typography></Grid>
                <Grid item xs={6}><Typography align="right" color="error">€ {chiusuraMensile.speseAggiuntiveCalcolate.toFixed(2)}</Typography></Grid>

                <Grid item xs={12}><hr /></Grid>

                <Grid item xs={6}><Typography variant="h6">RICAVO NETTO MENSILE:</Typography></Grid>
                <Grid item xs={6}><Typography variant="h6" align="right">€ {chiusuraMensile.ricavoNettoCalcolato.toFixed(2)}</Typography></Grid>
              </Grid>
            </Paper>
          </Grid>

          {/* Note */}
          {chiusuraMensile.note && (
            <Grid item xs={12}>
              <Typography>Note: {chiusuraMensile.note}</Typography>
            </Grid>
          )}

          {/* Azioni */}
          <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
            {chiusuraMensile.stato === 'BOZZA' && (
              <>
                <Button
                  variant="outlined"
                  color="error"
                  onClick={handleElimina}
                  disabled={isMutating}
                >
                  Elimina
                </Button>
                <Button
                  variant="outlined"
                  onClick={handleSaveExpenses}
                  disabled={isMutating}
                >
                  Salva Spese
                </Button>
                <Button
                  variant="contained"
                  onClick={handleChiudiMese}
                  disabled={isMutating}
                >
                  Chiudi Mese
                </Button>
              </>
            )}
            <Button variant="text" onClick={() => navigate('/gestionale/cassa/monthly-closure')}>
              Indietro
            </Button>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
};

export default MonthlyClosureDetails;
