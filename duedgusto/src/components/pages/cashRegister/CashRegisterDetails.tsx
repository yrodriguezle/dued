import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { Form, Formik, FormikProps } from "formik";
import { z } from "zod";
import { Box, Typography, Button, IconButton, Stack } from "@mui/material";
import { ArrowBack, ArrowForward } from "@mui/icons-material";
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import { useParams, useNavigate, useLocation } from "react-router";

import CashRegisterFormDataGrid from "./CashRegisterFormDataGrid";
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

const CashCountSchema = z.object({
  denominationId: z.number(),
  quantity: z.number().min(0, "La quantità non può essere negativa"),
});

const IncomeSchema = z.object({
  type: z.string(),
  amount: z.number().min(0, "L'importo non può essere negativo"),
});

const ExpenseSchema = z.object({
  description: z.string().min(1, "La causale è obbligatoria"),
  amount: z.number().min(0, "L'importo non può essere negativo"),
});

const Schema = z.object({
  registerId: z.number().optional(),
  date: z.string().nonempty("La data è obbligatoria"),
  userId: z.number(),
  openingCounts: z.array(CashCountSchema),
  closingCounts: z.array(CashCountSchema),
  incomes: z.array(IncomeSchema),
  expenses: z.array(ExpenseSchema),
  notes: z.string(),
  status: z.enum(["DRAFT", "CLOSED", "RECONCILED"]),
});

export type FormikCashRegisterValues = z.infer<typeof Schema>;

function CashRegisterDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const formRef = useRef<FormikProps<FormikCashRegisterValues>>(null);
  const { title, setTitle } = useContext(PageTitleContext);
  const user = useStore((state) => state.user);

  // Leggi il parametro date dall'URL, altrimenti usa la data corrente
  const getInitialDate = useCallback(() => {
    const searchParams = new URLSearchParams(location.search);
    const dateParam = searchParams.get("date");
    return dateParam || getCurrentDate("YYYY-MM-DD");
  }, [location.search]);

  const [currentDate, setCurrentDate] = useState<string>(getInitialDate());

  // Aggiorna currentDate quando cambia l'URL
  useEffect(() => {
    const newDate = getInitialDate();
    setCurrentDate(newDate);
  }, [getInitialDate]);

  const { initialValues, handleInitializeValues } = useInitializeValues({
    skipInitialize: false,
    userId: user?.userId || 0
  });

  const { denominations, loading: loadingDenominations } = useQueryDenominations();

  const { cashRegister, loading: loadingCashRegisterById } = useQueryCashRegister({
    registerId: Number(id) || 0,
    date: parseDateForGraphQL(currentDate),
    skip: !id || !currentDate,
  });

  // Use appropriate cash register based on context
  const loadingCashRegister = loadingCashRegisterById;

  // Navigate between days for cash register entry
  const handlePreviousDay = useCallback(() => {
    // Parse date and subtract 1 day
    const [year, month, day] = currentDate.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() - 1);
    const newDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    setCurrentDate(newDate);
  }, [currentDate]);

  const handleNextDay = useCallback(() => {
    // Parse date and add 1 day
    const [year, month, day] = currentDate.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() + 1);
    const newDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    setCurrentDate(newDate);
  }, [currentDate]);

  const handleOpenMonthlyCalendar = useCallback(() => {
    navigate("/gestionale/cassa/monthly");
  }, [navigate]);

  const { submitCashRegister } = useSubmitCashRegister();
  const { closeCashRegister, loading: closing } = useCloseCashRegister();
  const onConfirm = useConfirm();

  useEffect(() => {
    setTitle("Gestione Cassa");
  }, [setTitle]);

  // Initialize form with cash register data when available
  useEffect(() => {
    if (cashRegister) {
      const formikValues: FormikCashRegisterValues = {
        registerId: cashRegister.registerId,
        date: cashRegister.date,
        userId: cashRegister.userId,
        openingCounts: cashRegister.openingCounts.map((c: CashCount) => ({
          denominationId: c.denominationId,
          quantity: c.quantity,
        })),
        closingCounts: cashRegister.closingCounts.map((c: CashCount) => ({
          denominationId: c.denominationId,
          quantity: c.quantity,
        })),
        incomes: cashRegister.incomes && cashRegister.incomes.length > 0
          ? cashRegister.incomes.map(i => ({ type: i.type, amount: i.amount }))
          : [
              { type: "Pago in Bianco (Contante)", amount: cashRegister.cashInWhite || 0 },
              { type: "Pagamenti Elettronici", amount: cashRegister.electronicPayments || 0 },
              { type: "Pagamento con Fattura", amount: cashRegister.invoicePayments || 0 },
            ],
        expenses: cashRegister.expenses && cashRegister.expenses.length > 0
          ? cashRegister.expenses.map(e => ({ description: e.description, amount: e.amount }))
          : [],
        notes: cashRegister.notes || "",
        status: cashRegister.status,
      };
      handleInitializeValues(formikValues);
      setTimeout(() => {
        formRef.current?.setStatus({
          formStatus: formStatuses.UPDATE,
          isFormLocked: cashRegister.status !== "DRAFT",
        });
      }, 0);
    } else if (!id) {
      // Initialize with today's date for new entry
      const newFormikValues: FormikCashRegisterValues = {
        date: currentDate,
        userId: user?.userId || 0,
        openingCounts: [],
        closingCounts: [],
        incomes: [
          { type: "Pago in Bianco (Contante)", amount: 0 },
          { type: "Pagamenti Elettronici", amount: 0 },
          { type: "Pagamento con Fattura", amount: 0 },
        ],
        expenses: [],
        notes: "",
        status: "DRAFT",
      };
      handleInitializeValues(newFormikValues);
      setTimeout(() => {
        formRef.current?.setStatus({
          formStatus: formStatuses.INSERT,
          isFormLocked: false,
        });
      }, 0);
    }
  }, [cashRegister, id, handleInitializeValues, currentDate, user?.userId]);

  const onSubmit = async (values: FormikCashRegisterValues) => {
    try {
      logger.log("onSubmit", values);

      // Converti gli array in campi singoli per il backend
      const input = {
        registerId: values.registerId,
        date: values.date,
        userId: values.userId,
        openingCounts: values.openingCounts,
        closingCounts: values.closingCounts,
        incomes: values.incomes,
        expenses: values.expenses,
        cashInWhite: values.incomes.find(i => i.type === "Pago in Bianco (Contante)")?.amount || 0,
        electronicPayments: values.incomes.find(i => i.type === "Pagamenti Elettronici")?.amount || 0,
        invoicePayments: values.incomes.find(i => i.type === "Pagamento con Fattura")?.amount || 0,
        supplierExpenses: 0, // Non più usato, calcolato dal backend
        dailyExpenses: 0, // Non più usato, calcolato dal backend
        notes: values.notes,
        status: values.status,
      };

      const result = await submitCashRegister({ cashRegister: input });

      if (result) {
        toast.success("Cassa salvata con successo!");
        if (!id) {
          navigate(`/gestionale/cassa/${result.registerId}`);
        }
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
      {({ status, isSubmitting, isValid }) => (
        <Form noValidate>
          <Box
            sx={{
              marginTop: 1,
              paddingX: { xs: 1, sm: 2 },
              paddingBottom: 3
            }}
          >
            <Box
              sx={{
                display: "flex",
                flexDirection: { xs: "column", sm: "row" },
                justifyContent: "space-between",
                alignItems: { xs: "stretch", sm: "center" },
                mb: 2,
                gap: { xs: 2, sm: 0 }
              }}
            >
              <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, alignItems: { xs: "flex-start", sm: "center" }, gap: { xs: 1, sm: 2 } }}>
                <Typography id="view-title" variant="h5" sx={{ fontSize: { xs: "1.5rem", sm: "1.5rem" } }}>
                  {title}
                </Typography>
                <Stack direction="row" alignItems="center" spacing={{ xs: 0.5, sm: 1 }}>
                  <IconButton size="medium" onClick={handlePreviousDay} title="Giorno precedente">
                    <ArrowBack />
                  </IconButton>
                  <Typography variant="h5" sx={{ minWidth: { xs: "100px", sm: "120px" }, textAlign: "center", fontSize: { xs: "1.5rem", sm: "1.5rem" } }}>
                    <span style={{ display: "inline-block", width: 120, textAlign: "center" }}>{getWeekdayName(currentDate)}</span>
                    {" - "}
                    {getFormattedDate(currentDate, "DD/MM/YYYY")}
                  </Typography>
                  <IconButton size="medium" onClick={handleNextDay} title="Giorno successivo">
                    <ArrowForward />
                  </IconButton>
                  <IconButton
                    size="medium"
                    onClick={handleOpenMonthlyCalendar}
                    title="Vista mensile"
                    color="primary"
                    sx={{ ml: { xs: 0.5, sm: 1 } }}
                  >
                    <CalendarMonthIcon />
                  </IconButton>
                </Stack>
              </Box>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: 1, sm: 2 }} alignItems="stretch" sx={{ width: { xs: "100%", sm: "auto" } }}>
                <Button
                  variant="contained"
                  color="primary"
                  type="submit"
                  disabled={isSubmitting || !isValid || status?.isFormLocked}
                  size="large"
                  sx={{ minHeight: { xs: "48px", sm: "36px" } }}
                >
                  Salva
                </Button>
                {status?.formStatus === formStatuses.UPDATE && status?.isFormLocked === false && (
                  <Button
                    variant="contained"
                    color="warning"
                    onClick={handleCloseCashRegister}
                    disabled={closing}
                    size="large"
                    sx={{ minHeight: { xs: "48px", sm: "36px" } }}
                  >
                    Chiudi Cassa
                  </Button>
                )}
              </Stack>
            </Box>
            <CashRegisterFormDataGrid denominations={denominations} cashRegister={cashRegister} />
          </Box>
        </Form>
      )}
    </Formik>
  );
}

export default CashRegisterDetails;
