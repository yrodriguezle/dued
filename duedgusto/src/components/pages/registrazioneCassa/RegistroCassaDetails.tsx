

import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { Form, Formik, FormikProps } from "formik";
import { z } from "zod";
import { Box, Typography, IconButton, useMediaQuery, useTheme } from "@mui/material";
import { ArrowBack, ArrowForward } from "@mui/icons-material";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import LockIcon from "@mui/icons-material/Lock";
import { useParams, useNavigate } from "react-router";
import { useApolloClient } from "@apollo/client";
import { GridReadyEvent } from "ag-grid-community";
import FormikToolbar from "../../common/form/toolbar/FormikToolbar";
import FormikToolbarButton from "../../common/form/toolbar/FormikToolbarButton";

import CashRegisterFormDataGrid from "./CashRegisterFormDataGrid";
import { DatagridData } from "../../common/datagrid/@types/Datagrid";
import logger from "../../../common/logger/logger";
import { formStatuses } from "../../../common/globals/constants";
import useInitializeValues from "./useInitializeValues";
import useConfirm from "../../common/confirm/useConfirm";
import PageTitleContext from "../../layout/headerBar/PageTitleContext";
import useQueryDenominations from "../../../graphql/cashRegister/useQueryDenominations";
import useQueryCashRegister from "../../../graphql/cashRegister/useQueryCashRegister";
import useSubmitCashRegister from "../../../graphql/cashRegister/useSubmitCashRegister";
import { PagamentoFornitoreRegistroInput, RegistroCassaInput } from "../../../graphql/cashRegister/mutations";
import useCloseCashRegister from "../../../graphql/cashRegister/useCloseCashRegister";
import { getRegistroCassa } from "../../../graphql/cashRegister/queries";
import useStore from "../../../store/useStore";
import useRegistroCassaSubscription from "../../../graphql/subscriptions/useRegistroCassaSubscription";
import useVenditaCreatedSubscription from "../../../graphql/subscriptions/useVenditaCreatedSubscription";
import useChiusuraCassaSubscription from "../../../graphql/subscriptions/useChiusuraCassaSubscription";
import { toast } from "react-toastify";
import { getCurrentDate, getFormattedDate, getWeekdayName, parseDateForGraphQL } from "../../../common/date/date";
import useCashCountData from "./useCashCountData";

// Schema per Formik - solo campi del form, NON include dati delle griglie
const Schema = z.object({
  id: z.number().optional(),
  date: z.string().nonempty("La data è obbligatoria"),
  utenteId: z.number(),
  notes: z.string(),
  status: z.enum(["DRAFT", "CLOSED", "RECONCILED"]),
  gridDirty: z.boolean().default(false),
});

export type FormikCashRegisterValues = z.infer<typeof Schema>;

