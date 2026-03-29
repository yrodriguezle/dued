import { useCallback, useContext, useEffect, useRef } from "react";
import { Form, Formik, FormikProps } from "formik";
import { z } from "zod";

import { toast } from "react-toastify";
import { useLocation, useNavigate } from "react-router";
import { useLazyQuery, useMutation } from "@apollo/client";
import { Box, Typography } from "@mui/material";

import FornitoreForm from "./FornitoreForm";
import FormikToolbar from "../../common/form/toolbar/FormikToolbar";
import { formStatuses } from "../../../common/globals/constants";
import useConfirm from "../../common/confirm/useConfirm";
import PageTitleContext from "../../layout/headerBar/PageTitleContext";
import { getFornitore } from "../../../graphql/fornitori/queries";
import { mutationMutateFornitore } from "../../../graphql/fornitori/mutations";
import useInitializeValues from "./useInitializeValues";
import setInitialFocus from "./setInitialFocus";
import sleep from "../../../common/bones/sleep";
import { FornitoreSearchbox } from "../../common/form/searchbox/searchboxOptions/fornitoreSearchboxOptions";

const Schema = z.object({
  fornitoreId: z.number().optional(),
  ragioneSociale: z.string().nonempty("Ragione sociale è obbligatoria"),
  ragioneSociale2: z.string().optional(),
  partitaIva: z.string().optional(),
  codiceFiscale: z.string().optional(),
  email: z.string().email("Email non valida").optional().or(z.literal("")),
  telefono: z.string().optional(),
  indirizzo: z.string().optional(),
  citta: z.string().optional(),
  cap: z.string().optional(),
  provincia: z.string().optional(),
  paese: z.string().default("IT"),
  note: z.string().optional(),
  attivo: z.boolean().default(true),
  aliquotaIva: z.number().min(0).max(100).optional(),
});

export type FormikFornitoreValues = z.infer<typeof Schema>;

const mapFornitoreToFormValues = (fornitore: Fornitore): Partial<FormikFornitoreValues> => ({
  fornitoreId: fornitore.fornitoreId,
  ragioneSociale: fornitore.ragioneSociale,
  ragioneSociale2: fornitore.ragioneSociale2 || "",
  partitaIva: fornitore.partitaIva || "",
  codiceFiscale: fornitore.codiceFiscale || "",
  email: fornitore.email || "",
  telefono: fornitore.telefono || "",
  indirizzo: fornitore.indirizzo || "",
  citta: fornitore.citta || "",
  cap: fornitore.cap || "",
  provincia: fornitore.provincia || "",
  paese: fornitore.paese || "IT",
  note: fornitore.note || "",
  attivo: fornitore.attivo,
  aliquotaIva: fornitore.aliquotaIva ?? 22,
});

