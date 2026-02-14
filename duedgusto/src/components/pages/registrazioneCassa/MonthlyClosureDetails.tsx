import { useCallback, useContext, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router";
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Paper,
  Grid,
  Toolbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Divider,
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import DeleteIcon from "@mui/icons-material/Delete";
import LockIcon from "@mui/icons-material/Lock";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { GridReadyEvent } from "ag-grid-community";
import { useMutation } from "@apollo/client";
import dayjs from "dayjs";

import { useQueryChiusuraMensile, useQueryValidaCompletezzaRegistri } from "../../../graphql/chiusureMensili/queries";
import {
  mutationAggiungiSpesaLibera,
  mutationCreaChiusuraMensile,
  mutationChiudiChiusuraMensile,
  mutationEliminaChiusuraMensile,
  mutationModificaSpesaLibera,
  mutationEliminaSpesaLibera,
} from "../../../graphql/chiusureMensili/mutations";
import PageTitleContext from "../../layout/headerBar/PageTitleContext";
import FormikToolbarButton from "../../common/form/toolbar/FormikToolbarButton";
import useConfirm from "../../common/confirm/useConfirm";
import showToast from "../../../common/toast/showToast";
import MonthlySummaryView from "./MonthlySummaryView";
import MonthlyExpensesDataGrid from "./MonthlyExpensesDataGrid";
import MonthlyClosureReport from "./MonthlyClosureReport";
import { DatagridData } from "../../common/datagrid/@types/Datagrid";

interface SpesaRow extends Record<string, unknown> {
  spesaId: number;
  chiusuraId: number;
  descrizione: string;
  importo: number;
  categoria: CategoriaSpesa;
}

const MonthlyClosureDetails = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setTitle } = useContext(PageTitleContext);
  const onConfirm = useConfirm();

  const isNewMode = !id;
  const newAnno = parseInt(searchParams.get("anno") || "0", 10);
  const newMese = parseInt(searchParams.get("mese") || "0", 10);
  const chiusuraId = isNewMode ? 0 : parseInt(id || "0", 10);

  const { chiusuraMensile, loading, error, refetch } = useQueryChiusuraMensile({ chiusuraId });

  const [creaChiusura, { loading: createLoading }] = useMutation(mutationCreaChiusuraMensile);
  const [aggiungiSpesaLibera, { loading: addExpenseLoading }] = useMutation(mutationAggiungiSpesaLibera);
  const [modificaSpesaLibera] = useMutation(mutationModificaSpesaLibera);
  const [eliminaSpesaLiberaMutation] = useMutation(mutationEliminaSpesaLibera);
  const [chiudiChiusura, { loading: closeLoading }] = useMutation(mutationChiudiChiusuraMensile);
  const [eliminaChiusura, { loading: deleteLoading }] = useMutation(mutationEliminaChiusuraMensile);

  const expensesGridRef = useRef<GridReadyEvent<DatagridData<SpesaRow>> | null>(null);

  const anno = chiusuraMensile?.anno ?? newAnno;
  const mese = chiusuraMensile?.mese ?? newMese;
  const isMutating = createLoading || addExpenseLoading || closeLoading || deleteLoading;
  const isDraft = isNewMode || chiusuraMensile?.stato === "BOZZA";
  const isReadOnly = !isDraft;

  const registriInclusi = useMemo(() => chiusuraMensile?.registriInclusi ?? [], [chiusuraMensile?.registriInclusi]);
  const registriNonRiconciliati = useMemo(() => registriInclusi.filter((ri) => ri.registro.stato === "CLOSED"), [registriInclusi]);

  const { giorniMancanti } = useQueryValidaCompletezzaRegistri({
    anno,
    mese,
    skip: !anno || !mese || !isDraft,
  });
  const hasRegistriMancanti = giorniMancanti.length > 0;

  useEffect(() => {
    if (anno && mese) {
      setTitle(`Chiusura Mensile - ${dayjs().month(mese - 1).format("MMMM")} ${anno}`);
    } else {
      setTitle("Dettagli Chiusura Mensile");
    }
  }, [anno, mese, setTitle]);

  const getGridExpenses = useCallback((): SpesaRow[] => {
    if (!expensesGridRef.current) return [];
    const rows: SpesaRow[] = [];
    expensesGridRef.current.api.forEachNode((node) => {
      if (node.data) {
        rows.push({
          spesaId: node.data.spesaId,
          chiusuraId: node.data.chiusuraId,
          descrizione: node.data.descrizione,
          importo: node.data.importo,
          categoria: node.data.categoria as CategoriaSpesa,
        });
      }
    });
    return rows;
  }, []);

  const handleSaveExpenses = useCallback(async () => {
    const localSpeseLibere = getGridExpenses();

    try {
      if (isNewMode) {
        const result = await creaChiusura({ variables: { anno: newAnno, mese: newMese } });
        const nuovaChiusura = result.data?.monthlyClosures.creaChiusuraMensile;
        if (!nuovaChiusura) return;

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

        showToast({ type: "success", position: "bottom-right", message: "Chiusura creata con successo", autoClose: 2000, toastId: "save-success" });
        navigate(`/gestionale/cassa/monthly-closure/${nuovaChiusura.chiusuraId}`, { replace: true });
        return;
      }

      if (!chiusuraMensile) return;

      const newExpenses = localSpeseLibere.filter((e) => e.spesaId < 0);
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

      const serverExpenses = chiusuraMensile.speseLibere;
      const modifiedExpenses = localSpeseLibere.filter((e) => {
        if (e.spesaId < 0) return false;
        const original = serverExpenses.find((s) => s.spesaId === e.spesaId);
        if (!original) return false;
        return original.descrizione !== e.descrizione || original.importo !== e.importo || original.categoria !== e.categoria;
      });

      for (const expense of modifiedExpenses) {
        await modificaSpesaLibera({
          variables: { spesaId: expense.spesaId, descrizione: expense.descrizione, importo: expense.importo, categoria: expense.categoria },
        });
      }

      const deletedExpenses = serverExpenses.filter((s) => !localSpeseLibere.find((l) => l.spesaId === s.spesaId));
      for (const expense of deletedExpenses) {
        await eliminaSpesaLiberaMutation({ variables: { spesaId: expense.spesaId } });
      }

      showToast({ type: "success", position: "bottom-right", message: "Spese salvate con successo", autoClose: 2000, toastId: "save-success" });
      refetch();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Errore nel salvataggio";
      showToast({ type: "error", position: "bottom-right", message, toastId: "save-error" });
    }
  }, [getGridExpenses, isNewMode, chiusuraMensile, creaChiusura, newAnno, newMese, aggiungiSpesaLibera, navigate, modificaSpesaLibera, eliminaSpesaLiberaMutation, refetch]);

  const handleChiudiMese = useCallback(async () => {
    if (!chiusuraMensile) return;
    const confirmed = await onConfirm({
      title: "Chiusura Mensile",
      content: "Sei sicuro di voler chiudere definitivamente questo mese? L'operazione non è reversibile.",
      acceptLabel: "Chiudi Mese",
      cancelLabel: "Annulla",
    });
    if (!confirmed) return;

    try {
      await handleSaveExpenses();
      await chiudiChiusura({ variables: { chiusuraId: chiusuraMensile.chiusuraId } });
      showToast({ type: "success", position: "bottom-right", message: "Mese chiuso con successo", autoClose: 2000, toastId: "close-success" });
      refetch();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Errore nella chiusura del mese";
      showToast({ type: "error", position: "bottom-right", message, toastId: "close-error" });
    }
  }, [chiusuraMensile, onConfirm, handleSaveExpenses, chiudiChiusura, refetch]);

  const handleElimina = useCallback(async () => {
    if (!chiusuraMensile) return;
    const confirmed = await onConfirm({
      title: "Elimina Chiusura",
      content: "Sei sicuro di voler eliminare questa chiusura mensile?",
      acceptLabel: "Elimina",
      cancelLabel: "Annulla",
    });
    if (!confirmed) return;

    try {
      await eliminaChiusura({ variables: { chiusuraId: chiusuraMensile.chiusuraId } });
      showToast({ type: "success", position: "bottom-right", message: "Chiusura eliminata", autoClose: 2000, toastId: "delete-success" });
      navigate("/gestionale/cassa/monthly-closure");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Errore nell'eliminazione";
      showToast({ type: "error", position: "bottom-right", message, toastId: "delete-error" });
    }
  }, [chiusuraMensile, onConfirm, eliminaChiusura, navigate]);

  const handleBack = useCallback(() => {
    navigate("/gestionale/cassa/monthly-closure");
  }, [navigate]);

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

  return (
    <Box>
      {/* Toolbar */}
      <Box sx={{ borderBottom: 1, borderColor: "divider", bgcolor: "background.paper" }}>
        <Toolbar variant="dense" disableGutters sx={{ minHeight: 48, height: 48, display: "flex", justifyContent: "space-between" }}>
          <Box sx={{ height: 48, display: "flex", alignItems: "stretch" }}>
            <FormikToolbarButton startIcon={<ArrowBackIcon />} onClick={handleBack}>
              Indietro
            </FormikToolbarButton>

            {isDraft && (
              <FormikToolbarButton startIcon={<SaveIcon />} disabled={isMutating} onClick={handleSaveExpenses}>
                Salva
              </FormikToolbarButton>
            )}

            {isDraft && !isNewMode && (
              <FormikToolbarButton startIcon={<LockIcon />} disabled={isMutating || hasRegistriMancanti} onClick={handleChiudiMese}>
                Chiudi Mese
              </FormikToolbarButton>
            )}

            {isDraft && !isNewMode && (
              <FormikToolbarButton startIcon={<DeleteIcon />} color="error" disabled={isMutating} onClick={handleElimina}>
                Elimina
              </FormikToolbarButton>
            )}
          </Box>

          <Box sx={{ display: "flex", alignItems: "stretch", height: 48 }}>
            {chiusuraMensile && <MonthlyClosureReport closure={chiusuraMensile} />}
          </Box>
        </Toolbar>
      </Box>

      {/* Contenuto */}
      <Box className="scrollable-box" sx={{ paddingX: 2, paddingY: 2, overflow: "auto", height: "calc(100vh - 64px - 48px)" }}>
        {/* Alert */}
        {hasRegistriMancanti && isDraft && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Registri giornalieri mancanti ({giorniMancanti.length}): la chiusura definitiva non è possibile finché tutti i giorni non hanno un registro chiuso.
          </Alert>
        )}
        {registriNonRiconciliati.length > 0 && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {registriNonRiconciliati.length} registr{registriNonRiconciliati.length === 1 ? "o" : "i"} giornalier{registriNonRiconciliati.length === 1 ? "o" : "i"} non riconciliat
            {registriNonRiconciliati.length === 1 ? "o" : "i"}. La chiusura è possibile, ma si consiglia la riconciliazione per maggiore accuratezza.
          </Alert>
        )}

        <Grid container spacing={3}>
          {/* Riepilogo Incassi */}
          {chiusuraMensile && (
            <Grid item xs={12}>
              <MonthlySummaryView closure={chiusuraMensile} />
            </Grid>
          )}

          {/* Registri Giornalieri Inclusi */}
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
                          <TableCell>{dayjs(ri.registro.data).format("DD/MM/YYYY")}</TableCell>
                          <TableCell align="right">{`€ ${(ri.registro.totaleVendite ?? 0).toFixed(2)}`}</TableCell>
                          <TableCell align="right">{`€ ${(ri.registro.incassoContanteTracciato ?? 0).toFixed(2)}`}</TableCell>
                          <TableCell align="right">{`€ ${(ri.registro.incassiElettronici ?? 0).toFixed(2)}`}</TableCell>
                          <TableCell align="right">{`€ ${(ri.registro.incassiFattura ?? 0).toFixed(2)}`}</TableCell>
                          <TableCell align="right" sx={{ color: (ri.registro as { differenza?: number }).differenza !== 0 ? "error.main" : "inherit" }}>
                            {`€ ${((ri.registro as { differenza?: number }).differenza ?? 0).toFixed(2)}`}
                          </TableCell>
                          <TableCell>
                            <Chip label={ri.registro.stato} size="small" color={ri.registro.stato === "RECONCILED" ? "success" : "warning"} variant="outlined" />
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
            <MonthlyExpensesDataGrid ref={expensesGridRef} expenses={chiusuraMensile?.speseLibere ?? []} readOnly={isReadOnly} />
          </Grid>

          {/* Pagamenti Fornitori Inclusi */}
          {chiusuraMensile && chiusuraMensile.pagamentiInclusi.length > 0 && (
            <Grid item xs={12}>
              <Paper elevation={3} sx={{ padding: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Pagamenti Fornitori Inclusi
                </Typography>
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
                          <TableCell>{dayjs(pi.pagamento.dataPagamento).format("DD/MM/YYYY")}</TableCell>
                          <TableCell align="right">{`€ ${pi.pagamento.importo.toFixed(2)}`}</TableCell>
                          <TableCell>{pi.pagamento.metodoPagamento || "-"}</TableCell>
                          <TableCell>{pi.pagamento.note || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Grid>
          )}

          {/* Riepilogo Finale */}
          {chiusuraMensile && (
            <Grid item xs={12}>
              <Paper elevation={3} sx={{ padding: 2 }}>
                <Typography variant="h6">Riepilogo Finale</Typography>
                <Grid container spacing={1}>
                  <Grid item xs={6}>
                    <Typography>Totale Lordo (Entrate):</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography align="right">{`€ ${chiusuraMensile.totaleLordoCalcolato.toFixed(2)}`}</Typography>
                  </Grid>

                  <Grid item xs={6}>
                    <Typography sx={{ pl: 2 }} color="text.secondary">
                      di cui Imponibile:
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography align="right" color="text.secondary">{`€ ${chiusuraMensile.totaleImponibileCalcolato.toFixed(2)}`}</Typography>
                  </Grid>

                  <Grid item xs={6}>
                    <Typography sx={{ pl: 2 }} color="text.secondary">
                      di cui IVA:
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography align="right" color="text.secondary">{`€ ${chiusuraMensile.totaleIvaCalcolato.toFixed(2)}`}</Typography>
                  </Grid>

                  <Grid item xs={6}>
                    <Typography>(-) Spese Aggiuntive:</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography align="right" color="error">{`€ ${chiusuraMensile.speseAggiuntiveCalcolate.toFixed(2)}`}</Typography>
                  </Grid>

                  {chiusuraMensile.totaleDifferenzeCassaCalcolato !== 0 && (
                    <>
                      <Grid item xs={6}>
                        <Typography>Differenze di cassa:</Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography align="right" color={chiusuraMensile.totaleDifferenzeCassaCalcolato < 0 ? "error" : "success.main"}>
                          {`€ ${chiusuraMensile.totaleDifferenzeCassaCalcolato.toFixed(2)}`}
                        </Typography>
                      </Grid>
                    </>
                  )}

                  <Grid item xs={12}>
                    <Divider sx={{ my: 1 }} />
                  </Grid>

                  <Grid item xs={6}>
                    <Typography variant="h6">RICAVO NETTO MENSILE:</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="h6" align="right">{`€ ${chiusuraMensile.ricavoNettoCalcolato.toFixed(2)}`}</Typography>
                  </Grid>
                </Grid>
              </Paper>
            </Grid>
          )}

          {/* Info chiusura */}
          {chiusuraMensile && chiusuraMensile.stato !== "BOZZA" && chiusuraMensile.chiusaDaUtente && (
            <Grid item xs={12}>
              <Typography variant="body2" color="text.secondary">
                Chiusa da {chiusuraMensile.chiusaDaUtente.nomeUtente} il {dayjs(chiusuraMensile.chiusaIl).format("DD/MM/YYYY HH:mm")}
              </Typography>
            </Grid>
          )}

          {/* Note */}
          {chiusuraMensile?.note && (
            <Grid item xs={12}>
              <Typography>Note: {chiusuraMensile.note}</Typography>
            </Grid>
          )}
        </Grid>
      </Box>
    </Box>
  );
};

export default MonthlyClosureDetails;