function RegistroCassaDetails() {
  const { date: dateParam } = useParams<{ date?: string }>();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const formRef = useRef<FormikProps<FormikCashRegisterValues>>(null);
  const openingGridRef = useRef<GridReadyEvent<DatagridData<CashCountRow>> | null>(null);
  const closingGridRef = useRef<GridReadyEvent<DatagridData<CashCountRow>> | null>(null);
  const incomesGridRef = useRef<GridReadyEvent<DatagridData<IncomeRow>> | null>(null);
  const expensesGridRef = useRef<GridReadyEvent<DatagridData<ExpenseRow>> | null>(null);
  const { setTitle } = useContext(PageTitleContext);
  const client = useApolloClient();
  const utente = useStore((state) => state.utente);
  const isOpen = useStore((state) => state.isOpen);
  const getNextOperatingDate = useStore((state) => state.getNextOperatingDate);

  // handleCellChange: segnala che il form ha modifiche non salvate
  const handleCellChange = useCallback(() => {
    formRef.current?.setFieldValue("gridDirty", true);
  }, []);

  // summaryData: stato aggregato aggiornato via callback dalle griglie figlie
  const [summaryData, setSummaryData] = useState<SummaryData>({
    openingTotal: 0,
    closingTotal: 0,
    incomes: [],
    expensesTotalAmount: 0,
    receiptExpensesAmount: 0,
  });

  const handleOpeningTotalChange = useCallback((total: number) => {
    setSummaryData((prev) => ({ ...prev, openingTotal: total }));
  }, []);

  const handleClosingTotalChange = useCallback((total: number) => {
    setSummaryData((prev) => ({ ...prev, closingTotal: total }));
  }, []);

  const handleIncomesChange = useCallback((incomes: IncomeEntry[]) => {
    setSummaryData((prev) => ({ ...prev, incomes }));
  }, []);

  const handleExpensesChange = useCallback((totalAmount: number, receiptAmount: number) => {
    setSummaryData((prev) => ({
      ...prev,
      expensesTotalAmount: totalAmount,
      receiptExpensesAmount: receiptAmount,
    }));
  }, []);

  // Stati per i dati iniziali delle griglie - mantengono referenza stabile
  const [initialOpeningCounts, setInitialOpeningCounts] = useState<CashCount[]>([]);
  const [initialClosingCounts, setInitialClosingCounts] = useState<CashCount[]>([]);
  const [initialIncomes, setInitialIncomes] = useState<Income[]>([]);
  const [initialExpenses, setInitialExpenses] = useState<Expense[]>([]);

  // Usa il parametro date dall'URL, altrimenti usa la data corrente
  const getInitialDate = useCallback(() => {
    return dateParam || getCurrentDate("YYYY-MM-DD");
  }, [dateParam]);

  const [currentDate, setCurrentDate] = useState<string>(getInitialDate());

  // Aggiorna currentDate quando cambia l'URL
  useEffect(() => {
    const newDate = getInitialDate();
    setCurrentDate(newDate);
  }, [getInitialDate]);

  const { initialValues, handleInitializeValues } = useInitializeValues({
    skipInitialize: !currentDate,
    utenteId: utente?.id || 0,
    currentDate,
  });

  const { denominazioni, loading: loadingDenominations } = useQueryDenominations();

  const { cashRegister, loading: loadingCashRegister, refetch: refetchCashRegister } = useQueryCashRegister({
    data: parseDateForGraphQL(currentDate) ?? "",
    skip: !currentDate,
  });

  // Subscription: aggiorna i dati quando il registro cassa corrente viene modificato
  const { data: registroUpdatedData } = useRegistroCassaSubscription();

  useEffect(() => {
    if (registroUpdatedData?.onRegistroCassaUpdated && cashRegister) {
      const event = registroUpdatedData.onRegistroCassaUpdated;
      if (event.registroCassaId === cashRegister.id) {
        refetchCashRegister();
      }
    }
  }, [registroUpdatedData, cashRegister, refetchCashRegister]);

  // Subscription: aggiorna i dati quando viene creata una nuova vendita per il registro corrente
  const { data: venditaCreatedData } = useVenditaCreatedSubscription();

  useEffect(() => {
    if (venditaCreatedData?.onVenditaCreated && cashRegister) {
      const event = venditaCreatedData.onVenditaCreated;
      if (event.registroCassaId === cashRegister.id) {
        refetchCashRegister();
      }
    }
  }, [venditaCreatedData, cashRegister, refetchCashRegister]);

  // Subscription: aggiorna lo stato quando la cassa viene chiusa
  const { data: chiusuraData } = useChiusuraCassaSubscription();

  useEffect(() => {
    if (chiusuraData?.onChiusuraCassaCompleted && cashRegister) {
      const event = chiusuraData.onChiusuraCassaCompleted;
      if (event.registroCassaId === cashRegister.id) {
        refetchCashRegister();
        toast.info("La cassa e' stata chiusa", { position: "bottom-right" });
        formRef.current?.setStatus({
          formStatus: formStatuses.UPDATE,
          isFormLocked: true,
        });
      }
    }
  }, [chiusuraData, cashRegister, refetchCashRegister]);

  // Prepara i dati per le griglie di apertura e chiusura
  const { openingRowData, closingRowData } = useCashCountData({
    denominations: denominazioni,
    openingCounts: initialOpeningCounts,
    closingCounts: initialClosingCounts,
  });

  // Navigate between days for cash register entry, skipping non-operating days
  const handlePreviousDay = useCallback(() => {
    const [year, month, day] = currentDate.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    for (let i = 0; i < 7; i++) {
      date.setDate(date.getDate() - 1);
      if (isOpen(date)) break;
    }
    const newDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    navigate(`/gestionale/cassa/${newDate}`);
  }, [currentDate, isOpen, navigate]);

  const handleNextDay = useCallback(() => {
    const [year, month, day] = currentDate.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    for (let i = 0; i < 7; i++) {
      date.setDate(date.getDate() + 1);
      if (isOpen(date)) break;
    }
    const newDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    navigate(`/gestionale/cassa/${newDate}`);
  }, [currentDate, isOpen, navigate]);

  const handleOpenMonthlyCalendar = useCallback(() => {
    // Estrai anno e mese dalla data corrente nell'URL
    const [year, month] = currentDate.split("-").map(Number);
    navigate(`/gestionale/cassa/monthly?year=${year}&month=${month}`);
  }, [currentDate, navigate]);

  // Copia i conteggi chiusura del giorno operativo precedente come apertura
  const handleCopyFromPrevious = useCallback(async () => {
    // Calcola la data del giorno operativo precedente
    const [year, month, day] = currentDate.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    Array.from({ length: 7 }).some(() => {
      date.setDate(date.getDate() - 1);
      return isOpen(date);
    });
    const prevDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const parsedPrevDate = parseDateForGraphQL(prevDate);
    if (!parsedPrevDate) return;

    try {
      const { data } = await client.query({
        query: getRegistroCassa,
        variables: { data: parsedPrevDate },
        fetchPolicy: "network-only",
      });

      const registro = data?.gestioneCassa?.registroCassa;
      if (!registro?.conteggiChiusura?.length) {
        toast.warning("Nessun dato di chiusura trovato per il giorno precedente");
        return;
      }

      const copiedCounts: CashCount[] = registro.conteggiChiusura.map((c: ConteggioMoneta) => {
        // Per la denominazione con valore 5.00€ forza quantita = 2
        const denomination = denominazioni.find((d: DenominazioneMoneta) => d.id === c.denominazioneMonetaId);
        const quantita = denomination && denomination.valore === 5 ? 2 : c.quantita;
        return {
          denominazioneMonetaId: c.denominazioneMonetaId,
          quantita,
        };
      });

      setInitialOpeningCounts(copiedCounts);
      handleCellChange();
      toast.success("Conteggi apertura copiati dal giorno precedente", { position: "bottom-right" });
    } catch (error) {
      logger.error("Errore durante la copia dal giorno precedente:", error);
      toast.error("Errore durante la copia dal giorno precedente");
    }
  }, [currentDate, isOpen, client, denominazioni, handleCellChange]);

  const { submitCashRegister } = useSubmitCashRegister();
  const { closeCashRegister, loading: closing } = useCloseCashRegister();
  const onConfirm = useConfirm();

  useEffect(() => {
    setTitle("Gestione Cassa");
  }, [setTitle]);

  // Initialize form with cash register data when available
  useEffect(() => {
    if (cashRegister) {
      // Convert date from ISO 8601 to YYYY-MM-DD
      const dateStr = cashRegister.data.split("T")[0]; // Extract YYYY-MM-DD from ISO string

      // Popola i valori del form (solo campi non-griglia)
      const formikValues: FormikCashRegisterValues = {
        id: cashRegister.id,
        date: dateStr,
        utenteId: cashRegister.utenteId,
        notes: cashRegister.note || "",
        status: cashRegister.stato,
        gridDirty: false,
      };
      handleInitializeValues(formikValues);

      // Popola i dati iniziali delle griglie
      setInitialOpeningCounts(
        cashRegister.conteggiApertura?.map((c: ConteggioMoneta) => ({
          denominazioneMonetaId: c.denominazioneMonetaId,
          quantita: c.quantita,
        })) || []
      );

      setInitialClosingCounts(
        cashRegister.conteggiChiusura?.map((c: ConteggioMoneta) => ({
          denominazioneMonetaId: c.denominazioneMonetaId,
          quantita: c.quantita,
        })) || []
      );

      setInitialIncomes(
        cashRegister.incassi && cashRegister.incassi.length > 0
          ? cashRegister.incassi.map((i: IncassoCassa) => ({ type: i.tipo, amount: i.importo }))
          : [
            { type: "Pago in contanti", amount: cashRegister.incassoContanteTracciato || 0 },
            { type: "Pagamenti Elettronici", amount: cashRegister.incassiElettronici || 0 },
            { type: "Pagamento con Fattura", amount: cashRegister.incassiFattura || 0 },
          ]
      );

      // Ricostruisci le spese: spese normali + pagamenti fornitore
      const normalExpenses: Expense[] =
        cashRegister.spese?.map((e: SpesaCassa) => ({
          description: e.descrizione,
          amount: e.importo,
        })) || [];
      const pagamentoFornitoreExpenses: Expense[] =
        cashRegister.pagamentiFornitori?.map((p: PagamentoFornitoreRegistro) => {
          const hasInvoice = !!p.fattura;
          const nomeFornitore = hasInvoice ? p.fattura?.fornitore?.ragioneSociale || "Fornitore" : p.ddt?.fornitore?.ragioneSociale || "Fornitore";
          const fornitoreIdVal = hasInvoice ? p.fattura?.fornitore?.fornitoreId : p.ddt?.fornitore?.fornitoreId;
          const docType: "FA" | "DDT" = hasInvoice ? "FA" : "DDT";
          const docLabel = hasInvoice ? `FA ${p.fattura?.numeroFattura || ""}` : `DDT ${p.ddt?.numeroDdt || ""}`;

          return {
            description: `Pagamento ${nomeFornitore} - ${docLabel}`,
            amount: p.importo,
            isPagamentoFornitore: true,
            fornitoreId: fornitoreIdVal,
            ddtNumber: p.ddt?.numeroDdt,
            paymentMethod: p.metodoPagamento,
            documentType: docType,
            invoiceNumber: p.fattura?.numeroFattura,
          };
        }) || [];
      setInitialExpenses([...pagamentoFornitoreExpenses, ...normalExpenses]);

      setTimeout(() => {
        formRef.current?.setStatus({
          formStatus: formStatuses.UPDATE,
          isFormLocked: cashRegister.stato !== "DRAFT",
        });
      }, 0);
    } else {
      // Initialize with current date for new entry
      const newFormikValues: FormikCashRegisterValues = {
        date: currentDate,
        utenteId: utente?.id || 0,
        notes: "",
        status: "DRAFT",
        gridDirty: false,
      };
      handleInitializeValues(newFormikValues);

      // Popola i dati iniziali delle griglie per nuova registrazione
      setInitialOpeningCounts([]);
      setInitialClosingCounts([]);
      setInitialIncomes([
        { type: "Pago in contanti", amount: 0 },
        { type: "Pagamenti Elettronici", amount: 0 },
        { type: "Pagamento con Fattura", amount: 0 },
      ]);
      setInitialExpenses([]);

      setTimeout(() => {
        formRef.current?.setStatus({
          formStatus: formStatuses.INSERT,
          isFormLocked: false,
        });
      }, 0);
    }
  }, [cashRegister, handleInitializeValues, currentDate, utente?.id]);

  const onSubmit = async (values: FormikCashRegisterValues) => {
    try {
      openingGridRef.current?.api.stopEditing();
      closingGridRef.current?.api.stopEditing();
      incomesGridRef.current?.api.stopEditing();
      expensesGridRef.current?.api.stopEditing();

      // Leggi i dati dalle griglie
      const openingCounts = openingGridRef.current?.context.getGridData() || [];
      const closingCounts = closingGridRef.current?.context.getGridData() || [];
      const incomes = incomesGridRef.current?.context.getGridData() || [];
      const expenses = expensesGridRef.current?.context.getGridData() || [];

      // Converti la data in formato GraphQL (ISO 8601 UTC)
      const parsedDate = parseDateForGraphQL(values.date);
      if (!parsedDate) {
        toast.error("Data non valida");
        return;
      }

      // Separa spese normali da pagamenti fornitore
      const normalExpenses = expenses.filter((row: Expense) => !row.isPagamentoFornitore);
      const pagamentiFornitore: PagamentoFornitoreRegistroInput[] = expenses
        .filter((row: Expense) => row.isPagamentoFornitore && row.fornitoreId)
        .map((row: Expense) => ({
          fornitoreId: row.fornitoreId!,
          numeroDdt: row.ddtNumber || "",
          importo: row.amount,
          metodoPagamento: row.paymentMethod || undefined,
          tipoDocumento: row.documentType || "DDT",
          numeroFattura: row.invoiceNumber || undefined,
        }));

      // Converti gli array in campi per il backend (nomi italiani)
      const input: RegistroCassaInput = {
        id: values.id,
        data: parsedDate,
        utenteId: values.utenteId,
        conteggiApertura: openingCounts.map((row: CashCountRow) => ({
          denominazioneMonetaId: row.denominationId,
          quantita: row.quantity,
        })),
        conteggiChiusura: closingCounts.map((row: CashCountRow) => ({
          denominazioneMonetaId: row.denominationId,
          quantita: row.quantity,
        })),
        incassi: incomes.map((row: IncomeRow) => ({
          tipo: row.type,
          importo: row.amount,
        })),
        spese: normalExpenses.map((row: ExpenseRow) => ({
          descrizione: row.description,
          importo: row.amount,
        })),
        pagamentiFornitori: pagamentiFornitore,
        incassoContanteTracciato: incomes.find((i: IncomeRow) => i.type === "Pago in contanti")?.amount || 0,
        incassiElettronici: incomes.find((i: IncomeRow) => i.type === "Pagamenti Elettronici")?.amount || 0,
        incassiFattura: incomes.find((i: IncomeRow) => i.type === "Pagamento con Fattura")?.amount || 0,
        speseFornitori: 0, // Non più usato, calcolato dal backend
        speseGiornaliere: 0, // Non più usato, calcolato dal backend
        note: values.notes,
        stato: values.status as StatoRegistroCassa,
      };

      const result = await submitCashRegister({ registroCassa: input });

      if (result) {
        toast.success("Cassa salvata con successo!", { position: "bottom-right" });

        // Aggiorna l'ID e resetta dirty: resetForm con i valori correnti
        // rende i valori correnti i nuovi initialValues, azzerando dirty
        const updatedValues = {
          ...values,
          id: result.id || values.id,
          gridDirty: false,
        };
        formRef.current?.resetForm({
          values: updatedValues,
          status: {
            formStatus: formStatuses.UPDATE,
            isFormLocked: false,
          },
        });
      }
    } catch (error) {
      logger.error("Errore durante il salvataggio:", error);
      const graphQLMessage = (error as { graphQLErrors?: { message: string }[] })?.graphQLErrors?.[0]?.message;
      toast.error(graphQLMessage || "Errore durante il salvataggio della cassa");
    }
  };

  const handleCloseCashRegister = async () => {
    const confirmed = await onConfirm({
      title: "Chiudi Cassa",
      content: "Sei sicuro di voler chiudere definitivamente la cassa? Non sarà più possibile modificarla.",
      acceptLabel: "Si, chiudi",
      cancelLabel: "Annulla",
    });

    if (!confirmed || !formRef.current?.values.id) {
      return;
    }

    try {
      await closeCashRegister(formRef.current.values.id);
      toast.success("Cassa chiusa con successo!", { position: "bottom-right" });
      formRef.current?.setStatus({
        formStatus: formStatuses.UPDATE,
        isFormLocked: true,
      });
    } catch (error) {
      logger.error("Errore durante la chiusura:", error);
      toast.error("Errore durante la chiusura della cassa");
    }
  };

  // Redirect se il giorno corrente è non operativo
  useEffect(() => {
    const [y, m, d] = currentDate.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    if (!isOpen(date)) {
      const next = getNextOperatingDate(date);
      const nextStr = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
      navigate(`/gestionale/cassa/${nextStr}`, { replace: true });
    }
  }, [currentDate, isOpen, getNextOperatingDate, navigate]);

  if (loadingDenominations || loadingCashRegister) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "50vh" }}>
        <Typography variant="h6">Caricamento...</Typography>
      </Box>
    );
  }

  return (
    <Formik
      innerRef={formRef}
      enableReinitialize
      initialValues={initialValues}
      initialStatus={{ formStatus: formStatuses.INSERT, isFormLocked: false }}
      validate={(values: FormikCashRegisterValues) => {
        const result = Schema.safeParse(values);
        if (result.success) {
          return;
        }
        return Object.fromEntries(result.error.issues.map(({ path, message }) => [path[0], message]));
      }}
      onSubmit={onSubmit}
    >
      {({ status, isSubmitting, isValid, dirty, values }) => {
        const hasChanges = dirty || values.gridDirty;
        const isClosed = values.status === "CLOSED";
        const disableSave = (status?.isFormLocked && !isClosed) || isSubmitting || !isValid || !hasChanges;

        return (
          <Form
            noValidate
            style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}
          >
            <FormikToolbar
              hideUnlockButton
              hideNewButton
              hideDeleteButton
              disabledSave={disableSave}
              rightContent={
                <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 0, sm: 0.5 }, pr: { xs: 0.5, sm: 2 } }}>
                  <IconButton
                    size="small"
                    onClick={handlePreviousDay}
                    title="Giorno precedente"
                  >
                    <ArrowBack fontSize="small" />
                  </IconButton>
                  <Typography
                    variant="body2"
                    sx={{ textAlign: "center", whiteSpace: "nowrap", fontSize: { xs: "0.75rem", sm: "0.875rem" } }}
                  >
                    {isMobile
                      ? getFormattedDate(currentDate, "DD/MM")
                      : `${getWeekdayName(currentDate, "it-IT", true)} - ${getFormattedDate(currentDate, "DD/MM/YYYY")}`
                    }
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={handleNextDay}
                    title="Giorno successivo"
                  >
                    <ArrowForward fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={handleOpenMonthlyCalendar}
                    title="Vista mensile"
                    color="primary"
                  >
                    <CalendarMonthIcon fontSize="small" />
                  </IconButton>
                </Box>
              }
            >
              {status?.formStatus === formStatuses.UPDATE && status?.isFormLocked === false && (
                <FormikToolbarButton
                  type="button"
                  startIcon={<LockIcon />}
                  onClick={handleCloseCashRegister}
                  disabled={closing}
                  color="warning"
                >
                  Chiudi Cassa
                </FormikToolbarButton>
              )}
            </FormikToolbar>
            <Box
              className="scrollable-box"
              sx={{
                flex: 1,
                minHeight: 0,
                paddingX: { xs: 0.5, sm: 1, md: 2 },
                overflow: "auto",
                overscrollBehavior: "contain",
                boxSizing: "border-box",
                backgroundColor: "background.paper",
              }}
            >
              <CashRegisterFormDataGrid
                openingGridRef={openingGridRef}
                closingGridRef={closingGridRef}
                incomesGridRef={incomesGridRef}
                expensesGridRef={expensesGridRef}
                openingRowData={openingRowData}
                closingRowData={closingRowData}
                initialIncomes={initialIncomes}
                initialExpenses={initialExpenses}
                onCellChange={handleCellChange}
                onCopyFromPrevious={handleCopyFromPrevious}
                summaryData={summaryData}
                onOpeningTotalChange={handleOpeningTotalChange}
                onClosingTotalChange={handleClosingTotalChange}
                onIncomesChange={handleIncomesChange}
                onExpensesChange={handleExpensesChange}
              />
            </Box>
          </Form>
        );
      }}
    </Formik>
  );
}

export default RegistroCassaDetails;
