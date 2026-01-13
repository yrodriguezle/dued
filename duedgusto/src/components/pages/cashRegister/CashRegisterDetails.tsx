import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { Form, Formik, FormikProps } from "formik";
import { z } from "zod";
import { Box, Typography, Toolbar, IconButton } from "@mui/material";
import { ArrowBack, ArrowForward } from "@mui/icons-material";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import SaveIcon from "@mui/icons-material/Save";
import LockIcon from "@mui/icons-material/Lock";
import { useParams, useNavigate } from "react-router";
import { GridReadyEvent } from "ag-grid-community";
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
import useCloseCashRegister from "../../../graphql/cashRegister/useCloseCashRegister";
import useStore from "../../../store/useStore";
import { toast } from "react-toastify";
import { getCurrentDate, getFormattedDate, getWeekdayName, parseDateForGraphQL } from "../../../common/date/date";
import useCashCountData from "./useCashCountData";

// Schema per Formik - solo campi del form, NON include dati delle griglie
const Schema = z.object({
  registerId: z.number().optional(),
  date: z.string().nonempty("La data è obbligatoria"),
  userId: z.number(),
  notes: z.string(),
  status: z.enum(["DRAFT", "CLOSED", "RECONCILED"]),
});

export type FormikCashRegisterValues = z.infer<typeof Schema>;

// Types per i dati delle griglie (gestiti separatamente da Formik)
export interface CashCount {
  denominationId: number;
  quantity: number;
}

export interface Income {
  type: string;
  amount: number;
}

export interface Expense {
  description: string;
  amount: number;
}

interface CashCountRow extends Record<string, unknown> {
  denominationId: number;
  type: "COIN" | "BANKNOTE";
  value: number;
  quantity: number;
  total: number;
}

interface IncomeRow extends Record<string, unknown> {
  type: string;
  amount: number;
}

interface ExpenseRow extends Record<string, unknown> {
  description: string;
  amount: number;
}

