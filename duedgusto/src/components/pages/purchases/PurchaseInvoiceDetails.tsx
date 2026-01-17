import { useCallback, useContext, useEffect, useRef } from "react";
import { Form, Formik, FormikProps } from "formik";
import { z } from "zod";
import Paper from "@mui/material/Paper";
import { toast } from "react-toastify";
import { useLocation, useNavigate } from "react-router";
import { useLazyQuery, useMutation } from "@apollo/client";
import { Box } from "@mui/material";

import PurchaseInvoiceForm from "./PurchaseInvoiceForm";
import FormikToolbar from "../../common/form/toolbar/FormikToolbar";
import { formStatuses } from "../../../common/globals/constants";
import useConfirm from "../../common/confirm/useConfirm";
import PageTitleContext from "../../layout/headerBar/PageTitleContext";
import { getPurchaseInvoice } from "../../../graphql/purchases/queries";
import { mutationMutatePurchaseInvoice } from "../../../graphql/purchases/mutations";

const Schema = z.object({
  invoiceId: z.number().optional(),
  supplierId: z.number({ required_error: "Fornitore è obbligatorio" }),
  invoiceNumber: z.string().nonempty("Numero fattura è obbligatorio"),
  invoiceDate: z.string().nonempty("Data fattura è obbligatoria"),
  dueDate: z.string().optional(),
  taxableAmount: z.number({ required_error: "Imponibile è obbligatorio" }).positive("Imponibile deve essere positivo"),
  vatRate: z.number({ required_error: "Aliquota IVA è obbligatoria" }).min(0).max(100),
  invoiceStatus: z.string().default("DA_PAGARE"),
  notes: z.string().optional(),
});

export type FormikPurchaseInvoiceValues = z.infer<typeof Schema>;

const initialValues: FormikPurchaseInvoiceValues = {
  invoiceId: undefined,
  supplierId: 0,
  invoiceNumber: "",
  invoiceDate: new Date().toISOString().split("T")[0],
  dueDate: "",
  taxableAmount: 0,
  vatRate: 22,
  invoiceStatus: "DA_PAGARE",
  notes: "",
};

