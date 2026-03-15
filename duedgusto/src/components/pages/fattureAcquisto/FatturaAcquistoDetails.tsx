import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { Form, Formik, FormikProps } from "formik";
import { z } from "zod";
import { toast } from "react-toastify";
import { useLocation, useNavigate } from "react-router";
import { useLazyQuery, useMutation } from "@apollo/client";
import { Box, Typography } from "@mui/material";

import FatturaAcquistoForm from "./FatturaAcquistoForm";
import FormikToolbar from "../../common/form/toolbar/FormikToolbar";
import { formStatuses } from "../../../common/globals/constants";
import useConfirm from "../../common/confirm/useConfirm";
import PageTitleContext from "../../layout/headerBar/PageTitleContext";
import { getFatturaAcquisto } from "../../../graphql/fornitori/queries";
import { mutationMutateFatturaAcquisto } from "../../../graphql/fornitori/mutations";
import useInitializeValues from "./useInitializeValues";
import setInitialFocus from "./setInitialFocus";
import sleep from "../../../common/bones/sleep";
import { FornitoreSearchbox } from "../../common/form/searchbox/searchboxOptions/fornitoreSearchboxOptions";
import { FatturaAcquistoSearchbox } from "../../common/form/searchbox/searchboxOptions/fatturaAcquistoSearchboxOptions";

const Schema = z.object({
  invoiceId: z.number().optional(),
  fornitoreId: z.number({ required_error: "Fornitore obbligatorio" }),
  nomeFornitore: z.string().nonempty("Fornitore obbligatorio"),
  invoiceNumber: z.string().nonempty("Numero fattura obbligatorio"),
  invoiceDate: z.string().nonempty("Data fattura obbligatoria"),
  dueDate: z.string().optional(),
  taxableAmount: z.number().min(0, "Importo non valido"),
  vatRate: z.number().min(0).max(100),
  notes: z.string().optional(),
  invoiceStatus: z.string().optional(),
});

export type FormikFatturaAcquistoValues = z.infer<typeof Schema>;

const mapFatturaToFormValues = (invoice: FatturaAcquisto): Partial<FormikFatturaAcquistoValues> => ({
  invoiceId: invoice.fatturaId,
  fornitoreId: invoice.fornitoreId,
  nomeFornitore: invoice.fornitore?.ragioneSociale ?? "",
  invoiceNumber: invoice.numeroFattura,
  invoiceDate: invoice.dataFattura ? invoice.dataFattura.split("T")[0] : "",
  dueDate: invoice.dataScadenza ? invoice.dataScadenza.split("T")[0] : "",
  taxableAmount: invoice.imponibile,
  vatRate: invoice.importoIva != null && invoice.imponibile ? Math.round((invoice.importoIva / invoice.imponibile) * 100 * 100) / 100 : 22,
  notes: invoice.note ?? "",
  invoiceStatus: invoice.stato,
});

const mapFormValuesToInput = (
  values: FormikFatturaAcquistoValues
): FatturaAcquistoInput => ({
  fatturaId: values.invoiceId,
  fornitoreId: values.fornitoreId,
  numeroFattura: values.invoiceNumber,
  dataFattura: values.invoiceDate,
  dataScadenza: values.dueDate || undefined,
  imponibile: values.taxableAmount,
  aliquotaIva: values.vatRate,
  note: values.notes || undefined,
});

function FatturaAcquistoDetails() {
  const formRef = useRef<FormikProps<FormikFatturaAcquistoValues>>(null);
  const { title, setTitle } = useContext(PageTitleContext);
  const location = useLocation();
  const navigate = useNavigate();
  const [loadInvoice] = useLazyQuery(getFatturaAcquisto);
  const [mutateInvoice] = useMutation(mutationMutateFatturaAcquisto);
  const onConfirm = useConfirm();
  const { initialValues, handleInitializeValues } = useInitializeValues({ skipInitialize: false });

  const [documentiTrasporto, setDocumentiTrasporto] = useState<DocumentoTrasporto[]>([]);
  const [pagamentiFornitore, setPagamentiFornitore] = useState<PagamentoFornitore[]>([]);

  useEffect(() => {
    setTitle("Dettaglio Fattura Acquisto");
  }, [setTitle]);

  const loadInvoiceData = useCallback(
    async (invoiceId: number) => {
      const result = await loadInvoice({ variables: { fatturaId: invoiceId }, fetchPolicy: "network-only" });
      if (result.data?.fornitori?.fatturaAcquisto) {
        const invoice = result.data.fornitori.fatturaAcquisto;
        const invoiceValues = mapFatturaToFormValues(invoice);
        setDocumentiTrasporto(invoice.documentiTrasporto ?? []);
        setPagamentiFornitore(invoice.pagamenti ?? []);
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
        setDocumentiTrasporto([]);
        setPagamentiFornitore([]);
        await sleep(200);
        setInitialFocus();
      }
    },
    [onConfirm, location.search, loadInvoiceData, handleInitializeValues]
  );

  const handleSelectFornitore = useCallback((item: FornitoreSearchbox) => {
    formRef.current?.setFieldValue("fornitoreId", item.fornitoreId);
    formRef.current?.setFieldValue("nomeFornitore", item.ragioneSociale);
  }, []);

  const handleSelectInvoice = useCallback(
    (item: FatturaAcquistoSearchbox) => {
      navigate(`/gestionale/fatture-acquisto-details?invoiceId=${item.fatturaId}`);
    },
    [navigate]
  );

  const handleSubmit = useCallback(
    async (values: FormikFatturaAcquistoValues) => {
      try {
        const result = await mutateInvoice({
          variables: {
            fattura: mapFormValuesToInput(values),
          },
        });

        if (result.data?.fornitori?.mutateFatturaAcquisto) {
          const invoice = result.data.fornitori.mutateFatturaAcquisto;

          toast.success("Fattura salvata con successo", {
            position: "bottom-right",
            autoClose: 2000,
          });

          if (!values.invoiceId) {
            navigate(`/gestionale/fatture-acquisto-details?invoiceId=${invoice.fatturaId}`);
          } else {
            await loadInvoiceData(invoice.fatturaId);
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
      validate={(values: FormikFatturaAcquistoValues) => {
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
          <Box
            className="scrollable-box"
            sx={{ marginTop: 1, paddingX: 2, py: 2, overflow: "auto", height: "calc(100dvh - 64px - 41px)" }}
          >
            <Typography
              id="view-title"
              variant="h5"
              gutterBottom
            >
              {title}
            </Typography>
            <FatturaAcquistoForm
              onSelectFornitore={handleSelectFornitore}
              onSelectInvoice={handleSelectInvoice}
              documentiTrasporto={documentiTrasporto}
              payments={pagamentiFornitore}
              onRefresh={handleRefresh}
            />
          </Box>
        </Form>
      )}
    </Formik>
  );
}

export default FatturaAcquistoDetails;