function CashRegisterDetails() {
  const { date: dateParam } = useParams<{ date?: string }>();
  const navigate = useNavigate();
  const formRef = useRef<FormikProps<FormikCashRegisterValues>>(null);
  const openingGridRef = useRef<GridReadyEvent<DatagridData<CashCountRow>> | null>(null);
  const closingGridRef = useRef<GridReadyEvent<DatagridData<CashCountRow>> | null>(null);
  const incomesGridRef = useRef<GridReadyEvent<DatagridData<IncomeRow>> | null>(null);
  const expensesGridRef = useRef<GridReadyEvent<DatagridData<ExpenseRow>> | null>(null);
  const { setTitle } = useContext(PageTitleContext);
  const user = useStore((state) => state.user);

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
    userId: user?.userId || 0,
    currentDate,
  });

  const { denominations, loading: loadingDenominations } = useQueryDenominations();

  const { cashRegister, loading: loadingCashRegister } = useQueryCashRegister({
    date: parseDateForGraphQL(currentDate) ?? "",
    skip: !currentDate,
  });

  // Prepara i dati per le griglie di apertura e chiusura
  const { openingRowData, closingRowData } = useCashCountData({
    denominations,
    openingCounts: initialOpeningCounts,
    closingCounts: initialClosingCounts,
  });

  // Navigate between days for cash register entry
  const handlePreviousDay = useCallback(() => {
    // Parse date and subtract 1 day
    const [year, month, day] = currentDate.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() - 1);
    const newDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    navigate(`/gestionale/cassa/${newDate}`);
  }, [currentDate, navigate]);

  const handleNextDay = useCallback(() => {
    // Parse date and add 1 day
    const [year, month, day] = currentDate.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() + 1);
    const newDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    navigate(`/gestionale/cassa/${newDate}`);
  }, [currentDate, navigate]);

  const handleOpenMonthlyCalendar = useCallback(() => {
    // Estrai anno e mese dalla data corrente nell'URL
    const [year, month] = currentDate.split("-").map(Number);
    navigate(`/gestionale/cassa/monthly?year=${year}&month=${month}`);
  }, [currentDate, navigate]);

  const { submitCashRegister } = useSubmitCashRegister();
  const { closeCashRegister, loading: closing } = useCloseCashRegister();
  const onConfirm = useConfirm();

  useEffect(() => {
    setTitle("Gestione Cassa");
  }, [setTitle]);

  // Initialize form with cash register data when available
  useEffect(() => {
    if (cashRegister) {
      logger.log("Loading cashRegister from server", cashRegister);

      // Convert date from ISO 8601 to YYYY-MM-DD
      const dateStr = cashRegister.date.split("T")[0]; // Extract YYYY-MM-DD from ISO string

      // Popola i valori del form (solo campi non-griglia)
      const formikValues: FormikCashRegisterValues = {
        registerId: cashRegister.registerId,
        date: dateStr,
        userId: cashRegister.userId,
        notes: cashRegister.notes || "",
        status: cashRegister.status,
      };
      handleInitializeValues(formikValues);

      // Popola i dati iniziali delle griglie
      setInitialOpeningCounts(
        cashRegister.openingCounts.map((c: CashCount) => ({
          denominationId: c.denominationId,
          quantity: c.quantity,
        }))
      );

      setInitialClosingCounts(
        cashRegister.closingCounts.map((c: CashCount) => ({
          denominationId: c.denominationId,
          quantity: c.quantity,
        }))
      );

      setInitialIncomes(
        cashRegister.incomes && cashRegister.incomes.length > 0
          ? cashRegister.incomes.map((i) => ({ type: i.type, amount: i.amount }))
          : [
              { type: "Pago in contanti", amount: cashRegister.cashInWhite || 0 },
              { type: "Pagamenti Elettronici", amount: cashRegister.electronicPayments || 0 },
              { type: "Pagamento con Fattura", amount: cashRegister.invoicePayments || 0 },
            ]
      );

      setInitialExpenses(cashRegister.expenses && cashRegister.expenses.length > 0 ? cashRegister.expenses.map((e) => ({ description: e.description, amount: e.amount })) : []);

      setTimeout(() => {
        formRef.current?.setStatus({
          formStatus: formStatuses.UPDATE,
          isFormLocked: cashRegister.status !== "DRAFT",
        });
      }, 0);
    } else {
      // Initialize with current date for new entry
      const newFormikValues: FormikCashRegisterValues = {
        date: currentDate,
        userId: user?.userId || 0,
        notes: "",
        status: "DRAFT",
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
  }, [cashRegister, handleInitializeValues, currentDate, user?.userId]);

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

      // Converti gli array in campi singoli per il backend
      const input = {
        registerId: values.registerId,
        date: parsedDate,
        userId: values.userId,
        openingCounts: openingCounts.map((row: CashCountRow) => ({
          denominationId: row.denominationId,
          quantity: row.quantity,
        })),
        closingCounts: closingCounts.map((row: CashCountRow) => ({
          denominationId: row.denominationId,
          quantity: row.quantity,
        })),
        incomes: incomes.map((row: IncomeRow) => ({
          type: row.type,
          amount: row.amount,
        })),
        expenses: expenses.map((row: ExpenseRow) => ({
          description: row.description,
          amount: row.amount,
        })),
        cashInWhite: incomes.find((i: IncomeRow) => i.type === "Pago in contanti")?.amount || 0,
        electronicPayments: incomes.find((i: IncomeRow) => i.type === "Pagamenti Elettronici")?.amount || 0,
        invoicePayments: incomes.find((i: IncomeRow) => i.type === "Pagamento con Fattura")?.amount || 0,
        supplierExpenses: 0, // Non più usato, calcolato dal backend
        dailyExpenses: 0, // Non più usato, calcolato dal backend
        notes: values.notes,
        status: values.status,
      };

      logger.log("onSubmit - input to be sent", input);

      const result = await submitCashRegister({ cashRegister: input });

      if (result) {
        toast.success("Cassa salvata con successo!");

        // Aggiorna il form con l'ID ritornato dal server
        // Questo assicura che i successivi salvataggi siano update
        if (result.registerId && !formRef.current?.values.registerId) {
          formRef.current?.setFieldValue("registerId", result.registerId);
        }

        // Dopo il salvataggio, aggiorna lo stato del form
        formRef.current?.setStatus({
          formStatus: formStatuses.UPDATE,
          isFormLocked: false,
        });
      }
    } catch (error) {
      logger.error("Errore durante il salvataggio:", error);
      toast.error("Errore durante il salvataggio della cassa");
    }
  };

  const handleCloseCashRegister = async () => {
    const confirmed = await onConfirm({
      title: "Chiudi Cassa",
      content: "Sei sicuro di voler chiudere definitivamente la cassa? Non sarà più possibile modificarla.",
      acceptLabel: "Si, chiudi",
      cancelLabel: "Annulla",
    });

    if (!confirmed || !formRef.current?.values.registerId) {
      return;
    }

    try {
      await closeCashRegister(formRef.current.values.registerId);
      toast.success("Cassa chiusa con successo!");
      formRef.current?.setStatus({
        formStatus: formStatuses.UPDATE,
        isFormLocked: true,
      });
    } catch (error) {
      logger.error("Errore durante la chiusura:", error);
      toast.error("Errore durante la chiusura della cassa");
    }
  };

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
      {({ status, isSubmitting, isValid, dirty }) => {
        const disableSave = status?.isFormLocked || isSubmitting || !isValid || !dirty;

        return (
          <Form noValidate>
            {/* Toolbar in stile FormikToolbar */}
            <Box sx={{ borderBottom: 1, borderColor: "divider", bgcolor: "background.paper" }}>
              <Toolbar
                variant="dense"
                disableGutters
                sx={{
                  minHeight: 48,
                  height: 48,
                  display: "flex",
                  justifyContent: "space-between",
                  px: 2,
                }}
              >
                {/* Bottoni azione a sinistra */}
                <Box sx={{ height: 48, display: "flex", alignItems: "stretch" }}>
                  <FormikToolbarButton
                    startIcon={<SaveIcon />}
                    disabled={disableSave}
                    type="submit"
                  >
                    Salva
                  </FormikToolbarButton>
                  {status?.formStatus === formStatuses.UPDATE && status?.isFormLocked === false && (
                    <FormikToolbarButton
                      startIcon={<LockIcon />}
                      onClick={handleCloseCashRegister}
                      disabled={closing}
                      color="warning"
                    >
                      Chiudi Cassa
                    </FormikToolbarButton>
                  )}
                </Box>

                {/* Navigazione date al centro/destra */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <IconButton size="small" onClick={handlePreviousDay} title="Giorno precedente">
                    <ArrowBack fontSize="small" />
                  </IconButton>
                  <Typography variant="body2" sx={{ minWidth: 200, textAlign: "center" }}>
                    {getWeekdayName(currentDate)} - {getFormattedDate(currentDate, "DD/MM/YYYY")}
                  </Typography>
                  <IconButton size="small" onClick={handleNextDay} title="Giorno successivo">
                    <ArrowForward fontSize="small" />
                  </IconButton>
                  <IconButton size="small" onClick={handleOpenMonthlyCalendar} title="Vista mensile" color="primary">
                    <CalendarMonthIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Toolbar>
            </Box>

            {/* Contenuto principale */}
            <Box sx={{ paddingX: { xs: 1, sm: 2 }, paddingTop: 2, paddingBottom: 3 }}>
              <CashRegisterFormDataGrid
                openingGridRef={openingGridRef}
                closingGridRef={closingGridRef}
                incomesGridRef={incomesGridRef}
                expensesGridRef={expensesGridRef}
                openingRowData={openingRowData}
                closingRowData={closingRowData}
                initialIncomes={initialIncomes}
                initialExpenses={initialExpenses}
              />
            </Box>
          </Form>
        );
      }}
    </Formik>
  );
}

export default CashRegisterDetails;
