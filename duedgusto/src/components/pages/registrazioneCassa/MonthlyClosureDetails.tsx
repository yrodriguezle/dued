import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
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
  Checkbox,
  Select,
  MenuItem,
  TextField,
  Button,
  IconButton,
  Badge,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import DeleteIcon from "@mui/icons-material/Delete";
import LockIcon from "@mui/icons-material/Lock";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import EventBusyIcon from "@mui/icons-material/EventBusy";
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
  mutationAggiornaGiorniEsclusi,
} from "../../../graphql/chiusureMensili/mutations";
import PageTitleContext from "../../layout/headerBar/PageTitleContext";
import FormikToolbarButton from "../../common/form/toolbar/FormikToolbarButton";
import useConfirm from "../../common/confirm/useConfirm";
import showToast from "../../../common/toast/showToast";
import MonthlyExpensesDataGrid from "./MonthlyExpensesDataGrid";
import MonthlyClosureReport from "./MonthlyClosureReport";
import { DatagridData } from "../../common/datagrid/@types/Datagrid";

const MOTIVO_LABELS: Record<CodiceMotivo, string> = {
  ATTIVITA_NON_AVVIATA: "Attivit\u00e0 non avviata",
  CHIUSURA_PROGRAMMATA: "Chiusura programmata",
  EVENTO_ECCEZIONALE: "Evento eccezionale",
};

