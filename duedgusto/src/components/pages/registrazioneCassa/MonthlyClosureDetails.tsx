import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import useAutoCreaChiusura from "./useAutoCreaChiusura";
import useGiorniEsclusi from "./useGiorniEsclusi";
import { useParams, useNavigate, useSearchParams } from "react-router";
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Paper,
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
  Stack,
} from "@mui/material";
import AppDialog from "../../common/dialog/AppDialog";
import DeleteIcon from "@mui/icons-material/Delete";
import LockIcon from "@mui/icons-material/Lock";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import EventBusyIcon from "@mui/icons-material/EventBusy";
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
  mutationAggiungiPagamentoFornitoreInChiusura,
  mutationModificaPagamentoFornitoreInChiusura,
  mutationEliminaPagamentoFornitoreInChiusura,
  PagamentoDocumentoChiusuraInput,
} from "../../../graphql/chiusureMensili/mutations";
import PageTitleContext from "../../layout/headerBar/PageTitleContext";
import { statoRegistroCassa, statoChiusuraMensile } from "../../../common/globals/constants";
import FormikToolbarButton from "../../common/form/toolbar/FormikToolbarButton";
import useConfirm from "../../common/confirm/useConfirm";
import showToast from "../../../common/toast/showToast";
import SpeseDataGrid, { SpeseDataGridPersistence, SpeseGridRow } from "./SpeseDataGrid";
import MonthlyClosureReport from "./MonthlyClosureReport";
import KPICard from "../../common/KPICard";
import useChartPalette from "./dashboard/useChartPalette";
import { MESI_LABEL } from "./dashboard/dashboardUtils";
import { aggregaRegistriPerMese } from "../../../common/registroCassa/aggregaRegistri";
import { parseDateForGraphQL } from "../../../common/date/date";

