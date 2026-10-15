import { useContext, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { useMutation, useQuery } from "@apollo/client";
import dayjs from "dayjs";

import PageTitleContext from "../../layout/headerBar/PageTitleContext";
import KPICard from "../../common/KPICard";
import formatCurrency from "../../../common/bones/formatCurrency";
import SpeseDataGrid, { METODO_CONTANTI, SpeseDataGridPersistence, SpeseGridRow } from "../registrazioneCassa/SpeseDataGrid";
import { getLiquiditaCassa, getCategorieSpesa } from "../../../graphql/registroCassa/queries";
import useQueryRiepilogoAnnuale from "../../../graphql/registroCassa/useQueryRiepilogoAnnuale";
import { mutationMutateSpesaCassa, mutationEliminaSpesaCassa } from "../../../graphql/registroCassa/mutations";
import { mutationMutatePagamentoFornitore, mutationDeletePagamentoFornitore } from "../../../graphql/fornitori/mutations";
import { parseDateForGraphQL, parseDateOnlyForGraphQL } from "../../../common/date/date";
import showToast from "../../../common/toast/showToast";
import { MESI_LABEL } from "../registrazioneCassa/dashboard/dashboardUtils";

/**
 * View «Liquidità»: la cassa cumulativa (entrate − uscite + saldo iniziale), il dettaglio
 * per mese/anno e la griglia delle spese extra (beni, macchinari, ecc.) — la stessa griglia
 * della Chiusura Mensile, riusata identica. Le righe inserite qui finiscono sul registro
 * cassa del giorno indicato, quindi concorrono automaticamente alla liquidità e alla
 * chiusura del mese.
 */
function LiquiditaPage() {
  const { setTitle } = useContext(PageTitleContext);

  const { data: liquiditaData, loading: loadingLiquidita, error: errorLiquidita, refetch: refetchLiquidita } =
    useQuery(getLiquiditaCassa);
  const { data: categorieData } = useQuery(getCategorieSpesa);

  const annoCorrente = dayjs().year();
  const [anno, setAnno] = useState(annoCorrente);
  const { mesi } = useQueryRiepilogoAnnuale({ anno });

  const [mutateSpesaCassa] = useMutation(mutationMutateSpesaCassa);
  const [eliminaSpesaCassa] = useMutation(mutationEliminaSpesaCassa);
  const [mutatePagamentoFornitore] = useMutation(mutationMutatePagamentoFornitore);
  const [eliminaPagamentoFornitore] = useMutation(mutationDeletePagamentoFornitore);

  useEffect(() => {
    setTitle("Liquidità");
  }, [setTitle]);

  const liquidita = liquiditaData?.gestioneCassa.liquiditaCassa;
  const categorieAttive = useMemo(
    () => (categorieData?.gestioneCassa.categorieSpesa ?? []).filter((c) => c.attiva).map((c) => c.nome),
    [categorieData?.gestioneCassa.categorieSpesa]
  );

  const dataDefault = dayjs().format("YYYY-MM-DD");

  const persistence = useMemo<SpeseDataGridPersistence>(() => {
    const errore = (message: string) => {
      showToast({ type: "error", position: "bottom-right", message, toastId: "liquidita-spese-error" });
    };

    const esegui = async <T,>(azione: () => Promise<T>): Promise<T | undefined> => {
      try {
        return await azione();
      } catch (err: unknown) {
        errore(err instanceof Error ? err.message : "Errore nel salvataggio della spesa");
        await refetchLiquidita();
        return undefined;
      }
    };

    const isTracciata = (row: SpeseGridRow) => (row.paymentMethod ?? METODO_CONTANTI) !== METODO_CONTANTI;

    const salvaSpesaContanti = async (row: SpeseGridRow) => {
      const res = await mutateSpesaCassa({
        variables: {
          spesa: {
            spesaId: (row.spesaId ?? 0) > 0 ? row.spesaId : null,
            data: parseDateForGraphQL(row.data ?? dataDefault) ?? dataDefault,
            descrizione: row.description,
            note: row.note || null,
            importo: row.amount,
            categoria: row.categoria ?? "Altro",
          },
        },
      });
      return res.data?.gestioneCassa.mutateSpesaCassa?.id ?? null;
    };

    const salvaPagamentoTracciato = async (row: SpeseGridRow) => {
      const res = await mutatePagamentoFornitore({
        variables: {
          pagamento: {
            pagamentoId: (row.pagamentoId ?? 0) > 0 ? row.pagamentoId : undefined,
            fatturaId: row.fatturaId ?? undefined,
            ddtId: row.ddtId ?? undefined,
            dataPagamento: parseDateOnlyForGraphQL(row.data ?? dataDefault) ?? (row.data ?? dataDefault).split("T")[0],
            importo: row.amount,
            metodoPagamento: row.paymentMethod ?? "Bonifico",
            descrizione: row.description,
            note: row.note || null,
            categoria: row.categoria ?? "Altro",
          },
        },
      });
      return res.data?.fornitori.mutatePagamentoFornitore?.pagamentoId ?? null;
    };

    const salvaRiga = async (row: SpeseGridRow) => {
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
      await refetchLiquidita();
      return nuovoId;
    };

    const eliminaRiga = async (row: SpeseGridRow) => {
      if ((row.pagamentoId ?? 0) > 0) {
        await eliminaPagamentoFornitore({ variables: { pagamentoId: row.pagamentoId! } });
      } else if ((row.spesaId ?? 0) > 0) {
        await eliminaSpesaCassa({ variables: { spesaId: row.spesaId! } });
      }
      await refetchLiquidita();
    };

    return {
      createExpense: (row) => esegui(() => salvaRiga(row)),
      updateExpense: async (row) => { await esegui(() => salvaRiga(row)); },
      deleteExpense: async (row) => { await esegui(() => eliminaRiga(row)); },
      createSupplierPayment: (row) => esegui(() => salvaRiga(row)),
      updateSupplierPayment: async (row) => { await esegui(() => salvaRiga(row)); },
      deleteSupplierPayment: async (row) => { await esegui(() => eliminaRiga(row)); },
    };
  }, [dataDefault, refetchLiquidita, mutateSpesaCassa, eliminaSpesaCassa, mutatePagamentoFornitore, eliminaPagamentoFornitore]);

  if (loadingLiquidita) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "50vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (errorLiquidita) {
    return <Alert severity="error">Errore nel caricamento della liquidità: {errorLiquidita.message}</Alert>;
  }

  return (
    <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 2 }}>
      {/* KPI liquidità */}
      <Paper
        variant="outlined"
        sx={{ p: 2.5 }}
      >
        <Typography
          variant="subtitle1"
          fontWeight={600}
          sx={{ mb: 2 }}
        >
          Cassa cumulativa
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
          <KPICard
            label="Liquidità disponibile"
            value={liquidita?.liquidita ?? 0}
            negative={false}
          />
          <KPICard
            label="Totale vendite"
            value={liquidita?.totaleVendite ?? 0}
          />
          <KPICard
            label="Totale spese"
            value={liquidita?.totaleSpese ?? 0}
            negative
          />
          <KPICard
            label="Saldo iniziale"
            value={liquidita?.saldoIniziale ?? 0}
          />
        </Box>
      </Paper>

      {/* Riepilogo per periodo (mese/anno) */}
      <Paper
        variant="outlined"
        sx={{ p: 2.5 }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
          <Typography
            variant="subtitle1"
            fontWeight={600}
          >
            Riepilogo mensile
          </Typography>
          <FormControl
            size="small"
            sx={{ minWidth: 120 }}
          >
            <InputLabel id="liquidita-anno-label">Anno</InputLabel>
            <Select
              labelId="liquidita-anno-label"
              label="Anno"
              value={anno}
              onChange={(e) => setAnno(Number(e.target.value))}
            >
              {[annoCorrente, annoCorrente - 1, annoCorrente - 2].map((a) => (
                <MenuItem
                  key={a}
                  value={a}
                >
                  {a}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Mese</TableCell>
                <TableCell align="right">Vendite</TableCell>
                <TableCell align="right">Spese</TableCell>
                <TableCell align="right">Differenza</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {mesi.map((m) => (
                <TableRow key={m.mese}>
                  <TableCell>{MESI_LABEL[m.mese - 1]}</TableCell>
                  <TableCell align="right">{formatCurrency(m.totaleVendite)}</TableCell>
                  <TableCell align="right">{formatCurrency(m.totaleSpese)}</TableCell>
                  <TableCell
                    align="right"
                    sx={{ color: m.differenza < 0 ? "error.main" : "inherit" }}
                  >
                    {formatCurrency(m.differenza)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Griglia spese extra: stessa logica della chiusura mensile */}
      <Paper
        elevation={1}
        sx={{ p: 2 }}
      >
        <SpeseDataGrid
          initialExpenses={[]}
          isLocked={false}
          date={dataDefault}
          columns={{
            showData: true,
            showCategoria: true,
            categoriaOptions: categorieAttive.length > 0 ? categorieAttive : ["Altro"],
            defaultCategoria: "Altro",
            showGiornale: false,
            showNote: true,
            showMetodoPagamento: true,
            showPagamentoFornitore: false,
          }}
          persistence={persistence}
          isPaymentReadOnly={(row) => row.fatturaId != null || row.ddtId != null}
        />
      </Paper>
    </Box>
  );
}

export default LiquiditaPage;