interface EsclusioneLocale {
  data: string;
  codiceMotivo: CodiceMotivo;
  note: string;
  selected: boolean;
}

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
  const [aggiornaGiorniEsclusi, { loading: excludeLoading }] = useMutation(mutationAggiornaGiorniEsclusi);

  const expensesGridRef = useRef<GridReadyEvent<DatagridData<SpesaRow>> | null>(null);
  const autoCreateInitiated = useRef(false);
  const [autoCreateError, setAutoCreateError] = useState<string | null>(null);
  const [giorniMancantiModalOpen, setGiorniMancantiModalOpen] = useState(false);

  const anno = chiusuraMensile?.anno ?? newAnno;
  const mese = chiusuraMensile?.mese ?? newMese;
  const isMutating = createLoading || addExpenseLoading || closeLoading || deleteLoading || excludeLoading;
  const isDraft = isNewMode || chiusuraMensile?.stato === "BOZZA";
  const isReadOnly = !isDraft;

  const registriInclusi = useMemo(() => chiusuraMensile?.registriInclusi ?? [], [chiusuraMensile?.registriInclusi]);
  const registriNonRiconciliati = useMemo(() => registriInclusi.filter((ri) => ri.registro.stato === "CLOSED"), [registriInclusi]);

  const giorniEsclusiParsed: GiornoEscluso[] = useMemo(() => {
    if (!chiusuraMensile?.giorniEsclusi) return [];
    try {
      return JSON.parse(chiusuraMensile.giorniEsclusi) as GiornoEscluso[];
    } catch {
      return [];
    }
  }, [chiusuraMensile?.giorniEsclusi]);

  const giorniEsclusiSet = useMemo(() => new Set(giorniEsclusiParsed.map((e) => dayjs(e.data).format("YYYY-MM-DD"))), [giorniEsclusiParsed]);

  const { giorniMancanti } = useQueryValidaCompletezzaRegistri({
    anno,
    mese,
    skip: !anno || !mese || !isDraft,
  });

  const giorniEffettivamenteMancanti = useMemo(
    () => giorniMancanti.filter((d) => !giorniEsclusiSet.has(dayjs(d).format("YYYY-MM-DD"))),
    [giorniMancanti, giorniEsclusiSet]
  );
  const hasRegistriMancanti = giorniEffettivamenteMancanti.length > 0;
  const hasGiorniDaGestire = hasRegistriMancanti || giorniEsclusiParsed.length > 0;

  const [esclusioniLocali, setEsclusioniLocali] = useState<EsclusioneLocale[]>([]);

  useEffect(() => {
    setEsclusioniLocali((prev) => {
      const newDates = giorniEffettivamenteMancanti.map((d) => dayjs(d).format("YYYY-MM-DD"));
      const prevDates = prev.map((e) => e.data);

      if (newDates.length === prevDates.length && newDates.every((d, i) => d === prevDates[i])) {
        return prev;
      }

      return newDates.map((d) => ({
        data: d,
        codiceMotivo: "ATTIVITA_NON_AVVIATA" as CodiceMotivo,
        note: "",
        selected: false,
      }));
    });
  }, [giorniEffettivamenteMancanti]);

  useEffect(() => {
    if (anno && mese) {
      setTitle(`Chiusura Mensile - ${dayjs().month(mese - 1).format("MMMM")} ${anno}`);
    } else {
      setTitle("Dettagli Chiusura Mensile");
    }
  }, [anno, mese, setTitle]);

  useEffect(() => {
    if (isNewMode && newAnno && newMese && !autoCreateInitiated.current) {
      autoCreateInitiated.current = true;
      creaChiusura({ variables: { anno: newAnno, mese: newMese } })
        .then((result) => {
          const nuovaChiusura = result.data?.monthlyClosures.creaChiusuraMensile;
          if (nuovaChiusura) {
            navigate(`/gestionale/cassa/monthly-closure/${nuovaChiusura.chiusuraId}`, { replace: true });
          } else {
            setAutoCreateError("La creazione non ha restituito dati.");
          }
        })
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : "";
          const existingIdMatch = message.match(/ID:\s*(\d+)/);
          if (existingIdMatch) {
            navigate(`/gestionale/cassa/monthly-closure/${existingIdMatch[1]}`, { replace: true });
            return;
          }
          setAutoCreateError(message || "Errore nella creazione della chiusura");
        });
    }
  }, [isNewMode, newAnno, newMese, creaChiusura, navigate]);

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

  const handleEscludiSelezionati = useCallback(async () => {
    if (!chiusuraMensile) return;
    const selezionati = esclusioniLocali.filter((e) => e.selected);
    if (selezionati.length === 0) return;

    const nuoviEsclusi = [
      ...giorniEsclusiParsed.map((e) => ({
        data: e.data,
        codiceMotivo: e.codiceMotivo,
        note: e.note || null,
      })),
      ...selezionati.map((e) => ({
        data: e.data,
        codiceMotivo: e.codiceMotivo,
        note: e.note || null,
      })),
    ];

    try {
      await aggiornaGiorniEsclusi({
        variables: { chiusuraId: chiusuraMensile.chiusuraId, giorniEsclusi: nuoviEsclusi },
      });
      showToast({ type: "success", position: "bottom-right", message: `${selezionati.length} giorni esclusi con successo`, autoClose: 2000, toastId: "exclude-success" });
      refetch();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Errore nell'esclusione dei giorni";
      showToast({ type: "error", position: "bottom-right", message, toastId: "exclude-error" });
    }
  }, [chiusuraMensile, esclusioniLocali, giorniEsclusiParsed, aggiornaGiorniEsclusi, refetch]);

  const handleRimuoviEsclusione = useCallback(
    async (dataToRemove: string) => {
      if (!chiusuraMensile) return;
      const nuoviEsclusi = giorniEsclusiParsed
        .filter((e) => dayjs(e.data).format("YYYY-MM-DD") !== dataToRemove)
        .map((e) => ({
          data: e.data,
          codiceMotivo: e.codiceMotivo,
          note: e.note || null,
        }));

      try {
        await aggiornaGiorniEsclusi({
          variables: { chiusuraId: chiusuraMensile.chiusuraId, giorniEsclusi: nuoviEsclusi },
        });
        showToast({ type: "success", position: "bottom-right", message: "Esclusione rimossa", autoClose: 2000, toastId: "remove-exclude-success" });
        refetch();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Errore nella rimozione dell'esclusione";
        showToast({ type: "error", position: "bottom-right", message, toastId: "remove-exclude-error" });
      }
    },
    [chiusuraMensile, giorniEsclusiParsed, aggiornaGiorniEsclusi, refetch]
  );

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

  // Modalità nuova: loading durante auto-creazione o errore
  if (isNewMode) {
    if (!newAnno || !newMese) {
      return <Alert severity="error" sx={{ m: 2 }}>Parametri anno/mese mancanti.</Alert>;
    }
    if (autoCreateError) {
      return (
        <Box sx={{ p: 3 }}>
          <Alert severity="error" sx={{ mb: 2 }}>{autoCreateError}</Alert>
          <FormikToolbarButton startIcon={<ArrowBackIcon />} onClick={handleBack}>
            Torna alla lista
          </FormikToolbarButton>
        </Box>
      );
    }
    return (
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "50vh", gap: 2 }}>
        <CircularProgress />
        <Typography color="text.secondary">
          Creazione bozza per {dayjs().month(newMese - 1).format("MMMM")} {newAnno}...
        </Typography>
      </Box>
    );
  }

  if (loading) {
    return <CircularProgress />;
  }
  if (error) {
    return <Alert severity="error">Errore nel caricamento dei dettagli della chiusura: {error.message}</Alert>;
  }
  if (!chiusuraMensile) {
    return <Alert severity="warning">Chiusura non trovata.</Alert>;
  }

  const totaleVendite = (chiusuraMensile.totaleContantiCalcolato ?? 0) + (chiusuraMensile.totaleElettroniciCalcolato ?? 0);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "calc(100vh - 64px)" }}>
      {/* Toolbar */}
      <Box sx={{ borderBottom: 1, borderColor: "divider", bgcolor: "background.paper", flexShrink: 0 }}>
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

          <Box sx={{ display: "flex", alignItems: "center", height: 48, gap: 0.5, pr: 1 }}>
            {/* Badge giorni mancanti */}
            {isDraft && hasGiorniDaGestire && (
              <IconButton onClick={() => setGiorniMancantiModalOpen(true)} size="small">
                <Badge badgeContent={giorniEffettivamenteMancanti.length} color="error" invisible={!hasRegistriMancanti}>
                  <EventBusyIcon color={hasRegistriMancanti ? "error" : "action"} />
                </Badge>
              </IconButton>
            )}
            {chiusuraMensile && <MonthlyClosureReport closure={chiusuraMensile} />}
          </Box>
        </Toolbar>
      </Box>

      {/* Contenuto — scroll singolo */}
      <Box sx={{ flex: 1, overflow: "auto", minHeight: 0, px: 2, py: 2 }}>
        {/* Alert registri non riconciliati */}
        {registriNonRiconciliati.length > 0 && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {registriNonRiconciliati.length} registr{registriNonRiconciliati.length === 1 ? "o" : "i"} giornalier{registriNonRiconciliati.length === 1 ? "o" : "i"} non riconciliat
            {registriNonRiconciliati.length === 1 ? "o" : "i"}. La chiusura \u00E8 possibile, ma si consiglia la riconciliazione per maggiore accuratezza.
          </Alert>
        )}

        <Grid container spacing={2}>
          {/* Riepilogo compatto — metriche in strip */}
          <Grid item xs={12}>
            <Paper elevation={1} sx={{ p: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={6} sm={4} md={2}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Ricavo Netto</Typography>
                  <Typography variant="h5" fontWeight="bold" color="primary.main">
                    {`\u20AC ${chiusuraMensile.ricavoNettoCalcolato.toFixed(2)}`}
                  </Typography>
                </Grid>
                <Grid item xs={6} sm={4} md={2}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Totale Vendite</Typography>
                  <Typography variant="h6" fontWeight="bold" color="warning.main">
                    {`\u20AC ${totaleVendite.toFixed(2)}`}
                  </Typography>
                </Grid>
                <Grid item xs={6} sm={4} md={2}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Contanti</Typography>
                  <Typography variant="h6" fontWeight="bold" color="success.main">
                    {`\u20AC ${chiusuraMensile.totaleContantiCalcolato.toFixed(2)}`}
                  </Typography>
                </Grid>
                <Grid item xs={6} sm={4} md={2}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Elettronici</Typography>
                  <Typography variant="h6" fontWeight="bold" color="success.main">
                    {`\u20AC ${chiusuraMensile.totaleElettroniciCalcolato.toFixed(2)}`}
                  </Typography>
                </Grid>
                <Grid item xs={6} sm={4} md={2}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Fatture</Typography>
                  <Typography variant="h6" fontWeight="bold">
                    {`\u20AC ${chiusuraMensile.totaleFattureCalcolato.toFixed(2)}`}
                  </Typography>
                </Grid>
                <Grid item xs={6} sm={4} md={2}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Spese</Typography>
                  <Typography variant="h6" fontWeight="bold" color="error.main">
                    {`-\u20AC ${chiusuraMensile.speseAggiuntiveCalcolate.toFixed(2)}`}
                  </Typography>
                </Grid>
              </Grid>

              {/* Sub-dettaglio fiscale */}
              <Divider sx={{ my: 1.5 }} />
              <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                <Typography variant="body2" color="text.secondary">
                  Lordo: {`\u20AC ${chiusuraMensile.totaleLordoCalcolato.toFixed(2)}`}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Imponibile: {`\u20AC ${chiusuraMensile.totaleImponibileCalcolato.toFixed(2)}`}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  IVA: {`\u20AC ${chiusuraMensile.totaleIvaCalcolato.toFixed(2)}`}
                </Typography>
                {chiusuraMensile.totaleDifferenzeCassaCalcolato !== 0 && (
                  <Typography variant="body2" color={chiusuraMensile.totaleDifferenzeCassaCalcolato < 0 ? "error.main" : "success.main"}>
                    Differenze cassa: {`\u20AC ${chiusuraMensile.totaleDifferenzeCassaCalcolato.toFixed(2)}`}
                  </Typography>
                )}
                <Typography variant="body2" color="text.secondary">
                  {registriInclusi.length} registri inclusi
                  {giorniEsclusiParsed.length > 0 && ` \u00B7 ${giorniEsclusiParsed.length} giorni esclusi`}
                </Typography>
              </Box>
            </Paper>
          </Grid>

          {/* Registri Giornalieri Inclusi */}
          {registriInclusi.length > 0 && (
            <Grid item xs={12}>
              <Paper elevation={1} sx={{ p: 2 }}>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Registri Giornalieri ({registriInclusi.length})
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Data</TableCell>
                        <TableCell align="right">Vendite</TableCell>
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
                          <TableCell align="right">{`\u20AC ${(ri.registro.totaleVendite ?? 0).toFixed(2)}`}</TableCell>
                          <TableCell align="right">{`\u20AC ${(ri.registro.incassoContanteTracciato ?? 0).toFixed(2)}`}</TableCell>
                          <TableCell align="right">{`\u20AC ${(ri.registro.incassiElettronici ?? 0).toFixed(2)}`}</TableCell>
                          <TableCell align="right">{`\u20AC ${(ri.registro.incassiFattura ?? 0).toFixed(2)}`}</TableCell>
                          <TableCell align="right" sx={{ color: (ri.registro as { differenza?: number }).differenza !== 0 ? "error.main" : "inherit" }}>
                            {`\u20AC ${((ri.registro as { differenza?: number }).differenza ?? 0).toFixed(2)}`}
                          </TableCell>
                          <TableCell>
                            <Chip label={ri.registro.stato === "RECONCILED" ? "Riconciliato" : "Chiuso"} size="small" color={ri.registro.stato === "RECONCILED" ? "success" : "warning"} variant="outlined" />
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
          {chiusuraMensile.pagamentiInclusi.length > 0 && (
            <Grid item xs={12}>
              <Paper elevation={1} sx={{ p: 2 }}>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Pagamenti Fornitori ({chiusuraMensile.pagamentiInclusi.length})
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
                          <TableCell align="right">{`\u20AC ${pi.pagamento.importo.toFixed(2)}`}</TableCell>
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

          {/* Info chiusura */}
          {chiusuraMensile.stato !== "BOZZA" && chiusuraMensile.chiusaDaUtente && (
            <Grid item xs={12}>
              <Typography variant="body2" color="text.secondary">
                Chiusa da {chiusuraMensile.chiusaDaUtente.nomeUtente} il {dayjs(chiusuraMensile.chiusaIl).format("DD/MM/YYYY HH:mm")}
              </Typography>
            </Grid>
          )}

          {/* Note */}
          {chiusuraMensile.note && (
            <Grid item xs={12}>
              <Typography variant="body2">Note: {chiusuraMensile.note}</Typography>
            </Grid>
          )}
        </Grid>
      </Box>

      {/* Dialog: Gestione Giorni Mancanti ed Esclusi */}
      <Dialog open={giorniMancantiModalOpen} onClose={() => setGiorniMancantiModalOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Gestione Giorni</DialogTitle>
        <DialogContent dividers>
          {/* Giorni mancanti da escludere */}
          {esclusioniLocali.length > 0 && (
            <Box sx={{ mb: giorniEsclusiParsed.length > 0 ? 3 : 0 }}>
              <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
                Giorni Mancanti da Escludere ({esclusioniLocali.length})
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={esclusioniLocali.length > 0 && esclusioniLocali.every((e) => e.selected)}
                          indeterminate={esclusioniLocali.some((e) => e.selected) && !esclusioniLocali.every((e) => e.selected)}
                          onChange={(e) => setEsclusioniLocali((prev) => prev.map((el) => ({ ...el, selected: e.target.checked })))}
                        />
                      </TableCell>
                      <TableCell>Data</TableCell>
                      <TableCell>Motivo</TableCell>
                      <TableCell>Note</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {esclusioniLocali.map((esclusione, idx) => (
                      <TableRow key={esclusione.data}>
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={esclusione.selected}
                            onChange={(e) =>
                              setEsclusioniLocali((prev) => prev.map((el, i) => (i === idx ? { ...el, selected: e.target.checked } : el)))
                            }
                          />
                        </TableCell>
                        <TableCell>
                          {dayjs(esclusione.data).format("DD/MM/YYYY")} ({dayjs(esclusione.data).format("dddd")})
                        </TableCell>
                        <TableCell>
                          <Select
                            size="small"
                            value={esclusione.codiceMotivo}
                            onChange={(e) =>
                              setEsclusioniLocali((prev) =>
                                prev.map((el, i) => (i === idx ? { ...el, codiceMotivo: e.target.value as CodiceMotivo } : el))
                              )
                            }
                            sx={{ minWidth: 200 }}
                          >
                            <MenuItem value="ATTIVITA_NON_AVVIATA">{MOTIVO_LABELS.ATTIVITA_NON_AVVIATA}</MenuItem>
                            <MenuItem value="CHIUSURA_PROGRAMMATA">{MOTIVO_LABELS.CHIUSURA_PROGRAMMATA}</MenuItem>
                            <MenuItem value="EVENTO_ECCEZIONALE">{MOTIVO_LABELS.EVENTO_ECCEZIONALE}</MenuItem>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            placeholder="Note (facoltativo)"
                            value={esclusione.note}
                            onChange={(e) =>
                              setEsclusioniLocali((prev) =>
                                prev.map((el, i) => (i === idx ? { ...el, note: e.target.value.slice(0, 200) } : el))
                              )
                            }
                            inputProps={{ maxLength: 200 }}
                            sx={{ minWidth: 200 }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <Box sx={{ mt: 1.5, display: "flex", justifyContent: "flex-end" }}>
                <Button
                  variant="contained"
                  disabled={isMutating || !esclusioniLocali.some((e) => e.selected)}
                  onClick={handleEscludiSelezionati}
                >
                  {excludeLoading ? <CircularProgress size={20} /> : `Escludi Selezionati (${esclusioniLocali.filter((e) => e.selected).length})`}
                </Button>
              </Box>
            </Box>
          )}

          {/* Separatore */}
          {esclusioniLocali.length > 0 && giorniEsclusiParsed.length > 0 && <Divider sx={{ mb: 2 }} />}

          {/* Giorni già esclusi */}
          {giorniEsclusiParsed.length > 0 && (
            <Box>
              <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
                Giorni Già Esclusi ({giorniEsclusiParsed.length})
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Data</TableCell>
                      <TableCell>Motivo</TableCell>
                      <TableCell>Note</TableCell>
                      <TableCell>Data Esclusione</TableCell>
                      {isDraft && <TableCell align="center">Azioni</TableCell>}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {giorniEsclusiParsed.map((ge) => (
                      <TableRow key={ge.data}>
                        <TableCell>
                          {dayjs(ge.data).format("DD/MM/YYYY")} ({dayjs(ge.data).format("dddd")})
                        </TableCell>
                        <TableCell>{MOTIVO_LABELS[ge.codiceMotivo] || ge.codiceMotivo}</TableCell>
                        <TableCell>{ge.note || "-"}</TableCell>
                        <TableCell>{dayjs(ge.dataEsclusione).format("DD/MM/YYYY HH:mm")}</TableCell>
                        {isDraft && (
                          <TableCell align="center">
                            <IconButton
                              size="small"
                              color="error"
                              disabled={isMutating}
                              onClick={() => handleRimuoviEsclusione(dayjs(ge.data).format("YYYY-MM-DD"))}
                            >
                              <RemoveCircleOutlineIcon />
                            </IconButton>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {/* Nessun giorno da gestire */}
          {esclusioniLocali.length === 0 && giorniEsclusiParsed.length === 0 && (
            <Typography color="text.secondary">Nessun giorno mancante o escluso.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGiorniMancantiModalOpen(false)}>Chiudi</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MonthlyClosureDetails;