const MOTIVO_LABELS: Record<CodiceMotivo, string> = {
  ATTIVITA_NON_AVVIATA: "Attività non avviata",
  CHIUSURA_PROGRAMMATA: "Chiusura programmata",
  EVENTO_ECCEZIONALE: "Evento eccezionale",
};

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
  const [aggiungiPagamentoInChiusura] = useMutation(mutationAggiungiPagamentoFornitoreInChiusura);
  const [modificaPagamentoInChiusura] = useMutation(mutationModificaPagamentoFornitoreInChiusura);
  const [eliminaPagamentoInChiusura] = useMutation(mutationEliminaPagamentoFornitoreInChiusura);
  const [chiudiChiusura, { loading: closeLoading }] = useMutation(mutationChiudiChiusuraMensile);
  const [eliminaChiusura, { loading: deleteLoading }] = useMutation(mutationEliminaChiusuraMensile);
  const [aggiornaGiorniEsclusi, { loading: excludeLoading }] = useMutation(mutationAggiornaGiorniEsclusi);

  const palette = useChartPalette();
  const [giorniMancantiModalOpen, setGiorniMancantiModalOpen] = useState(false);

  const anno = chiusuraMensile?.anno ?? newAnno;
  const mese = chiusuraMensile?.mese ?? newMese;
  const isMutating = createLoading || addExpenseLoading || closeLoading || deleteLoading || excludeLoading;
  const isDraft = isNewMode || chiusuraMensile?.stato === statoChiusuraMensile.BOZZA;
  const isReadOnly = !isDraft;

  const registriInclusi = useMemo(() => chiusuraMensile?.registriInclusi ?? [], [chiusuraMensile?.registriInclusi]);
  const registriNonRiconciliati = useMemo(() => registriInclusi.filter((ri) => ri.registro.stato === statoRegistroCassa.CLOSED), [registriInclusi]);

  const { giorniMancanti } = useQueryValidaCompletezzaRegistri({
    anno,
    mese,
    skip: !anno || !mese || !isDraft,
  });

  // Derivazioni giorni esclusi/mancanti + stato locale delle esclusioni (hook estratto)
  const { giorniEsclusiParsed, giorniEffettivamenteMancanti, hasRegistriMancanti, hasGiorniDaGestire, esclusioniLocali, setEsclusioniLocali } = useGiorniEsclusi({
    chiusuraMensile,
    giorniMancanti,
  });

  useEffect(() => {
    if (anno && mese) {
      setTitle(`Chiusura Mensile - ${MESI_LABEL[mese - 1]} ${anno}`);
    } else {
      setTitle("Dettagli Chiusura Mensile");
    }
  }, [anno, mese, setTitle]);

  // Auto-creazione bozza in modalità nuova (hook estratto)
  const { autoCreateError } = useAutoCreaChiusura({
    isNewMode,
    anno: newAnno,
    mese: newMese,
    creaChiusura,
    navigate,
  });

  // Primo giorno del mese: default per le nuove righe e per la dataPagamento
  // dei pagamenti registrati dalla chiusura (deve appartenere al mese).
  const defaultDate = useMemo(() => (anno && mese ? dayjs(new Date(anno, mese - 1, 1)).format("YYYY-MM-DD") : dayjs().format("YYYY-MM-DD")), [anno, mese]);

  // KPI gestionali: aggregazione con le stesse formule della Vista mensile,
  // applicata ai SOLI registri effettivamente inclusi nella chiusura.
  const meseAggregato = useMemo(() => {
    const registri = registriInclusi.filter((ri) => ri.incluso).map((ri) => ri.registro);
    const mesi = aggregaRegistriPerMese(registri, anno || dayjs().year());
    const indice = (mese || 1) - 1;
    return mesi[indice] ?? mesi[0];
  }, [registriInclusi, anno, mese]);

  // Righe della griglia spese: spese libere + pagamenti fornitori inclusi.
  const gridExpenses = useMemo<SpeseGridRow[]>(() => {
    if (!chiusuraMensile) return [];
    const speseLibereRows: SpeseGridRow[] = chiusuraMensile.speseLibere.map((s) => ({
      spesaId: s.spesaId,
      description: s.descrizione,
      amount: s.importo,
      categoria: s.categoria,
      data: s.data ? dayjs(s.data).format("YYYY-MM-DD") : undefined,
      isPagamentoFornitore: false,
    }));
    const pagamentiRows: SpeseGridRow[] = chiusuraMensile.pagamentiInclusi
      .filter((pi) => pi.inclusoInChiusura)
      .map((pi) => {
        const p = pi.pagamento;
        const documentType: "FA" | "DDT" = p.fatturaId != null ? "FA" : "DDT";
        return {
          pagamentoId: p.pagamentoId,
          isPagamentoFornitore: true,
          description: p.note || `Pagamento fornitore ${documentType}`,
          amount: p.importo,
          data: p.dataPagamento ? dayjs(p.dataPagamento).format("YYYY-MM-DD") : undefined,
          documentType,
          fatturaId: p.fatturaId ?? undefined,
          ddtId: p.ddtId ?? undefined,
          paymentMethod: p.metodoPagamento ?? undefined,
          registroCassaId: p.registroCassaId,
        };
      });
    return [...pagamentiRows, ...speseLibereRows];
  }, [chiusuraMensile]);

  // Persistenza per-riga: ogni operazione persiste e poi refetch per aggiornare
  // headline/KPI (i campi calcolati backend includono già le novità).
  const persistence = useMemo<SpeseDataGridPersistence | undefined>(() => {
    if (!chiusuraMensile) return undefined;
    const chiusuraIdCorrente = chiusuraMensile.chiusuraId;
    return {
      createExpense: async (row) => {
        const res = await aggiungiSpesaLibera({
          variables: {
            chiusuraId: chiusuraIdCorrente,
            descrizione: row.description,
            importo: row.amount,
            categoria: row.categoria ?? "Altro",
            data: parseDateForGraphQL(row.data ?? defaultDate) ?? null,
          },
        });
        await refetch();
        return res.data?.chiusureMensili.aggiungiSpesaLibera?.spesaId ?? null;
      },
      updateExpense: async (row) => {
        if ((row.spesaId ?? 0) <= 0) return;
        await modificaSpesaLibera({
          variables: {
            spesaId: row.spesaId as number,
            descrizione: row.description,
            importo: row.amount,
            categoria: row.categoria ?? "Altro",
            data: parseDateForGraphQL(row.data ?? defaultDate) ?? null,
          },
        });
        await refetch();
      },
      deleteExpense: async (row) => {
        if ((row.spesaId ?? 0) <= 0) return;
        await eliminaSpesaLiberaMutation({ variables: { spesaId: row.spesaId as number } });
        await refetch();
      },
      createSupplierPayment: async (row) => {
        if (!row.fornitoreId) return null;
        const input: PagamentoDocumentoChiusuraInput = {
          fornitoreId: row.fornitoreId,
          tipoDocumento: row.documentType ?? "DDT",
          numeroDocumento: (row.documentType === "FA" ? row.invoiceNumber : row.ddtNumber) ?? null,
          dataPagamento: parseDateForGraphQL(row.data ?? defaultDate) ?? (parseDateForGraphQL(defaultDate) as string),
          importo: row.amount,
          aliquotaIva: row.aliquotaIva ?? null,
          metodoPagamento: row.paymentMethod ?? null,
          fatturaId: row.fatturaId ?? null,
          ddtId: row.ddtId ?? null,
        };
        const res = await aggiungiPagamentoInChiusura({ variables: { chiusuraId: chiusuraIdCorrente, input } });
        await refetch();
        return res.data?.chiusureMensili.aggiungiPagamentoFornitoreInChiusura?.pagamentoId ?? null;
      },
      updateSupplierPayment: async (row) => {
        if (row.pagamentoId == null) return;
        await modificaPagamentoInChiusura({
          variables: {
            pagamentoId: row.pagamentoId,
            importo: row.amount,
            dataPagamento: parseDateForGraphQL(row.data ?? defaultDate) ?? null,
            metodoPagamento: row.paymentMethod ?? null,
            aliquotaIva: row.aliquotaIva ?? null,
          },
        });
        await refetch();
      },
      deleteSupplierPayment: async (row) => {
        if (row.pagamentoId == null) return;
        await eliminaPagamentoInChiusura({ variables: { pagamentoId: row.pagamentoId } });
        await refetch();
      },
    };
  }, [
    chiusuraMensile,
    defaultDate,
    aggiungiSpesaLibera,
    modificaSpesaLibera,
    eliminaSpesaLiberaMutation,
    aggiungiPagamentoInChiusura,
    modificaPagamentoInChiusura,
    eliminaPagamentoInChiusura,
    refetch,
  ]);

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
      // Le spese/pagamenti sono già persistiti per-riga: qui basta chiudere il mese.
      await chiudiChiusura({ variables: { chiusuraId: chiusuraMensile.chiusuraId } });
      showToast({ type: "success", position: "bottom-right", message: "Mese chiuso con successo", autoClose: 2000, toastId: "close-success" });
      refetch();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Errore nella chiusura del mese";
      showToast({ type: "error", position: "bottom-right", message, toastId: "close-error" });
    }
  }, [chiusuraMensile, onConfirm, chiudiChiusura, refetch]);

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
      navigate("/gestionale/cassa/chiusura-mensile");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Errore nell'eliminazione";
      showToast({ type: "error", position: "bottom-right", message, toastId: "delete-error" });
    }
  }, [chiusuraMensile, onConfirm, eliminaChiusura, navigate]);

  const handleBack = useCallback(() => {
    navigate("/gestionale/cassa/chiusura-mensile");
  }, [navigate]);

  // Modalità nuova: loading durante auto-creazione o errore
  if (isNewMode) {
    if (!newAnno || !newMese) {
      return (
        <Alert
          severity="error"
          sx={{ m: 2 }}
        >
          Parametri anno/mese mancanti.
        </Alert>
      );
    }
    if (autoCreateError) {
      return (
        <Box sx={{ p: 3 }}>
          <Alert
            severity="error"
            sx={{ mb: 2 }}
          >
            {autoCreateError}
          </Alert>
          <FormikToolbarButton
            startIcon={<ArrowBackIcon />}
            onClick={handleBack}
          >
            Torna alla lista
          </FormikToolbarButton>
        </Box>
      );
    }
    return (
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "50vh", gap: 2 }}>
        <CircularProgress />
        <Typography color="text.secondary">
          Creazione bozza per{" "}
          {dayjs()
            .month(newMese - 1)
            .format("MMMM")}{" "}
          {newAnno}...
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

  const differenzaGestionale = chiusuraMensile.differenzaCalcolata ?? 0;
  const kpiBanda: { label: string; value: number; negative?: boolean }[] = [
    { label: "Totale Vendite", value: meseAggregato?.totaleVendite ?? 0 },
    { label: "Totale Spese", value: chiusuraMensile.totaleSpeseCalcolato ?? 0, negative: true },
    { label: "Ricavo tracciato", value: meseAggregato?.ricavoTracciato ?? 0 },
    { label: "Ricavo non tracc.", value: meseAggregato?.ricavoNonTracciato ?? 0 },
    { label: "Spese tracciate", value: meseAggregato?.speseTracciate ?? 0, negative: true },
    { label: "Spese non tracc.", value: meseAggregato?.speseNonTracciate ?? 0, negative: true },
  ];

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "calc(100dvh - 64px)" }}>
      {/* Toolbar */}
      <Box sx={{ borderBottom: 1, borderColor: "divider", bgcolor: "background.paper", flexShrink: 0 }}>
        <Toolbar
          variant="dense"
          disableGutters
          sx={{ minHeight: 48, height: 48, display: "flex", justifyContent: "space-between" }}
        >
          <Box sx={{ height: 48, display: "flex", alignItems: "stretch" }}>
            <FormikToolbarButton
              startIcon={<ArrowBackIcon />}
              onClick={handleBack}
            >
              Indietro
            </FormikToolbarButton>

            {isDraft && !isNewMode && (
              <FormikToolbarButton
                startIcon={<LockIcon />}
                disabled={isMutating || hasRegistriMancanti}
                onClick={handleChiudiMese}
              >
                Chiudi Mese
              </FormikToolbarButton>
            )}

            {isDraft && !isNewMode && (
              <FormikToolbarButton
                startIcon={<DeleteIcon />}
                color="error"
                disabled={isMutating}
                onClick={handleElimina}
              >
                Elimina
              </FormikToolbarButton>
            )}
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", height: 48, gap: 0.5, pr: 1 }}>
            {/* Badge giorni mancanti */}
            {isDraft && hasGiorniDaGestire && (
              <IconButton
                onClick={() => setGiorniMancantiModalOpen(true)}
                size="small"
                aria-label="Mostra giorni mancanti"
              >
                <Badge
                  badgeContent={giorniEffettivamenteMancanti.length}
                  color="error"
                  invisible={!hasRegistriMancanti}
                >
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
        {/* Alert giorni mancanti \u2014 bloccano la chiusura */}
        {isDraft && hasRegistriMancanti && (
          <Alert
            severity="error"
            sx={{ mb: 2 }}
            action={
              <Button
                color="inherit"
                size="small"
                onClick={() => setGiorniMancantiModalOpen(true)}
              >
                Gestisci
              </Button>
            }
          >
            {giorniEffettivamenteMancanti.length === 1
              ? "Manca il registro di 1 giornata operativa"
              : `Mancano i registri di ${giorniEffettivamenteMancanti.length} giornate operative`}
            : {giorniEffettivamenteMancanti.map((d) => dayjs(d).format("DD/MM")).join(", ")}. Chiudi quei giorni oppure escludili per poter chiudere il mese.
          </Alert>
        )}

        {/* Alert registri non riconciliati \u2014 informativo, non blocca la chiusura */}
        {registriNonRiconciliati.length > 0 && (
          <Alert
            severity="info"
            sx={{ mb: 2 }}
          >
            {registriNonRiconciliati.length === 1
              ? "1 giornata \u00E8 chiusa ma non ancora riconciliata"
              : `${registriNonRiconciliati.length} giornate sono chiuse ma non ancora riconciliate`}{" "}
            (verificate col contante effettivo). Puoi chiudere il mese comunque; riconciliarle prima rende i totali pi\u00F9 affidabili.
          </Alert>
        )}

        <div className="grid grid-cols-12 gap-4">
          {/* KPI gestionali (stile Vista mensile) - Differenza in hero + banda a 6 */}
          <div className="col-span-12">
            <Paper
              variant="outlined"
              sx={{ p: 2.5 }}
            >
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1, mb: 2 }}>
                <Typography
                  variant="subtitle1"
                  fontWeight={600}
                >
                  {`KPI gestionali · ${MESI_LABEL[(mese || 1) - 1]} ${anno}`}
                </Typography>
                <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
                  <Chip
                    label={`${registriInclusi.length} registri inclusi`}
                    size="small"
                    variant="outlined"
                  />
                  {giorniEsclusiParsed.length > 0 && (
                    <Chip
                      label={`${giorniEsclusiParsed.length} giorni esclusi`}
                      size="small"
                      variant="outlined"
                    />
                  )}
                </Box>
              </Box>
              <Box sx={{ display: "flex", gap: 2.5, flexWrap: "wrap", alignItems: "stretch" }}>
                {/* Hero: la Differenza e' l'unico numero grande della pagina */}
                <Box sx={{ flex: "1 1 300px", maxWidth: { md: 380 } }}>
                  <KPICard
                    variant="hero"
                    label="Differenza"
                    value={differenzaGestionale}
                    color={differenzaGestionale >= 0 ? palette.netto : palette.spese}
                  />
                </Box>
                {/* Banda a 6 KPI gestionali */}
                <Box sx={{ flex: "2 1 380px", display: "flex", flexWrap: "wrap", gap: { xs: 1, sm: 1.5 }, alignItems: "stretch" }}>
                  {kpiBanda.map((kpi) => (
                    <KPICard
                      key={kpi.label}
                      label={kpi.label}
                      value={kpi.value}
                      negative={kpi.negative}
                    />
                  ))}
                </Box>
              </Box>
            </Paper>
          </div>

          {/* Registri Giornalieri Inclusi */}
          {registriInclusi.length > 0 && (
            <div className="col-span-12">
              <Paper
                elevation={1}
                sx={{ p: 2 }}
              >
                <Typography
                  variant="subtitle1"
                  fontWeight="bold"
                  gutterBottom
                >
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
                          <TableCell
                            align="right"
                            sx={{ color: (ri.registro as { differenza?: number }).differenza !== 0 ? "error.main" : "inherit" }}
                          >
                            {`\u20AC ${((ri.registro as { differenza?: number }).differenza ?? 0).toFixed(2)}`}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={ri.registro.stato === statoRegistroCassa.RECONCILED ? "Riconciliato" : "Chiuso"}
                              size="small"
                              color={ri.registro.stato === statoRegistroCassa.RECONCILED ? "success" : "warning"}
                              variant="outlined"
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </div>
          )}

          {/* Spese e pagamenti fornitori (griglia unificata in stile cassa) */}
          <div className="col-span-12">
            <SpeseDataGrid
              initialExpenses={gridExpenses}
              isLocked={isReadOnly}
              date={defaultDate}
              columns={{ showData: true, showCategoria: true, categoriaOptions: ["Affitto", "Utenze", "Stipendi", "Altro"], showGiornale: false }}
              persistence={isReadOnly ? undefined : persistence}
            />
          </div>

          {/* Info chiusura */}
          {chiusuraMensile.stato !== statoChiusuraMensile.BOZZA && chiusuraMensile.chiusaDaUtente && (
            <div className="col-span-12">
              <Typography
                variant="body2"
                color="text.secondary"
              >
                Chiusa da {chiusuraMensile.chiusaDaUtente.nomeUtente} il {dayjs(chiusuraMensile.chiusaIl).format("DD/MM/YYYY HH:mm")}
              </Typography>
            </div>
          )}

          {/* Note */}
          {chiusuraMensile.note && (
            <div className="col-span-12">
              <Typography variant="body2">Note: {chiusuraMensile.note}</Typography>
            </div>
          )}
        </div>
      </Box>

      {/* Dialog: Gestione Giorni Mancanti ed Esclusi */}
      <AppDialog
        open={giorniMancantiModalOpen}
        onClose={() => setGiorniMancantiModalOpen(false)}
        title="Gestione Giorni"
        maxWidth="900px"
        width={{ xs: "95%", sm: "90%", md: "900px" }}
        footer={
          <Stack
            direction="row"
            spacing={1}
            justifyContent="flex-end"
          >
            <Button
              variant="outlined"
              size="small"
              onClick={() => setGiorniMancantiModalOpen(false)}
            >
              Chiudi
            </Button>
          </Stack>
        }
      >
          {/* Giorni mancanti da escludere */}
          {esclusioniLocali.length > 0 && (
            <Box sx={{ mb: giorniEsclusiParsed.length > 0 ? 3 : 0 }}>
              <Typography
                variant="subtitle1"
                fontWeight="bold"
                sx={{ mb: 1 }}
              >
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
                            onChange={(e) => setEsclusioniLocali((prev) => prev.map((el, i) => (i === idx ? { ...el, selected: e.target.checked } : el)))}
                          />
                        </TableCell>
                        <TableCell>
                          {dayjs(esclusione.data).format("DD/MM/YYYY")} ({dayjs(esclusione.data).format("dddd")})
                        </TableCell>
                        <TableCell>
                          <Select
                            size="small"
                            value={esclusione.codiceMotivo}
                            onChange={(e) => setEsclusioniLocali((prev) => prev.map((el, i) => (i === idx ? { ...el, codiceMotivo: e.target.value as CodiceMotivo } : el)))}
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
                            onChange={(e) => setEsclusioniLocali((prev) => prev.map((el, i) => (i === idx ? { ...el, note: e.target.value.slice(0, 200) } : el)))}
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
              <Typography
                variant="subtitle1"
                fontWeight="bold"
                sx={{ mb: 1 }}
              >
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
                              aria-label="Rimuovi esclusione"
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
          {esclusioniLocali.length === 0 && giorniEsclusiParsed.length === 0 && <Typography color="text.secondary">Nessun giorno mancante o escluso.</Typography>}
      </AppDialog>
    </Box>
  );
};

export default MonthlyClosureDetails;
