import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { Form, Formik, FormikProps } from "formik";
import { z } from "zod";
import { Box, Typography, Button, IconButton, Stack } from "@mui/material";
import { ArrowBack, ArrowForward } from "@mui/icons-material";
import { useParams, useNavigate } from "react-router";

import CashRegisterForm from "./CashRegisterForm";
import FormikToolbar from "../../common/form/toolbar/FormikToolbar";
import logger from "../../../common/logger/logger";
import { formStatuses } from "../../../common/globals/constants";
import useConfirm from "../../common/confirm/useConfirm";
import useInitializeValues from "./useInitializeValues";
import setInitialFocus from "./setInitialFocus";
import sleep from "../../../common/bones/sleep";
import PageTitleContext from "../../layout/headerBar/PageTitleContext";
import useQueryDenominations from "../../../graphql/cashRegister/useQueryDenominations";
import useQueryCashRegister from "../../../graphql/cashRegister/useQueryCashRegister";
import useSubmitCashRegister from "../../../graphql/cashRegister/useSubmitCashRegister";
import useCloseCashRegister from "../../../graphql/cashRegister/useCloseCashRegister";
import useStore from "../../../store/useStore";
import { toast } from "react-toastify";

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
  const [currentDate, setCurrentDate] = React.useState<string>(dayjs().format("YYYY-MM-DD"));

  const { initialValues, handleInitializeValues } = useInitializeValues({
    skipInitialize: false,
    userId: user?.userId || 0
  });

  const { denominations, loading: loadingDenominations } = useQueryDenominations();

  // Load by ID if provided, otherwise by date
  const { cashRegister, loading: loadingCashRegister } = useQueryCashRegister({
    registerId: Number(id) || 0,
    skip: !id,
  });

  // When no ID, we'll load the cash register for the selected date
  // For now, we initialize with empty form for new entry
  const handlePreviousDay = useCallback(() => {
    setCurrentDate(dayjs(currentDate).subtract(1, "day").format("YYYY-MM-DD"));
  }, [currentDate]);

  const handleNextDay = useCallback(() => {
    setCurrentDate(dayjs(currentDate).add(1, "day").format("YYYY-MM-DD"));
  }, [currentDate]);

  const { submitCashRegister } = useSubmitCashRegister();
  const { closeCashRegister, loading: closing } = useCloseCashRegister();

  const onConfirm = useConfirm();

  useEffect(() => {
    setTitle("Gestione Cassa");
  }, [setTitle]);

  useEffect(() => {
    if (cashRegister && id) {
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
    }
  }, [cashRegister, id, handleInitializeValues]);

  const handleResetForm = useCallback(
    async (hasChanges: boolean) => {
      const confirmed = !hasChanges || await onConfirm({
        title: "Gestione Cassa",
        content: "Sei sicuro di voler annullare le modifiche?",
        acceptLabel: "Si",
        cancelLabel: "No",
      });
      if (!confirmed) {
        return;
      }
      if (formRef.current?.status.formStatus === formStatuses.UPDATE) {
        await handleInitializeValues();
      } else {
        formRef.current?.resetForm();
        await sleep(200);
        setInitialFocus();
      }
    },
    [handleInitializeValues, onConfirm]
  );

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
      {({ status }) => (
        <Form noValidate>
          <FormikToolbar onFormReset={handleResetForm} />
          <Box
            className="scrollable-box"
            sx={{ marginTop: 1, paddingX: 2, overflow: "auto", height: "calc(100vh - 64px - 41px)" }}
          >
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <Typography id="view-title" variant="h5">
                  {title}
                </Typography>
                {!id && (
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <IconButton size="small" onClick={handlePreviousDay} title="Giorno precedente">
                      <ArrowBack fontSize="small" />
                    </IconButton>
                    <Typography variant="body2" sx={{ minWidth: "120px", textAlign: "center" }}>
                      {dayjs(currentDate).format("DD/MM/YYYY")}
                    </Typography>
                    <IconButton size="small" onClick={handleNextDay} title="Giorno successivo">
                      <ArrowForward fontSize="small" />
                    </IconButton>
                  </Stack>
                )}
              </Box>
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
            </Box>
            <CashRegisterForm denominations={denominations} cashRegister={cashRegister} />
          </Box>
        </Form>
      )}
    </Formik>
  );
}

export default CashRegisterDetails;
