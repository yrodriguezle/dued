import { useCallback, useRef } from "react";
import { Form, Formik, FormikProps } from "formik";
import { toast } from "react-toastify";
import { useLazyQuery, useMutation } from "@apollo/client";
import { Box, Button, DialogActions, DialogContent, Typography } from "@mui/material";

import FornitoreForm from "./FornitoreForm";
import FormikToolbar from "../../common/form/toolbar/FormikToolbar";
import { formStatuses } from "../../../common/globals/constants";
import useConfirm from "../../common/confirm/useConfirm";
import { existsPartitaIva } from "../../../graphql/fornitori/queries";
import { mutationMutateFornitore } from "../../../graphql/fornitori/mutations";
import useInitializeValues from "./useInitializeValues";
import setInitialFocus from "./setInitialFocus";
import sleep from "../../../common/bones/sleep";
import { FornitoreSearchbox } from "../../common/form/searchbox/searchboxOptions/fornitoreSearchboxOptions";
import { Schema, FormikFornitoreValues, mapFornitoreToFormValues } from "./fornitoreFormSchema";

export type { FormikFornitoreValues } from "./fornitoreFormSchema";
export { mapFornitoreToFormValues } from "./fornitoreFormSchema";

interface PageModeProps {
  mode: "page";
  title?: string;
  onSelectItem: (item: FornitoreSearchbox) => void;
  onFormReset: (hasChanges: boolean) => Promise<void>;
  initialFornitoreValues?: Partial<FormikFornitoreValues>;
  initialFormStatus?: { formStatus: string; isFormLocked: boolean };
  onSaved?: never;
  onCancel?: never;
}

interface ModalModeProps {
  mode: "modal";
  onSaved: (item: FornitoreSearchbox) => void;
  onCancel: () => void;
  title?: never;
  onSelectItem?: never;
  onFormReset?: never;
  initialFornitoreValues?: never;
  initialFormStatus?: never;
}

type FornitoreFormContainerProps = PageModeProps | ModalModeProps;

function FornitoreFormContainer(props: FornitoreFormContainerProps) {
  const formRef = useRef<FormikProps<FormikFornitoreValues>>(null);
  const [checkPartitaIva] = useLazyQuery(existsPartitaIva, { fetchPolicy: "network-only" });
  const [mutateFornitore] = useMutation(mutationMutateFornitore);
  const onConfirm = useConfirm();
  const { initialValues, handleInitializeValues } = useInitializeValues({
    skipInitialize: props.mode === "page" && !!props.initialFornitoreValues,
  });

  // In page mode, apply initial values from parent when provided
  const effectiveInitialValues = props.mode === "page" && props.initialFornitoreValues
    ? { ...initialValues, ...props.initialFornitoreValues }
    : initialValues;

  const handleSubmit = useCallback(
    async (values: FormikFornitoreValues) => {
      try {
        if (values.partitaIva) {
          const pivaCheck = await checkPartitaIva({
            variables: {
              partitaIva: values.partitaIva,
              excludeFornitoreId: values.fornitoreId,
            },
          });
          if (pivaCheck.data?.fornitori?.existsPartitaIva) {
            toast.warning("Esiste già un fornitore con questa Partita IVA", {
              position: "bottom-right",
              autoClose: 3000,
            });
            return;
          }
        }

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

          if (props.mode === "modal") {
            props.onSaved(fornitore as unknown as FornitoreSearchbox);
            return;
          }

          // Page mode: update form state
          const updatedValues = mapFornitoreToFormValues(fornitore);
          await handleInitializeValues(updatedValues);
          setTimeout(() => {
            formRef.current?.setStatus({
              formStatus: formStatuses.UPDATE,
              isFormLocked: true,
            });
          }, 0);
        }
      } catch {
        toast.error("Errore durante il salvataggio del fornitore", {
          position: "bottom-right",
          autoClose: 2000,
        });
      }
    },
    [checkPartitaIva, mutateFornitore, handleInitializeValues, props]
  );

  const handleResetForm = useCallback(
    async (hasChanges: boolean) => {
      if (props.mode !== "page") return;

      const confirmed =
        !hasChanges ||
        (await onConfirm({
          title: "Gestione fornitori",
          content: "Sei sicuro di voler annullare le modifiche?",
          acceptLabel: "Si",
          cancelLabel: "No",
        }));
      if (!confirmed) return;

      if (props.onFormReset) {
        await props.onFormReset(hasChanges);
      } else {
        await handleInitializeValues();
        formRef.current?.resetForm();
        await sleep(200);
        setInitialFocus();
      }
    },
    [onConfirm, handleInitializeValues, props]
  );

  const handleSelectedItem = useCallback(
    (item: FornitoreSearchbox) => {
      if (props.mode !== "page" || !props.onSelectItem) return;

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
    [handleInitializeValues, props]
  );

  return (
    <Formik
      innerRef={formRef}
      enableReinitialize
      initialValues={effectiveInitialValues}
      initialStatus={
        props.mode === "page" && props.initialFormStatus
          ? props.initialFormStatus
          : { formStatus: formStatuses.INSERT, isFormLocked: props.mode === "modal" ? false : false }
      }
      validate={(values: FormikFornitoreValues) => {
        const result = Schema.safeParse(values);
        if (result.success) return;
        return Object.fromEntries(result.error.issues.map(({ path, message }) => [path[0], message]));
      }}
      onSubmit={handleSubmit}
    >
      {({ submitForm, isSubmitting }) => (
        <Form noValidate>
          {props.mode === "page" && (
            <>
              <FormikToolbar onFormReset={handleResetForm} />
              <Box
                className="scrollable-box"
                sx={{ marginTop: 1, paddingX: 2, py: 2, overflow: "auto", height: "calc(100dvh - 64px - 41px)" }}
              >
                {props.title && (
                  <Typography
                    id="view-title"
                    variant="h5"
                    gutterBottom
                  >
                    {props.title}
                  </Typography>
                )}
                <Box sx={{ maxWidth: 900 }}>
                  <FornitoreForm onSelectItem={handleSelectedItem} />
                </Box>
              </Box>
            </>
          )}
          {props.mode === "modal" && (
            <>
              <DialogContent>
                <Box sx={{ maxWidth: 900, pt: 1 }}>
                  <FornitoreForm
                    onSelectItem={() => {}}
                    createMode
                  />
                </Box>
              </DialogContent>
              <DialogActions>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={props.onCancel}
                >
                  Annulla
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  disabled={isSubmitting}
                  onClick={submitForm}
                >
                  Salva
                </Button>
              </DialogActions>
            </>
          )}
        </Form>
      )}
    </Formik>
  );
}

export default FornitoreFormContainer;
