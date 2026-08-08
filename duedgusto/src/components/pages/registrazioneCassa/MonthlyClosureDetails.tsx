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
  Collapse,
} from "@mui/material";
import AppDialog from "../../common/dialog/AppDialog";
import DeleteIcon from "@mui/icons-material/Delete";
import LockIcon from "@mui/icons-material/Lock";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import EventBusyIcon from "@mui/icons-material/EventBusy";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { useMutation } from "@apollo/client";
import dayjs from "dayjs";

import { useQueryChiusuraMensile, useQueryValidaCompletezzaRegistri } from "../../../graphql/chiusureMensili/queries";
import {
  mutationCreaChiusuraMensile,
  mutationChiudiChiusuraMensile,
  mutationEliminaChiusuraMensile,
  mutationAggiornaGiorniEsclusi,
} from "../../../graphql/chiusureMensili/mutations";
import PageTitleContext from "../../layout/headerBar/PageTitleContext";
import { statoRegistroCassa, statoChiusuraMensile } from "../../../common/globals/constants";
import FormikToolbarButton from "../../common/form/toolbar/FormikToolbarButton";
import useConfirm from "../../common/confirm/useConfirm";
import showToast from "../../../common/toast/showToast";
import MonthlyClosureReport from "./MonthlyClosureReport";
import KPICard from "../../common/KPICard";
import useChartPalette from "./dashboard/useChartPalette";
import { MESI_LABEL } from "./dashboard/dashboardUtils";
import formatCurrency from "../../../common/bones/formatCurrency";
import { aggregaRegistriPerMese } from "../../../common/registroCassa/aggregaRegistri";
import SpeseDataGrid, { METODO_CONTANTI, SpeseDataGridPersistence, SpeseGridRow } from "./SpeseDataGrid";
import buildSpeseFisseRows, { CATEGORIE_FISSE } from "./buildSpeseFisseRows";
import { mutationMutateSpesaCassa, mutationEliminaSpesaCassa } from "../../../graphql/registroCassa/mutations";
import { mutationMutatePagamentoFornitore, mutationDeletePagamentoFornitore } from "../../../graphql/fornitori/mutations";
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
  const [chiudiChiusura, { loading: closeLoading }] = useMutation(mutationChiudiChiusuraMensile);
  const [eliminaChiusura, { loading: deleteLoading }] = useMutation(mutationEliminaChiusuraMensile);
  const [aggiornaGiorniEsclusi, { loading: excludeLoading }] = useMutation(mutationAggiornaGiorniEsclusi);
  const [mutateSpesaCassa] = useMutation(mutationMutateSpesaCassa);
  const [eliminaSpesaCassa] = useMutation(mutationEliminaSpesaCassa);
  const [mutatePagamentoFornitore] = useMutation(mutationMutatePagamentoFornitore);
  const [eliminaPagamentoFornitore] = useMutation(mutationDeletePagamentoFornitore);

  const palette = useChartPalette();
  const [giorniMancantiModalOpen, setGiorniMancantiModalOpen] = useState(false);
  const [registriEspansi, setRegistriEspansi] = useState(true);

  const anno = chiusuraMensile?.anno ?? newAnno;
  const mese = chiusuraMensile?.mese ?? newMese;
  const isMutating = createLoading || closeLoading || deleteLoading || excludeLoading;
  const isDraft = isNewMode || chiusuraMensile?.stato === statoChiusuraMensile.BOZZA;

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

  // KPI gestionali: aggregazione con le stesse formule della Vista mensile,
  // applicata ai SOLI registri effettivamente inclusi nella chiusura.
  const meseAggregato = useMemo(() => {
    const registri = registriInclusi.filter((ri) => ri.incluso).map((ri) => ri.registro);
    const mesi = aggregaRegistriPerMese(registri, anno || dayjs().year());
    const indice = (mese || 1) - 1;
    return mesi[indice] ?? mesi[0];
  }, [registriInclusi, anno, mese]);

  // ── Griglia spese fisse del mese ────────────────────────────────────────────
  // Le righe restano di proprietà dei registri giornalieri: la chiusura le aggrega
  // e basta. Il metodo di pagamento decide su quale delle due forme finisce la riga.
  const gridSpeseFisse = useMemo(() => buildSpeseFisseRows(registriInclusi), [registriInclusi]);

  // Data di default: l'ultimo registro GIÀ incluso del mese. Così il flusso tipico
  // ("metti la spesa a fine mese") non crea registri leggeri su giorni scoperti, che
  // resterebbero fra i giorni mancanti e non sarebbero più escludibili.
  const dataDefaultSpese = useMemo(() => {
    const ordinati = registriInclusi
      .filter((ri) => ri.incluso)
      .map((ri) => dayjs(ri.registro.data))
      .sort((a, b) => a.valueOf() - b.valueOf());
    const ultimo = ordinati.length > 0 ? ordinati[ordinati.length - 1] : null;
    return (ultimo ?? dayjs(new Date(anno || dayjs().year(), (mese || 1) - 1, 1))).format("YYYY-MM-DD");
  }, [registriInclusi, anno, mese]);

  const persistenceSpese = useMemo<SpeseDataGridPersistence | undefined>(() => {
    if (!chiusuraMensile) return undefined;

    const dataRiga = (row: SpeseGridRow) => row.data ?? dataDefaultSpese;

    // Una data fuori dal mese sposterebbe silenziosamente denaro su un'altra chiusura:
    // mutatePagamentoFornitore non applica il guard sul mese, quindi si presidia qui.
    const dataNelMese = (row: SpeseGridRow) => {
      const d = dayjs(dataRiga(row));
      return d.year() === chiusuraMensile.anno && d.month() + 1 === chiusuraMensile.mese;
    };

    const errore = (message: string) => {
      showToast({ type: "error", position: "bottom-right", message, toastId: "spese-fisse-error" });
    };

    const esegui = async <T,>(azione: () => Promise<T>): Promise<T | undefined> => {
      try {
        return await azione();
      } catch (err: unknown) {
        errore(err instanceof Error ? err.message : "Errore nel salvataggio della spesa");
        await refetch();
        return undefined;
      }
    };

    const isTracciata = (row: SpeseGridRow) => (row.paymentMethod ?? METODO_CONTANTI) !== METODO_CONTANTI;

    const salvaSpesaContanti = async (row: SpeseGridRow) => {
      const res = await mutateSpesaCassa({
        variables: {
          spesa: {
            spesaId: (row.spesaId ?? 0) > 0 ? row.spesaId : null,
            data: parseDateForGraphQL(dataRiga(row)) ?? dataRiga(row),
            descrizione: row.description,
            importo: row.amount,
            categoria: row.categoria ?? "Utenze",
          },
        },
      });
      return res.data?.gestioneCassa.mutateSpesaCassa?.id ?? null;
    };

    // Spesa fissa tracciata = pagamento SENZA documento (fatturaId/ddtId null) con
    // categoria valorizzata. Nessuna fattura finta per stipendi e affitto.
    const salvaPagamentoTracciato = async (row: SpeseGridRow) => {
      const res = await mutatePagamentoFornitore({
        variables: {
          pagamento: {
            pagamentoId: (row.pagamentoId ?? 0) > 0 ? row.pagamentoId : undefined,
            fatturaId: row.fatturaId ?? undefined,
            ddtId: row.ddtId ?? undefined,
            dataPagamento: parseDateForGraphQL(dataRiga(row)) ?? dataRiga(row),
            importo: row.amount,
            metodoPagamento: row.paymentMethod ?? "Bonifico",
            note: row.description,
            categoria: row.categoria ?? "Utenze",
          },
        },
      });
      return res.data?.fornitori.mutatePagamentoFornitore?.pagamentoId ?? null;
    };

    // Cambiare metodo su una riga già salvata ne cambia la natura: si elimina la
    // vecchia forma e si ricrea nell'altra.
    const salvaRiga = async (row: SpeseGridRow) => {
      if (!dataNelMese(row)) {
        errore("La data deve cadere nel mese della chiusura.");
        await refetch();
        return null;
      }

      const tracciata = isTracciata(row);
      const eraSpesa = (row.spesaId ?? 0) > 0;
      const eraPagamento = (row.pagamentoId ?? 0) > 0;

      if (tracciata && eraSpesa) {
        await eliminaSpesaCassa({ variables: { spesaId: row.spesaId! } });
        row.spesaId = undefined;
      } else if (!tracciata && eraPagamento) {
        await eliminaPagamentoFornitore({ variables: { pagamentoId: row.pagamentoId! } });
        row.pagamentoId = undefined;
      }

      row.isPagamentoFornitore = tracciata;
      const nuovoId = tracciata ? await salvaPagamentoTracciato(row) : await salvaSpesaContanti(row);
      await refetch();
      return nuovoId;
    };

    const eliminaRiga = async (row: SpeseGridRow) => {
      if ((row.pagamentoId ?? 0) > 0) {
        await eliminaPagamentoFornitore({ variables: { pagamentoId: row.pagamentoId! } });
      } else if ((row.spesaId ?? 0) > 0) {
        await eliminaSpesaCassa({ variables: { spesaId: row.spesaId! } });
      }
      await refetch();
    };

    // La griglia in questa modalità instrada tutto su create/update/deleteExpense:
    // le tre callback "supplier" restano per il contratto e coprono il dialog fattura.
    return {
      createExpense: (row) => esegui(() => salvaRiga(row)),
      updateExpense: async (row) => { await esegui(() => salvaRiga(row)); },
      deleteExpense: async (row) => { await esegui(() => eliminaRiga(row)); },
      createSupplierPayment: (row) => esegui(() => salvaRiga(row)),
      updateSupplierPayment: async (row) => { await esegui(() => salvaRiga(row)); },
      deleteSupplierPayment: async (row) => { await esegui(() => eliminaRiga(row)); },
    };
  }, [chiusuraMensile, dataDefaultSpese, refetch, mutateSpesaCassa, eliminaSpesaCassa,
      mutatePagamentoFornitore, eliminaPagamentoFornitore]);

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

  // Chiusura = pura aggregazione dei soli registri inclusi: tutte le differenze
  // derivano da `meseAggregato` (aggregaRegistriPerMese), nessun KPI di chiusura.
  // Le tre differenze quadrano: totale = tracciata + non tracciata.
  const differenzaGestionale = meseAggregato?.differenza ?? 0;
  const differenzaNonTracciata = (meseAggregato?.ricavoNonTracciato ?? 0) - (meseAggregato?.speseNonTracciate ?? 0);
  const differenzaTracciata = differenzaGestionale - differenzaNonTracciata;
  const kpiBanda: { label: string; value: number; negative?: boolean }[] = [
    { label: "Totale Vendite", value: meseAggregato?.totaleVendite ?? 0 },
    { label: "Totale Spese", value: meseAggregato?.totaleSpese ?? 0, negative: true },
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
        {/* Alert giorni mancanti — bloccano la chiusura */}
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

        {/* Alert registri non riconciliati — informativo, non blocca la chiusura */}
        {registriNonRiconciliati.length > 0 && (
          <Alert
            severity="info"
            sx={{ mb: 2 }}
          >
            {registriNonRiconciliati.length === 1
              ? "1 giornata è chiusa ma non ancora riconciliata"
              : `${registriNonRiconciliati.length} giornate sono chiuse ma non ancora riconciliate`}
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
                  {`${MESI_LABEL[(mese || 1) - 1]} ${anno}`}
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
              {/* Tutti i KPI su una sola riga: 3 differenze (un po' più grandi) + 6 componenti */}
              <Box sx={{ display: "flex", flexWrap: "nowrap", gap: 1.5, alignItems: "stretch", overflowX: "auto", pb: 1 }}>
                {[
                  { label: "Differenza", value: differenzaGestionale },
                  { label: "Differenza tracciata", value: differenzaTracciata },
                  { label: "Differenza non tracc.", value: differenzaNonTracciata },
                ].map((d) => (
                  <Paper
                    key={d.label}
                    variant="outlined"
                    sx={{ flexShrink: 0, p: 1.25, width: 150, textAlign: "center", display: "flex", flexDirection: "column", justifyContent: "center", gap: 0.25 }}
                  >
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      noWrap
                    >
                      {d.label}
                    </Typography>
                    <Typography
                      variant="h5"
                      fontWeight="bold"
                      sx={{ fontVariantNumeric: "tabular-nums", color: d.value >= 0 ? palette.netto : palette.spese }}
                    >
                      {`€ ${formatCurrency(d.value)}`}
                    </Typography>
                  </Paper>
                ))}
                {kpiBanda.map((kpi) => (
                  <KPICard
                    key={kpi.label}
                    label={kpi.label}
                    value={kpi.value}
                    negative={kpi.negative}
                  />
                ))}
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
                <Box
                  onClick={() => setRegistriEspansi((v) => !v)}
                  sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", userSelect: "none" }}
                >
                  <Typography
                    variant="subtitle1"
                    fontWeight="bold"
                  >
                    Registri Giornalieri ({registriInclusi.length})
                  </Typography>
                  <IconButton
                    size="small"
                    aria-label={registriEspansi ? "Comprimi registri giornalieri" : "Espandi registri giornalieri"}
                  >
                    {registriEspansi ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </IconButton>
                </Box>
                <Collapse
                  in={registriEspansi}
                  timeout="auto"
                  unmountOnExit
                >
                  <TableContainer sx={{ mt: 1 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Data</TableCell>
                        <TableCell align="right">Vendite</TableCell>
                        <TableCell align="right">Contanti</TableCell>
                        <TableCell align="right">Elettronici</TableCell>
                        <TableCell align="right">Fattura</TableCell>
                        <TableCell align="right">Resto</TableCell>
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
                            sx={{ color: ri.registro.resto !== 0 ? "error.main" : "inherit" }}
                          >
                            {`\u20AC ${(ri.registro.resto ?? 0).toFixed(2)}`}
                          </TableCell>
                          <TableCell>
                            <Chip
                              // Con l'auto-link possono comparire registri DRAFT (giorni
                              // toccati solo da una spesa fissa): non sono "Chiuso".
                              label={
                                ri.registro.stato === statoRegistroCassa.RECONCILED
                                  ? "Riconciliato"
                                  : ri.registro.stato === statoRegistroCassa.DRAFT
                                    ? "Bozza"
                                    : "Chiuso"
                              }
                              size="small"
                              color={
                                ri.registro.stato === statoRegistroCassa.RECONCILED
                                  ? "success"
                                  : ri.registro.stato === statoRegistroCassa.DRAFT
                                    ? "default"
                                    : "warning"
                              }
                              variant="outlined"
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  </TableContainer>
                </Collapse>
              </Paper>
            </div>
          )}

          {/* Spese fisse del mese: stipendi, utenze, affitto. Le righe finiscono sul
              registro del giorno indicato — la chiusura non possiede spese. */}
          <div className="col-span-12">
            <Paper
              elevation={1}
              sx={{ p: 2 }}
            >
              <SpeseDataGrid
                initialExpenses={gridSpeseFisse}
                isLocked={!isDraft}
                date={dataDefaultSpese}
                columns={{
                  showData: true,
                  showCategoria: true,
                  categoriaOptions: CATEGORIE_FISSE,
                  defaultCategoria: "Utenze",
                  showGiornale: false,
                  showMetodoPagamento: true,
                  showPagamentoFornitore: false,
                }}
                isPaymentReadOnly={(row) => row.fatturaId != null || row.ddtId != null}
                persistence={isDraft ? persistenceSpese : undefined}
              />
            </Paper>
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
