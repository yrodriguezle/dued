import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { Form, Formik, FormikProps } from "formik";
import { z } from "zod";
import { Box, Typography, Button, IconButton, Stack } from "@mui/material";
import { ArrowBack, ArrowForward } from "@mui/icons-material";
import { useParams, useNavigate } from "react-router";

import CashRegisterForm from "./CashRegisterForm";
import logger from "../../../common/logger/logger";
import { formStatuses } from "../../../common/globals/constants";
import useInitializeValues from "./useInitializeValues";
import PageTitleContext from "../../layout/headerBar/PageTitleContext";
import useQueryDenominations from "../../../graphql/cashRegister/useQueryDenominations";
import useQueryCashRegister from "../../../graphql/cashRegister/useQueryCashRegister";
import useQueryCashRegisterByDate from "../../../graphql/cashRegister/useQueryCashRegisterByDate";
import useSubmitCashRegister from "../../../graphql/cashRegister/useSubmitCashRegister";
import useCloseCashRegister from "../../../graphql/cashRegister/useCloseCashRegister";
import useStore from "../../../store/useStore";
import { toast } from "react-toastify";
import { getCurrentDate, getFormattedDate } from "../../../common/date/date";

const CashCountSchema = z.object({
  denominationId: z.number(),
  quantity: z.number().min(0, "La quantità non può essere negativa"),
});

const Schema = z.object({
  registerId: z.number().optional(),
  date: z.string().nonempty("La data è obbligatoria"),
  userId: z.number(),
  openingCounts: z.array(CashCountSchema),
  closingCounts: z.array(CashCountSchema),
  supplierExpenses: z.number().min(0, "Le spese non possono essere negative"),
  dailyExpenses: z.number().min(0, "Le spese non possono essere negative"),
  notes: z.string(),
  status: z.enum(["DRAFT", "CLOSED", "RECONCILED"]),
});

export type FormikCashRegisterValues = z.infer<typeof Schema>;

function CashRegisterDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const formRef = useRef<FormikProps<FormikCashRegisterValues>>(null);
  const { title, setTitle } = useContext(PageTitleContext);
  const user = useStore((state) => state.user);
  const [currentDate, setCurrentDate] = useState<string>(getCurrentDate("YYYY-MM-DD"));

  const { initialValues, handleInitializeValues } = useInitializeValues({
    skipInitialize: false,
    userId: user?.userId || 0
  });

  const { denominations, loading: loadingDenominations } = useQueryDenominations();

  // Load by ID if provided (edit mode)
  const { cashRegister: cashRegisterById, loading: loadingCashRegisterById } = useQueryCashRegister({
    registerId: Number(id) || 0,
    skip: !id,
  });

  // Load by date if no ID (new/create mode)
  const { cashRegister: cashRegisterByDate, loading: loadingCashRegisterByDate } = useQueryCashRegisterByDate({
    date: currentDate,
    skip: !!id, // Only load by date when not editing an existing record
  });

  // Use appropriate cash register based on context
  const cashRegister = id ? cashRegisterById : cashRegisterByDate;
  const loadingCashRegister = id ? loadingCashRegisterById : loadingCashRegisterByDate;

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

  const { submitCashRegister } = useSubmitCashRegister();
  const { closeCashRegister, loading: closing } = useCloseCashRegister();

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
        openingCounts: cashRegister.openingCounts.map((c) => ({
          denominationId: c.denominationId,
          quantity: c.quantity,
        })),
        closingCounts: cashRegister.closingCounts.map((c) => ({
          denominationId: c.denominationId,
          quantity: c.quantity,
        })),
        supplierExpenses: cashRegister.supplierExpenses,
        dailyExpenses: cashRegister.dailyExpenses,
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
        supplierExpenses: 0,
        dailyExpenses: 0,
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

      const input = {
        registerId: values.registerId,
        date: values.date,
        userId: values.userId,
        openingCounts: values.openingCounts,
        closingCounts: values.closingCounts,
        supplierExpenses: values.supplierExpenses,
        dailyExpenses: values.dailyExpenses,
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
    return <Typography>Caricamento...</Typography>;
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
            className="scrollable-box"
            sx={{ marginTop: 1, paddingX: 2, overflow: "auto", height: "calc(100vh - 64px - 41px)" }}
          >
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <Typography id="view-title" variant="h5">
                  {title}
                </Typography>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <IconButton size="small" onClick={handlePreviousDay} title="Giorno precedente">
                    <ArrowBack fontSize="small" />
                  </IconButton>
                  <Typography variant="body2" sx={{ minWidth: "120px", textAlign: "center" }}>
                    {getFormattedDate(currentDate, "DD/MM/YYYY")}
                  </Typography>
                  <IconButton size="small" onClick={handleNextDay} title="Giorno successivo">
                    <ArrowForward fontSize="small" />
                  </IconButton>
                </Stack>
              </Box>
              <Stack direction="row" spacing={2} alignItems="center">
                <Button
                  variant="contained"
                  color="primary"
                  type="submit"
                  disabled={isSubmitting || !isValid || status?.isFormLocked}
                >
                  Salva
                </Button>
                {status?.formStatus === formStatuses.UPDATE && status?.isFormLocked === false && (
                  <Button
                    variant="contained"
                    color="warning"
                    onClick={handleCloseCashRegister}
                    disabled={closing}
                  >
                    Chiudi Cassa
                  </Button>
                )}
              </Stack>
            </Box>
            <CashRegisterForm denominations={denominations} cashRegister={cashRegister} />
          </Box>
        </Form>
      )}
    </Formik>
  );
}

export default CashRegisterDetails;