function FornitoreDetails() {
  const formRef = useRef<FormikProps<FormikFornitoreValues>>(null);
  const { title, setTitle } = useContext(PageTitleContext);
  const location = useLocation();
  const navigate = useNavigate();
  const [loadFornitore] = useLazyQuery(getFornitore);
  const [mutateFornitore] = useMutation(mutationMutateFornitore);
  const onConfirm = useConfirm();
  const { initialValues, handleInitializeValues } = useInitializeValues({ skipInitialize: false });

  useEffect(() => {
    setTitle("Dettaglio Fornitore");
  }, [setTitle]);

  // Carica i dati del fornitore dall'URL
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const fornitoreIdParam = searchParams.get("fornitoreId");

    if (fornitoreIdParam) {
      const fornitoreId = parseInt(fornitoreIdParam, 10);
      if (!isNaN(fornitoreId)) {
        loadFornitore({ variables: { fornitoreId } }).then((result) => {
          if (result.data?.fornitori?.fornitore) {
            const fornitoreValues = mapFornitoreToFormValues(result.data.fornitori.fornitore);
            handleInitializeValues(fornitoreValues).then(() => {
              setTimeout(() => {
                formRef.current?.setStatus({
                  formStatus: formStatuses.UPDATE,
                  isFormLocked: true,
                });
              }, 0);
            });
          }
        });
      }
    }
  }, [location.search, loadFornitore, handleInitializeValues]);

  const handleResetForm = useCallback(
    async (hasChanges: boolean) => {
      const confirmed =
        !hasChanges ||
        (await onConfirm({
          title: "Gestione fornitori",
          content: "Sei sicuro di voler annullare le modifiche?",
          acceptLabel: "Si",
          cancelLabel: "No",
        }));
      if (!confirmed) {
        return;
      }

      if (formRef.current?.status.formStatus === formStatuses.UPDATE) {
        // Reload data from server
        const searchParams = new URLSearchParams(location.search);
        const fornitoreIdParam = searchParams.get("fornitoreId");
        if (fornitoreIdParam) {
          const fornitoreId = parseInt(fornitoreIdParam, 10);
          const result = await loadFornitore({ variables: { fornitoreId } });
          if (result.data?.fornitori?.fornitore) {
            await handleInitializeValues(mapFornitoreToFormValues(result.data.fornitori.fornitore));
          }
        }
      } else {
        await handleInitializeValues();
        formRef.current?.resetForm();
        await sleep(200);
        setInitialFocus();
      }
    },
    [onConfirm, location.search, loadFornitore, handleInitializeValues]
  );

  const handleSelectedItem = useCallback(
    (item: FornitoreSearchbox) => {
      const fornitoreValues = mapFornitoreToFormValues(item);
      handleInitializeValues(fornitoreValues).then(() => {
        setTimeout(() => {
          formRef.current?.setStatus({
            formStatus: formStatuses.UPDATE,
            isFormLocked: true,
          });
        }, 0);
      });
    },
    [handleInitializeValues]
  );

  const handleSubmit = useCallback(
    async (values: FormikFornitoreValues) => {
      try {
        const result = await mutateFornitore({
          variables: {
            fornitore: {
              fornitoreId: values.fornitoreId,
              ragioneSociale: values.ragioneSociale,
              ragioneSociale2: values.ragioneSociale2 || undefined,
              partitaIva: values.partitaIva || undefined,
              codiceFiscale: values.codiceFiscale || undefined,
              email: values.email || undefined,
              telefono: values.telefono || undefined,
              indirizzo: values.indirizzo || undefined,
              citta: values.citta || undefined,
              cap: values.cap || undefined,
              provincia: values.provincia || undefined,
              paese: values.paese || "IT",
              note: values.note || undefined,
              attivo: values.attivo,
              aliquotaIva: values.aliquotaIva ?? 22,
            },
          },
        });

        if (result.data?.fornitori?.mutateFornitore) {
          const fornitore = result.data.fornitori.mutateFornitore;

          toast.success("Fornitore salvato con successo", {
            position: "bottom-right",
            autoClose: 2000,
          });

          // Se è un nuovo fornitore, naviga alla pagina di modifica
          if (!values.fornitoreId) {
            navigate(`/gestionale/fornitori-details?fornitoreId=${fornitore.fornitoreId}`);
          } else {
            const updatedValues = mapFornitoreToFormValues(fornitore);
            await handleInitializeValues(updatedValues);
            setTimeout(() => {
              formRef.current?.setStatus({
                formStatus: formStatuses.UPDATE,
                isFormLocked: true,
              });
            }, 0);
          }
        }
      } catch {
        toast.error("Errore durante il salvataggio del fornitore", {
          position: "bottom-right",
          autoClose: 2000,
        });
      }
    },
    [mutateFornitore, navigate, handleInitializeValues]
  );

  return (
    <Formik
      innerRef={formRef}
      enableReinitialize
      initialValues={initialValues}
      initialStatus={{ formStatus: formStatuses.INSERT, isFormLocked: false }}
      validate={(values: FormikFornitoreValues) => {
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
            <Box sx={{ maxWidth: 900 }}>
              <FornitoreForm onSelectItem={handleSelectedItem} />
            </Box>
          </Box>
        </Form>
      )}
    </Formik>
  );
}

export default FornitoreDetails;