function PurchaseInvoiceDetails() {
  const formRef = useRef<FormikProps<FormikPurchaseInvoiceValues>>(null);
  const { setTitle } = useContext(PageTitleContext);
  const location = useLocation();
  const navigate = useNavigate();
  const [loadInvoice] = useLazyQuery(getPurchaseInvoice);
  const [mutateInvoice] = useMutation(mutationMutatePurchaseInvoice);
  const onConfirm = useConfirm();

  useEffect(() => {
    setTitle("Dettaglio Fattura Acquisto");
  }, [setTitle]);

  // Carica i dati della fattura dall'URL
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const invoiceIdParam = searchParams.get("invoiceId");

    if (invoiceIdParam) {
      const invoiceId = parseInt(invoiceIdParam, 10);
      if (!isNaN(invoiceId)) {
        loadInvoice({ variables: { invoiceId } }).then((result) => {
          if (result.data?.suppliers?.purchaseInvoice) {
            const invoice = result.data.suppliers.purchaseInvoice;
            const invoiceValues: FormikPurchaseInvoiceValues = {
              invoiceId: invoice.invoiceId,
              supplierId: invoice.supplierId,
              invoiceNumber: invoice.invoiceNumber,
              invoiceDate: invoice.invoiceDate.split("T")[0],
              dueDate: invoice.dueDate ? invoice.dueDate.split("T")[0] : "",
              taxableAmount: invoice.taxableAmount,
              vatRate: invoice.vatAmount && invoice.taxableAmount
                ? Math.round((invoice.vatAmount / invoice.taxableAmount) * 100)
                : 22,
              invoiceStatus: invoice.invoiceStatus,
              notes: invoice.notes || "",
            };

            formRef.current?.setValues(invoiceValues);
            formRef.current?.setStatus({
              formStatus: formStatuses.UPDATE,
              isFormLocked: true,
            });
          }
        });
      }
    }
  }, [location.search, loadInvoice]);

  const handleResetForm = useCallback(
    async (hasChanges: boolean) => {
      const confirmed = !hasChanges || await onConfirm({
        title: "Gestione fatture acquisto",
        content: "Sei sicuro di voler annullare le modifiche?",
        acceptLabel: "Si",
        cancelLabel: "No",
      });
      if (!confirmed) {
        return;
      }

      if (formRef.current?.status.formStatus === formStatuses.UPDATE) {
        // Reload data from server
        const searchParams = new URLSearchParams(location.search);
        const invoiceIdParam = searchParams.get("invoiceId");
        if (invoiceIdParam) {
          const invoiceId = parseInt(invoiceIdParam, 10);
          const result = await loadInvoice({ variables: { invoiceId } });
          if (result.data?.suppliers?.purchaseInvoice) {
            const invoice = result.data.suppliers.purchaseInvoice;
            formRef.current?.setValues({
              invoiceId: invoice.invoiceId,
              supplierId: invoice.supplierId,
              invoiceNumber: invoice.invoiceNumber,
              invoiceDate: invoice.invoiceDate.split("T")[0],
              dueDate: invoice.dueDate ? invoice.dueDate.split("T")[0] : "",
              taxableAmount: invoice.taxableAmount,
              vatRate: invoice.vatAmount && invoice.taxableAmount
                ? Math.round((invoice.vatAmount / invoice.taxableAmount) * 100)
                : 22,
              invoiceStatus: invoice.invoiceStatus,
              notes: invoice.notes || "",
            });
          }
        }
      } else {
        formRef.current?.resetForm();
      }
    },
    [onConfirm, location.search, loadInvoice],
  );

  const handleSubmit = useCallback(
    async (values: FormikPurchaseInvoiceValues) => {
      try {
        const result = await mutateInvoice({
          variables: {
            invoice: {
              invoiceId: values.invoiceId,
              supplierId: values.supplierId,
              invoiceNumber: values.invoiceNumber,
              invoiceDate: values.invoiceDate,
              dueDate: values.dueDate || undefined,
              taxableAmount: values.taxableAmount,
              vatRate: values.vatRate,
              invoiceStatus: values.invoiceStatus,
              notes: values.notes || undefined,
            },
          },
        });

        if (result.data?.suppliers?.mutatePurchaseInvoice) {
          const invoice = result.data.suppliers.mutatePurchaseInvoice;

          toast.success("Fattura salvata con successo", {
            position: "bottom-right",
            autoClose: 2000,
          });

          // Se è una nuova fattura, naviga alla pagina di modifica
          if (!values.invoiceId) {
            navigate(`/gestionale/purchase-invoices-details?invoiceId=${invoice.invoiceId}`);
          } else {
            formRef.current?.setStatus({
              formStatus: formStatuses.UPDATE,
              isFormLocked: true,
            });
          }
        }
      } catch {
        toast.error("Errore durante il salvataggio della fattura", {
          position: "bottom-right",
          autoClose: 2000,
        });
      }
    },
    [mutateInvoice, navigate],
  );

  const validate = useCallback((values: FormikPurchaseInvoiceValues) => {
    try {
      Schema.parse(values);
      return {};
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            errors[err.path[0].toString()] = err.message;
          }
        });
        return errors;
      }
      return {};
    }
  }, []);

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Formik
        innerRef={formRef}
        initialValues={initialValues}
        validate={validate}
        onSubmit={handleSubmit}
        initialStatus={{ formStatus: formStatuses.INSERT, isFormLocked: false }}
      >
        {({ isSubmitting }) => (
          <Form style={{ height: "100%", display: "flex", flexDirection: "column" }}>
            <FormikToolbar
              onFormReset={handleResetForm}
              disabledSave={isSubmitting}
            />

            <Paper sx={{ flex: 1, overflow: "auto", mt: 2, p: 3 }}>
              <PurchaseInvoiceForm />
            </Paper>
          </Form>
        )}
      </Formik>
    </Box>
  );
}

export default PurchaseInvoiceDetails;
