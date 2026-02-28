import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { Form, Formik, FormikProps } from "formik";
import { z } from "zod";
import { toast } from "react-toastify";
import { useLocation, useNavigate } from "react-router";
import { useLazyQuery, useMutation } from "@apollo/client";
import { Box, Typography } from "@mui/material";

import PurchaseInvoiceForm from "./PurchaseInvoiceForm";
import FormikToolbar from "../../common/form/toolbar/FormikToolbar";
import { formStatuses } from "../../../common/globals/constants";
import useConfirm from "../../common/confirm/useConfirm";
import PageTitleContext from "../../layout/headerBar/PageTitleContext";
import { getPurchaseInvoice } from "../../../graphql/suppliers/queries";
import { mutationMutatePurchaseInvoice } from "../../../graphql/suppliers/mutations";
import useInitializeValues from "./useInitializeValues";
import setInitialFocus from "./setInitialFocus";
import sleep from "../../../common/bones/sleep";
import { SupplierSearchbox } from "../../common/form/searchbox/searchboxOptions/supplierSearchboxOptions";
import { PurchaseInvoiceSearchbox } from "../../common/form/searchbox/searchboxOptions/purchaseInvoiceSearchboxOptions";

const Schema = z.object({
  invoiceId: z.number().optional(),
  supplierId: z.number({ required_error: "Fornitore obbligatorio" }),
  supplierName: z.string().nonempty("Fornitore obbligatorio"),
  invoiceNumber: z.string().nonempty("Numero fattura obbligatorio"),
  invoiceDate: z.string().nonempty("Data fattura obbligatoria"),
  dueDate: z.string().optional(),
  taxableAmount: z.number().min(0, "Importo non valido"),
  vatRate: z.number().min(0).max(100),
  notes: z.string().optional(),
  invoiceStatus: z.string().optional(),
});

export type FormikPurchaseInvoiceValues = z.infer<typeof Schema>;

const mapInvoiceToFormValues = (invoice: PurchaseInvoice): Partial<FormikPurchaseInvoiceValues> => ({
  invoiceId: invoice.invoiceId,
  supplierId: invoice.supplierId,
  supplierName: invoice.supplier?.businessName ?? "",
  invoiceNumber: invoice.invoiceNumber,
  invoiceDate: invoice.invoiceDate ? invoice.invoiceDate.split("T")[0] : "",
  dueDate: invoice.dueDate ? invoice.dueDate.split("T")[0] : "",
  taxableAmount: invoice.taxableAmount,
  vatRate: invoice.vatAmount != null && invoice.taxableAmount ? Math.round((invoice.vatAmount / invoice.taxableAmount) * 100 * 100) / 100 : 22,
  notes: invoice.notes ?? "",
  invoiceStatus: invoice.invoiceStatus,
});

const mapFormValuesToInput = (
  values: FormikPurchaseInvoiceValues
): {
  invoiceId?: number;
  supplierId: number;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string;
  taxableAmount: number;
  vatRate: number;
  notes?: string;
} => ({
  invoiceId: values.invoiceId,
  supplierId: values.supplierId,
  invoiceNumber: values.invoiceNumber,
  invoiceDate: values.invoiceDate,
  dueDate: values.dueDate || undefined,
  taxableAmount: values.taxableAmount,
  vatRate: values.vatRate,
  notes: values.notes || undefined,
});

