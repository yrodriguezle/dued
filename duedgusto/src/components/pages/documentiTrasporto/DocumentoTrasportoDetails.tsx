import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { Form, Formik, FormikProps } from "formik";
import { z } from "zod";
import { toast } from "react-toastify";
import { useLocation, useNavigate } from "react-router";
import { useLazyQuery, useMutation } from "@apollo/client";
import { Box, Typography } from "@mui/material";

import DocumentoTrasportoForm from "./DocumentoTrasportoForm";
import FormikToolbar from "../../common/form/toolbar/FormikToolbar";
import { formStatuses } from "../../../common/globals/constants";
import useConfirm from "../../common/confirm/useConfirm";
import PageTitleContext from "../../layout/headerBar/PageTitleContext";
import { getDocumentoTrasporto } from "../../../graphql/fornitori/queries";
import { mutationMutateDocumentoTrasporto } from "../../../graphql/fornitori/mutations";
import useInitializeValues from "./useInitializeValues";
import setInitialFocus from "./setInitialFocus";
import sleep from "../../../common/bones/sleep";
import { FornitoreSearchbox } from "../../common/form/searchbox/searchboxOptions/fornitoreSearchboxOptions";
import { FatturaAcquistoSearchbox } from "../../common/form/searchbox/searchboxOptions/fatturaAcquistoSearchboxOptions";

const Schema = z.object({
  ddtId: z.number().optional(),
  fornitoreId: z.number({ required_error: "Fornitore obbligatorio" }),
  nomeFornitore: z.string().nonempty("Fornitore obbligatorio"),
  invoiceId: z.number().optional(),
  invoiceNumber: z.string().optional(),
  ddtNumber: z.string().nonempty("Numero DDT obbligatorio"),
  ddtDate: z.string().nonempty("Data DDT obbligatoria"),
  amount: z.number().min(0).optional(),
  notes: z.string().optional(),
});

export type FormikDocumentoTrasportoValues = z.infer<typeof Schema>;

const mapDdtToFormValues = (ddt: DocumentoTrasporto): Partial<FormikDocumentoTrasportoValues> => ({
  ddtId: ddt.ddtId,
  fornitoreId: ddt.fornitoreId,
  nomeFornitore: ddt.fornitore?.ragioneSociale ?? "",
  invoiceId: ddt.fatturaId ?? undefined,
  invoiceNumber: ddt.fattura?.numeroFattura ?? "",
  ddtNumber: ddt.numeroDdt,
  ddtDate: ddt.dataDdt ? ddt.dataDdt.split("T")[0] : "",
  amount: ddt.importo ?? 0,
  notes: ddt.note ?? "",
});

const mapFormValuesToInput = (values: FormikDocumentoTrasportoValues): DocumentoTrasportoInput => ({
  ddtId: values.ddtId,
  fornitoreId: values.fornitoreId,
  numeroDdt: values.ddtNumber,
  dataDdt: values.ddtDate,
  fatturaId: values.invoiceId,
  importo: values.amount || undefined,
  note: values.notes || undefined,
});

function DocumentoTrasportoDetails() {
  const formRef = useRef<FormikProps<FormikDocumentoTrasportoValues>>(null);
  const { title, setTitle } = useContext(PageTitleContext);
  const location = useLocation();
  const navigate = useNavigate();
  const [loadDocumentoTrasporto] = useLazyQuery(getDocumentoTrasporto);
  const [mutateDocumentoTrasporto] = useMutation(mutationMutateDocumentoTrasporto);
  const onConfirm = useConfirm();
  const { initialValues, handleInitializeValues } = useInitializeValues({ skipInitialize: false });
  const [payments, setPayments] = useState<PagamentoFornitore[]>([]);

  useEffect(() => {
    setTitle("Dettaglio DDT");
  }, [setTitle]);

  const loadDdtData = useCallback(
    async (ddtId: number) => {
      const result = await loadDocumentoTrasporto({ variables: { ddtId }, fetchPolicy: "network-only" });
      if (result.data?.fornitori?.documentoTrasporto) {
        const ddt = result.data.fornitori.documentoTrasporto;
        const ddtValues = mapDdtToFormValues(ddt);
        await handleInitializeValues(ddtValues);
        setPayments(ddt.pagamenti ?? []);
        setTimeout(() => {
          formRef.current?.setStatus({
            formStatus: formStatuses.UPDATE,
            isFormLocked: true,
          });
        }, 0);
      }
    },
    [loadDocumentoTrasporto, handleInitializeValues]
  );

  const handleRefreshPayments = useCallback(() => {
    const searchParams = new URLSearchParams(location.search);
    const ddtIdParam = searchParams.get("ddtId");
    if (ddtIdParam) {
      const ddtId = parseInt(ddtIdParam, 10);
      if (!isNaN(ddtId)) {
        loadDdtData(ddtId);
      }
    }
  }, [location.search, loadDdtData]);

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

  const handleSelectFornitore = useCallback((item: FornitoreSearchbox) => {
    formRef.current?.setFieldValue("fornitoreId", item.fornitoreId);
    formRef.current?.setFieldValue("nomeFornitore", item.ragioneSociale);
  }, []);

  const handleSelectInvoice = useCallback((item: FatturaAcquistoSearchbox) => {
    formRef.current?.setFieldValue("invoiceId", item.fatturaId);
    formRef.current?.setFieldValue("invoiceNumber", item.numeroFattura);
  }, []);

  const handleSubmit = useCallback(
    async (values: FormikDocumentoTrasportoValues) => {
      try {
        const result = await mutateDocumentoTrasporto({
          variables: {
            documentoTrasporto: mapFormValuesToInput(values),
          },
        });

        if (result.data?.fornitori?.mutateDocumentoTrasporto) {
          const ddt = result.data.fornitori.mutateDocumentoTrasporto;

          toast.success("DDT salvato con successo", {
            position: "bottom-right",
            autoClose: 2000,
          });

          if (!values.ddtId) {
            navigate(`/gestionale/documenti-trasporto-details?ddtId=${ddt.ddtId}`);
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
    [mutateDocumentoTrasporto, navigate, loadDdtData]
  );

  return (
    <Formik
      innerRef={formRef}
      enableReinitialize
      initialValues={initialValues}
      initialStatus={{ formStatus: formStatuses.INSERT, isFormLocked: false }}
      validate={(values: FormikDocumentoTrasportoValues) => {
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
            <DocumentoTrasportoForm
              onSelectFornitore={handleSelectFornitore}
              onSelectInvoice={handleSelectInvoice}
              payments={payments}
              onRefresh={handleRefreshPayments}
            />
          </Box>
        </Form>
      )}
    </Formik>
  );
}

export default DocumentoTrasportoDetails;
