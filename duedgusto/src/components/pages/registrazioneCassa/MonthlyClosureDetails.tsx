import React, { useContext, useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router';
import { Box, Typography, CircularProgress, Alert, Paper, Grid, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, Divider } from '@mui/material';
import { useQueryChiusuraMensile, useQueryValidaCompletezzaRegistri } from '../../../graphql/chiusureMensili/queries';
import { mutationAggiungiSpesaLibera, mutationCreaChiusuraMensile, mutationChiudiChiusuraMensile, mutationEliminaChiusuraMensile, mutationModificaSpesaLibera, mutationEliminaSpesaLibera } from '../../../graphql/chiusureMensili/mutations';
import PageTitleContext from '../../layout/headerBar/PageTitleContext';
import MonthlySummaryView from './MonthlySummaryView';
import MonthlyExpensesDataGrid from './MonthlyExpensesDataGrid';
import MonthlyClosureReport from './MonthlyClosureReport';
import dayjs from 'dayjs';
import { useMutation } from '@apollo/client';

const MonthlyClosureDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setTitle } = useContext(PageTitleContext);

  // Modalità: "new" (creazione) o esistente (id numerico)
  const isNewMode = !id;
  const newAnno = parseInt(searchParams.get('anno') || '0', 10);
  const newMese = parseInt(searchParams.get('mese') || '0', 10);
  const chiusuraId = isNewMode ? 0 : parseInt(id || '0', 10);

  // Query per chiusura esistente (skip se new mode)
  const { chiusuraMensile, loading, error, refetch } = useQueryChiusuraMensile({
    chiusuraId,
  });

  // Mutations
  const [creaChiusura, { loading: createLoading }] = useMutation(mutationCreaChiusuraMensile);
  const [aggiungiSpesaLibera, { loading: addExpenseLoading }] = useMutation(mutationAggiungiSpesaLibera);
  const [modificaSpesaLibera] = useMutation(mutationModificaSpesaLibera);
  const [eliminaSpesaLiberaMutation] = useMutation(mutationEliminaSpesaLibera);
  const [chiudiChiusura, { loading: closeLoading }] = useMutation(mutationChiudiChiusuraMensile);
  const [eliminaChiusura, { loading: deleteLoading }] = useMutation(mutationEliminaChiusuraMensile);

  const [localSpeseLibere, setLocalSpeseLibere] = useState<SpesaMensileLibera[]>([]);

  // Anno/mese correnti (dalla chiusura esistente o dai query params)
  const anno = chiusuraMensile?.anno ?? newAnno;
  const mese = chiusuraMensile?.mese ?? newMese;

  useEffect(() => {
    if (chiusuraMensile) {
      setLocalSpeseLibere(chiusuraMensile.speseLibere);
    }
  }, [chiusuraMensile]);

  useEffect(() => {
    if (anno && mese) {
      setTitle(`Chiusura Mensile - ${dayjs().month(mese - 1).format('MMMM')} ${anno}`);
    } else {
      setTitle('Dettagli Chiusura Mensile');
    }
  }, [anno, mese, setTitle]);

  // Validazione completezza registri
  const { giorniMancanti } = useQueryValidaCompletezzaRegistri({
    anno,
    mese,
    skip: !anno || !mese || (chiusuraMensile?.stato !== undefined && chiusuraMensile?.stato !== 'BOZZA'),
  });

  const handleExpensesChange = (updatedExpenses: SpesaMensileLibera[]) => {
    setLocalSpeseLibere(updatedExpenses);
  };

  const handleDeleteExpense = (spesaId: number) => {
    setLocalSpeseLibere(prev => prev.filter(e => e.spesaId !== spesaId));
  };

  const handleSaveExpenses = async () => {
    if (isNewMode) {
      // Modalità creazione: crea chiusura, poi aggiungi spese
      const result = await creaChiusura({
        variables: { anno: newAnno, mese: newMese },
      });
      const nuovaChiusura = result.data?.monthlyClosures.creaChiusuraMensile;
      if (!nuovaChiusura) return;

      // Aggiungi le spese alla chiusura appena creata
      for (const expense of localSpeseLibere) {
        await aggiungiSpesaLibera({
          variables: {
            chiusuraId: nuovaChiusura.chiusuraId,
            descrizione: expense.descrizione,
            importo: expense.importo,
            categoria: expense.categoria,
          },
        });
      }

      // Naviga alla chiusura creata (replace per non tornare alla "new")
      navigate(`/gestionale/cassa/monthly-closure/${nuovaChiusura.chiusuraId}`, { replace: true });
      return;
    }

    // Modalità edit: salva modifiche su chiusura esistente
    if (!chiusuraMensile) return;

    // Nuove spese (id negativo)
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

    // Spese modificate
    const serverExpenses = chiusuraMensile.speseLibere;
    const modifiedExpenses = localSpeseLibere.filter(e => {
      if (e.spesaId < 0) return false;
      const original = serverExpenses.find(s => s.spesaId === e.spesaId);
      if (!original) return false;
      return original.descrizione !== e.descrizione || original.importo !== e.importo || original.categoria !== e.categoria;
    });

    for (const expense of modifiedExpenses) {
      await modificaSpesaLibera({
        variables: {
          spesaId: expense.spesaId,
          descrizione: expense.descrizione,
          importo: expense.importo,
          categoria: expense.categoria,
        },
      });
    }

    // Spese eliminate
    const deletedExpenses = serverExpenses.filter(s => !localSpeseLibere.find(l => l.spesaId === s.spesaId));
    for (const expense of deletedExpenses) {
      await eliminaSpesaLiberaMutation({
        variables: { spesaId: expense.spesaId },
      });
    }

    refetch();
  };

  const handleChiudiMese = async () => {
    if (!chiusuraMensile) return;
    await handleSaveExpenses();
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

  const isMutating = createLoading || addExpenseLoading || closeLoading || deleteLoading;
  const isReadOnly = !isNewMode && chiusuraMensile?.stato !== 'BOZZA';
  const hasRegistriMancanti = giorniMancanti.length > 0;

  // Registri non riconciliati
  const registriInclusi = chiusuraMensile?.registriInclusi ?? [];
  const registriNonRiconciliati = registriInclusi.filter(ri => ri.registro.stato === 'CLOSED');

  if (!isNewMode && loading) {
    return <CircularProgress />;
  }

  if (!isNewMode && error) {
    return <Alert severity="error">Errore nel caricamento dei dettagli della chiusura: {error.message}</Alert>;
  }

  if (!isNewMode && !chiusuraMensile) {
    return <Alert severity="warning">Chiusura non trovata.</Alert>;
  }

  if (isNewMode && (!newAnno || !newMese)) {
    return <Alert severity="error">Parametri anno/mese mancanti.</Alert>;
  }

  const monthLabel = dayjs().month(mese - 1).format('MMMM').toUpperCase();

  return (
    <Box sx={{ padding: 3 }}>
      <Paper sx={{ padding: 3 }}>
        <Typography variant="h4" gutterBottom>
          CHIUSURA MENSILE - {monthLabel} {anno}
          {isNewMode && (
            <Typography component="span" variant="h6" color="text.secondary" sx={{ ml: 2 }}>
              (Nuova)
            </Typography>
          )}
        </Typography>

        <Grid container spacing={3}>
          {/* Avviso registri giornalieri mancanti */}
          {hasRegistriMancanti && (isNewMode || chiusuraMensile?.stato === 'BOZZA') && (
            <Grid item xs={12}>
              <Alert severity="error">
                Registri giornalieri mancanti ({giorniMancanti.length}): la chiusura definitiva non è possibile finché tutti i giorni non hanno un registro chiuso.
              </Alert>
            </Grid>
          )}

          {/* Avviso registri non riconciliati */}
          {registriNonRiconciliati.length > 0 && (
            <Grid item xs={12}>
              <Alert severity="warning">
                {registriNonRiconciliati.length} registr{registriNonRiconciliati.length === 1 ? 'o' : 'i'} giornalier{registriNonRiconciliati.length === 1 ? 'o' : 'i'} non riconciliat{registriNonRiconciliati.length === 1 ? 'o' : 'i'}.
                La chiusura è possibile, ma si consiglia la riconciliazione per maggiore accuratezza.
              </Alert>
            </Grid>
          )}

          {/* Riepilogo Incassi (solo se chiusura esistente) */}
          {chiusuraMensile && (
            <Grid item xs={12}>
              <MonthlySummaryView closure={chiusuraMensile} />
            </Grid>
          )}

          {/* Registri Giornalieri Inclusi (solo se chiusura esistente con registri) */}
          {registriInclusi.length > 0 && (
            <Grid item xs={12}>
              <Paper elevation={3} sx={{ padding: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Registri Giornalieri Inclusi ({registriInclusi.length})
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Data</TableCell>
                        <TableCell align="right">Vendite Totali</TableCell>
                        <TableCell align="right">Contanti</TableCell>
                        <TableCell align="right">Elettronici</TableCell>
                        <TableCell align="right">Fattura</TableCell>
                        <TableCell align="right">Differenza</TableCell>
                        <TableCell>Stato</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {registriInclusi.map((ri) => (
                        <TableRow key={ri.registroId}>
                          <TableCell>{dayjs(ri.registro.data).format('DD/MM/YYYY')}</TableCell>
                          <TableCell align="right">€ {(ri.registro.totaleVendite ?? 0).toFixed(2)}</TableCell>
                          <TableCell align="right">€ {(ri.registro.incassoContanteTracciato ?? 0).toFixed(2)}</TableCell>
                          <TableCell align="right">€ {(ri.registro.incassiElettronici ?? 0).toFixed(2)}</TableCell>
                          <TableCell align="right">€ {(ri.registro.incassiFattura ?? 0).toFixed(2)}</TableCell>
                          <TableCell align="right" sx={{ color: (ri.registro as { differenza?: number }).differenza !== 0 ? 'error.main' : 'inherit' }}>
                            € {((ri.registro as { differenza?: number }).differenza ?? 0).toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={ri.registro.stato}
                              size="small"
                              color={ri.registro.stato === 'RECONCILED' ? 'success' : 'warning'}
                              variant="outlined"
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Grid>
          )}

          {/* Spese Mensili Libere */}
          <Grid item xs={12}>
            <MonthlyExpensesDataGrid
              expenses={localSpeseLibere}
              onExpensesChange={handleExpensesChange}
              onDeleteExpense={handleDeleteExpense}
              readOnly={isReadOnly}
            />
          </Grid>

          {/* Pagamenti Fornitori Inclusi */}
          {chiusuraMensile && chiusuraMensile.pagamentiInclusi.length > 0 && (
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

          {/* Riepilogo Finale (solo se chiusura esistente) */}
          {chiusuraMensile && (
            <Grid item xs={12}>
              <Paper elevation={3} sx={{ padding: 2 }}>
                <Typography variant="h6">Riepilogo Finale</Typography>
                <Grid container spacing={1}>
                  <Grid item xs={6}><Typography>Totale Lordo (Entrate):</Typography></Grid>
                  <Grid item xs={6}><Typography align="right">€ {chiusuraMensile.totaleLordoCalcolato.toFixed(2)}</Typography></Grid>

                  <Grid item xs={6}><Typography sx={{ pl: 2 }} color="text.secondary">di cui Imponibile:</Typography></Grid>
                  <Grid item xs={6}><Typography align="right" color="text.secondary">€ {chiusuraMensile.totaleImponibileCalcolato.toFixed(2)}</Typography></Grid>

                  <Grid item xs={6}><Typography sx={{ pl: 2 }} color="text.secondary">di cui IVA:</Typography></Grid>
                  <Grid item xs={6}><Typography align="right" color="text.secondary">€ {chiusuraMensile.totaleIvaCalcolato.toFixed(2)}</Typography></Grid>

                  <Grid item xs={6}><Typography>(-) Spese Aggiuntive:</Typography></Grid>
                  <Grid item xs={6}><Typography align="right" color="error">€ {chiusuraMensile.speseAggiuntiveCalcolate.toFixed(2)}</Typography></Grid>

                  {chiusuraMensile.totaleDifferenzeCassaCalcolato !== 0 && (
                    <>
                      <Grid item xs={6}><Typography>Differenze di cassa:</Typography></Grid>
                      <Grid item xs={6}>
                        <Typography align="right" color={chiusuraMensile.totaleDifferenzeCassaCalcolato < 0 ? 'error' : 'success.main'}>
                          € {chiusuraMensile.totaleDifferenzeCassaCalcolato.toFixed(2)}
                        </Typography>
                      </Grid>
                    </>
                  )}

                  <Grid item xs={12}><Divider sx={{ my: 1 }} /></Grid>

                  <Grid item xs={6}><Typography variant="h6">RICAVO NETTO MENSILE:</Typography></Grid>
                  <Grid item xs={6}><Typography variant="h6" align="right">€ {chiusuraMensile.ricavoNettoCalcolato.toFixed(2)}</Typography></Grid>
                </Grid>
              </Paper>
            </Grid>
          )}

          {/* Info chiusura */}
          {chiusuraMensile && chiusuraMensile.stato !== 'BOZZA' && chiusuraMensile.chiusaDaUtente && (
            <Grid item xs={12}>
              <Typography variant="body2" color="text.secondary">
                Chiusa da {chiusuraMensile.chiusaDaUtente.nomeUtente} il {dayjs(chiusuraMensile.chiusaIl).format('DD/MM/YYYY HH:mm')}
              </Typography>
            </Grid>
          )}

          {/* Note */}
          {chiusuraMensile?.note && (
            <Grid item xs={12}>
              <Typography>Note: {chiusuraMensile.note}</Typography>
            </Grid>
          )}

          {/* Azioni */}
          <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
            {chiusuraMensile && <MonthlyClosureReport closure={chiusuraMensile} />}

            {isNewMode && (
              <Button
                variant="contained"
                onClick={handleSaveExpenses}
                disabled={isMutating}
              >
                {createLoading ? <CircularProgress size={20} /> : 'Salva'}
              </Button>
            )}

            {!isNewMode && chiusuraMensile?.stato === 'BOZZA' && (
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
                  disabled={isMutating || hasRegistriMancanti}
                  title={hasRegistriMancanti ? 'Registri giornalieri mancanti' : ''}
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
