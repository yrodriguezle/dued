import { useCallback, useContext, useEffect, useRef } from "react";
import { Form, Formik, FormikProps } from "formik";
import { z } from "zod";
import { toast } from "react-toastify";
import { useLocation, useNavigate } from "react-router";
import { useLazyQuery, useMutation } from "@apollo/client";
import { Box, Typography } from "@mui/material";

import DeliveryNoteForm from "./DeliveryNoteForm";
import FormikToolbar from "../../common/form/toolbar/FormikToolbar";
import { formStatuses } from "../../../common/globals/constants";
import useConfirm from "../../common/confirm/useConfirm";
import PageTitleContext from "../../layout/headerBar/PageTitleContext";
import { getDeliveryNote } from "../../../graphql/suppliers/queries";
import { mutationMutateDeliveryNote } from "../../../graphql/suppliers/mutations";
import useInitializeValues from "./useInitializeValues";
import setInitialFocus from "./setInitialFocus";
import sleep from "../../../common/bones/sleep";
import { SupplierSearchbox } from "../../common/form/searchbox/searchboxOptions/supplierSearchboxOptions";
import { PurchaseInvoiceSearchbox } from "../../common/form/searchbox/searchboxOptions/purchaseInvoiceSearchboxOptions";

const Schema = z.object({
  ddtId: z.number().optional(),
  supplierId: z.number({ required_error: "Fornitore obbligatorio" }),
  supplierName: z.string().nonempty("Fornitore obbligatorio"),
  invoiceId: z.number().optional(),
  invoiceNumber: z.string().optional(),
  ddtNumber: z.string().nonempty("Numero DDT obbligatorio"),
  ddtDate: z.string().nonempty("Data DDT obbligatoria"),
  amount: z.number().min(0).optional(),
  notes: z.string().optional(),
});

export type FormikDeliveryNoteValues = z.infer<typeof Schema>;

const mapDdtToFormValues = (ddt: DeliveryNote): Partial<FormikDeliveryNoteValues> => ({
  ddtId: ddt.ddtId,
  supplierId: ddt.supplierId,
  supplierName: ddt.supplier?.businessName ?? "",
  invoiceId: ddt.invoiceId ?? undefined,
  invoiceNumber: ddt.invoice?.invoiceNumber ?? "",
  ddtNumber: ddt.ddtNumber,
  ddtDate: ddt.ddtDate ? ddt.ddtDate.split("T")[0] : "",
  amount: ddt.amount ?? 0,
  notes: ddt.notes ?? "",
});

const mapFormValuesToInput = (values: FormikDeliveryNoteValues): DeliveryNoteInput => ({
  ddtId: values.ddtId,
  supplierId: values.supplierId,
  ddtNumber: values.ddtNumber,
  ddtDate: values.ddtDate,
  invoiceId: values.invoiceId,
  amount: values.amount || undefined,
  notes: values.notes || undefined,
});

function DeliveryNoteDetails() {
  const formRef = useRef<FormikProps<FormikDeliveryNoteValues>>(null);
  const { title, setTitle } = useContext(PageTitleContext);
  const location = useLocation();
  const navigate = useNavigate();
  const [loadDeliveryNote] = useLazyQuery(getDeliveryNote);
  const [mutateDeliveryNote] = useMutation(mutationMutateDeliveryNote);
  const onConfirm = useConfirm();
  const { initialValues, handleInitializeValues } = useInitializeValues({ skipInitialize: false });

  useEffect(() => {
    setTitle("Dettaglio DDT");
  }, [setTitle]);

  const loadDdtData = useCallback(
    async (ddtId: number) => {
      const result = await loadDeliveryNote({ variables: { ddtId }, fetchPolicy: "network-only" });
      if (result.data?.suppliers?.deliveryNote) {
        const ddt = result.data.suppliers.deliveryNote;
        const ddtValues = mapDdtToFormValues(ddt);
        await handleInitializeValues(ddtValues);
        setTimeout(() => {
          formRef.current?.setStatus({
            formStatus: formStatuses.UPDATE,
            isFormLocked: true,
          });
        }, 0);
      }
    },
    [loadDeliveryNote, handleInitializeValues]
  );

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const ddtIdParam = searchParams.get("ddtId");

    if (ddtIdParam) {
      const ddtId = parseInt(ddtIdParam, 10);
      if (!isNaN(ddtId)) {
        loadDdtData(ddtId);
      }
    }
  }, [location.search, loadDdtData]);

  const handleResetForm = useCallback(
    async (hasChanges: boolean) => {
      const confirmed =
        !hasChanges ||
        (await onConfirm({
          title: "Gestione DDT",
          content: "Sei sicuro di voler annullare le modifiche?",
          acceptLabel: "Si",
          cancelLabel: "No",
        }));
      if (!confirmed) {
        return;
      }

      if (formRef.current?.status.formStatus === formStatuses.UPDATE) {
        const searchParams = new URLSearchParams(location.search);
        const ddtIdParam = searchParams.get("ddtId");
        if (ddtIdParam) {
          const ddtId = parseInt(ddtIdParam, 10);
          await loadDdtData(ddtId);
        }
      } else {
        await handleInitializeValues();
        formRef.current?.resetForm();
        await sleep(200);
        setInitialFocus();
      }
    },
    [onConfirm, location.search, loadDdtData, handleInitializeValues]
  );

  const handleSelectSupplier = useCallback((item: SupplierSearchbox) => {
    formRef.current?.setFieldValue("supplierId", item.supplierId);
    formRef.current?.setFieldValue("supplierName", item.businessName);
  }, []);

  const handleSelectInvoice = useCallback((item: PurchaseInvoiceSearchbox) => {
    formRef.current?.setFieldValue("invoiceId", item.invoiceId);
    formRef.current?.setFieldValue("invoiceNumber", item.invoiceNumber);
  }, []);

  const handleSubmit = useCallback(
    async (values: FormikDeliveryNoteValues) => {
      try {
        const result = await mutateDeliveryNote({
          variables: {
            deliveryNote: mapFormValuesToInput(values),
          },
        });

        if (result.data?.suppliers?.mutateDeliveryNote) {
          const ddt = result.data.suppliers.mutateDeliveryNote;

          toast.success("DDT salvato con successo", {
            position: "bottom-right",
            autoClose: 2000,
          });

          if (!values.ddtId) {
            navigate(`/gestionale/delivery-notes-details?ddtId=${ddt.ddtId}`);
          } else {
            await loadDdtData(ddt.ddtId);
          }
        }
      } catch {
        toast.error("Errore durante il salvataggio del DDT", {
          position: "bottom-right",
          autoClose: 2000,
        });
      }
    },
    [mutateDeliveryNote, navigate, loadDdtData]
  );

  return (
    <Formik
      innerRef={formRef}
      enableReinitialize
      initialValues={initialValues}
      initialStatus={{ formStatus: formStatuses.INSERT, isFormLocked: false }}
      validate={(values: FormikDeliveryNoteValues) => {
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
            <DeliveryNoteForm onSelectSupplier={handleSelectSupplier} onSelectInvoice={handleSelectInvoice} />
          </Box>
        </Form>
      )}
    </Formik>
  );
}

export default DeliveryNoteDetails;