function PurchaseInvoiceDetails() {
  const formRef = useRef<FormikProps<FormikPurchaseInvoiceValues>>(null);
  const { title, setTitle } = useContext(PageTitleContext);
  const location = useLocation();
  const navigate = useNavigate();
  const [loadInvoice] = useLazyQuery(getPurchaseInvoice);
  const [mutateInvoice] = useMutation(mutationMutatePurchaseInvoice);
  const onConfirm = useConfirm();
  const { initialValues, handleInitializeValues } = useInitializeValues({ skipInitialize: false });

  const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNote[]>([]);
  const [supplierPayments, setSupplierPayments] = useState<SupplierPayment[]>([]);

  useEffect(() => {
    setTitle("Dettaglio Fattura Acquisto");
  }, [setTitle]);

  const loadInvoiceData = useCallback(
    async (invoiceId: number) => {
      const result = await loadInvoice({ variables: { invoiceId }, fetchPolicy: "network-only" });
      if (result.data?.suppliers?.purchaseInvoice) {
        const invoice = result.data.suppliers.purchaseInvoice;
        const invoiceValues = mapInvoiceToFormValues(invoice);
        setDeliveryNotes(invoice.deliveryNotes ?? []);
        setSupplierPayments(invoice.payments ?? []);
        await handleInitializeValues(invoiceValues);
        setTimeout(() => {
          formRef.current?.setStatus({
            formStatus: formStatuses.UPDATE,
            isFormLocked: true,
          });
        }, 0);
      }
    },
    [loadInvoice, handleInitializeValues]
  );

  // Carica i dati della fattura dall'URL
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const invoiceIdParam = searchParams.get("invoiceId");

    if (invoiceIdParam) {
      const invoiceId = parseInt(invoiceIdParam, 10);
      if (!isNaN(invoiceId)) {
        loadInvoiceData(invoiceId);
      }
    }
  }, [location.search, loadInvoiceData]);

  const handleRefresh = useCallback(() => {
    const searchParams = new URLSearchParams(location.search);
    const invoiceIdParam = searchParams.get("invoiceId");
    if (invoiceIdParam) {
      const invoiceId = parseInt(invoiceIdParam, 10);
      if (!isNaN(invoiceId)) {
        loadInvoiceData(invoiceId);
      }
    }
  }, [location.search, loadInvoiceData]);

  const handleResetForm = useCallback(
    async (hasChanges: boolean) => {
      const confirmed =
        !hasChanges ||
        (await onConfirm({
          title: "Gestione fatture acquisto",
          content: "Sei sicuro di voler annullare le modifiche?",
          acceptLabel: "Si",
          cancelLabel: "No",
        }));
      if (!confirmed) {
        return;
      }

      if (formRef.current?.status.formStatus === formStatuses.UPDATE) {
        const searchParams = new URLSearchParams(location.search);
        const invoiceIdParam = searchParams.get("invoiceId");
        if (invoiceIdParam) {
          const invoiceId = parseInt(invoiceIdParam, 10);
          await loadInvoiceData(invoiceId);
        }
      } else {
        await handleInitializeValues();
        formRef.current?.resetForm();
        setDeliveryNotes([]);
        setSupplierPayments([]);
        await sleep(200);
        setInitialFocus();
      }
    },
    [onConfirm, location.search, loadInvoiceData, handleInitializeValues]
  );

  const handleSelectSupplier = useCallback((item: SupplierSearchbox) => {
    formRef.current?.setFieldValue("supplierId", item.supplierId);
    formRef.current?.setFieldValue("supplierName", item.businessName);
  }, []);

  const handleSelectInvoice = useCallback(
    (item: PurchaseInvoiceSearchbox) => {
      navigate(`/gestionale/purchase-invoices-details?invoiceId=${item.invoiceId}`);
    },
    [navigate]
  );

  const handleSubmit = useCallback(
    async (values: FormikPurchaseInvoiceValues) => {
      try {
        const result = await mutateInvoice({
          variables: {
            invoice: mapFormValuesToInput(values),
          },
        });

        if (result.data?.suppliers?.mutatePurchaseInvoice) {
          const invoice = result.data.suppliers.mutatePurchaseInvoice;

          toast.success("Fattura salvata con successo", {
            position: "bottom-right",
            autoClose: 2000,
          });

          if (!values.invoiceId) {
            navigate(`/gestionale/purchase-invoices-details?invoiceId=${invoice.invoiceId}`);
          } else {
            await loadInvoiceData(invoice.invoiceId);
          }
        }
      } catch {
        toast.error("Errore durante il salvataggio della fattura", {
          position: "bottom-right",
          autoClose: 2000,
        });
      }
    },
    [mutateInvoice, navigate, loadInvoiceData]
  );

  return (
    <Formik
      innerRef={formRef}
      enableReinitialize
      initialValues={initialValues}
      initialStatus={{ formStatus: formStatuses.INSERT, isFormLocked: false }}
      validate={(values: FormikPurchaseInvoiceValues) => {
        const result = Schema.safeParse(values);
        if (result.success) {
          return;
        }
        return Object.fromEntries(result.error.issues.map(({ path, message }) => [path[0], message]));
      }}
      onSubmit={handleSubmit}
    >
      {() => (
        <Form noValidate>
          <FormikToolbar onFormReset={handleResetForm} />
          <Box className="scrollable-box" sx={{ marginTop: 1, paddingX: 2, overflow: "auto", height: "calc(100vh - 64px - 41px)" }}>
            <Typography id="view-title" variant="h5" gutterBottom>
              {title}
            </Typography>
            <PurchaseInvoiceForm onSelectSupplier={handleSelectSupplier} onSelectInvoice={handleSelectInvoice} deliveryNotes={deliveryNotes} payments={supplierPayments} onRefresh={handleRefresh} />
          </Box>
        </Form>
      )}
    </Formik>
  );
}

export default PurchaseInvoiceDetails;
