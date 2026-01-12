import { useContext, useEffect, useRef, useCallback } from "react";
import { Box, CircularProgress, Container, Alert, Typography } from "@mui/material";
import { Formik, Form, FormikProps } from "formik";
import { z } from "zod";
import { toast } from "react-toastify";
import { useMutation } from "@apollo/client";

import PageTitleContext from "../../layout/headerBar/PageTitleContext";
import useGetBusinessSettings from "../../../graphql/settings/useGetBusinessSettings";
import BusinessSettingsForm from "./BusinessSettingsForm";
import FormikToolbar from "../../common/form/toolbar/FormikToolbar";
import useInitializeValues from "./useInitializeValues";
import { UPDATE_BUSINESS_SETTINGS } from "../../../graphql/settings/mutations";
import { formStatuses } from "../../../common/globals/constants";
import useConfirm from "../../common/confirm/useConfirm";

const validationSchema = z.object({
  businessName: z.string().min(2, "Nome attività troppo corto"),
  openingTime: z.string().regex(/^\d{2}:\d{2}$/, "Formato orario non valido (HH:mm)"),
  closingTime: z.string().regex(/^\d{2}:\d{2}$/, "Formato orario non valido (HH:mm)"),
  operatingDays: z.union([
    z.array(z.boolean()),
    z.string(),
  ]).refine((days) => {
    const arr = typeof days === "string" ? JSON.parse(days) : days;
    return arr.some((day: boolean) => day === true);
  }, {
    message: "Seleziona almeno un giorno di apertura",
  }),
  timezone: z.string(),
  currency: z.string(),
  vatRate: z.number().min(0, "IVA non può essere negativa").max(100, "IVA non può essere maggiore di 100"),
  settingsId: z.number().optional(),
  updatedAt: z.string().optional(),
  createdAt: z.string().optional(),
});

function SettingsDetails() {
  const { title, setTitle } = useContext(PageTitleContext);
  const { settings, loading, error } = useGetBusinessSettings();
  const formRef = useRef<FormikProps<BusinessSettings>>(null);
  const { initialValues, handleInitializeValues } = useInitializeValues({ skipInitialize: false });
  const onConfirm = useConfirm();

  const [updateMutation] = useMutation(UPDATE_BUSINESS_SETTINGS, {
    onCompleted: (data) => {
      const updated = data.settings.updateBusinessSettings;
      const parsed = {
        ...updated,
         operatingDays: typeof updated.operatingDays === "string" 
           ? JSON.parse(updated.operatingDays) 
           : updated.operatingDays,
      };
      
      handleInitializeValues(parsed).then(() => {
        formRef.current?.setStatus({
          formStatus: formStatuses.UPDATE,
          isFormLocked: true,
        });
      });
      toast.success("Impostazioni aggiornate con successo");
    },
    onError: (err) => {
      toast.error(err.message || "Errore durante il salvataggio");
    },
  });

  useEffect(() => {
    setTitle("Impostazioni");
  }, [setTitle]);

  useEffect(() => {
    if (settings) {
      handleInitializeValues(settings).then(() => {
        // Set form to locked/view mode initially after loading data
        setTimeout(() => {
             formRef.current?.setStatus({
            formStatus: formStatuses.UPDATE,
            isFormLocked: true,
          });
        }, 0);
      });
    }
  }, [settings, handleInitializeValues]);

  const handleResetForm = useCallback(
    async (hasChanges: boolean) => {
      const confirmed = !hasChanges || await onConfirm({
        title: "Impostazioni",
        content: "Sei sicuro di voler annullare le modifiche?",
        acceptLabel: "Si",
        cancelLabel: "No",
      });
      if (!confirmed) {
        return;
      }
       // If we have settings loaded, revert to them
       if (settings) {
         await handleInitializeValues(settings);
          formRef.current?.setStatus({
             formStatus: formStatuses.UPDATE,
             isFormLocked: true,
          });
       } else {
         formRef.current?.resetForm();
       }
    },
    [onConfirm, settings, handleInitializeValues]
  );

  const handleSubmit = useCallback(
    async (values: BusinessSettings) => {
      try {
        await updateMutation({
          variables: {
            input: {
              businessName: values.businessName,
              openingTime: values.openingTime.length === 5 ? `${values.openingTime}:00` : values.openingTime,
              closingTime: values.closingTime.length === 5 ? `${values.closingTime}:00` : values.closingTime,
              operatingDays: JSON.stringify(values.operatingDays),
              timezone: values.timezone,
              currency: values.currency,
              vatRate: Number(values.vatRate),
              updatedAt: values.updatedAt,
            },
          },
        });
      } catch (err) {
        // Error handling is done in mutation onError
      }
    },
    [updateMutation]
  );

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Container maxWidth="sm" sx={{ marginTop: 4 }}>
        <Alert severity="error">
          Errore nel caricamento delle impostazioni: {error.message}
        </Alert>
      </Container>
    );
  }
  
  // Validation function wrapper for Zod
   const validate = (values: BusinessSettings) => {
      const result = validationSchema.safeParse(values);
      if (result.success) return;
      
      const errors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
          errors[issue.path[0] as string] = issue.message;
      });
      return errors;
  };

  return (
    <Formik
      innerRef={formRef}
      initialValues={initialValues}
      enableReinitialize
      validate={validate}
      onSubmit={handleSubmit}
       initialStatus={{ formStatus: formStatuses.UPDATE, isFormLocked: true }}
    >
      {() => (
        <Form>
          <FormikToolbar 
            onFormReset={handleResetForm} 
            hideNewButton={true} 
            hideDeleteButton={true}
            permissions={{
                insertDenied: false,
                updateDenied: false,
                deleteDenied: true,
            }}
          />
          <Box className="scrollable-box" sx={{ marginTop: 1, paddingX: 2, overflow: 'auto', height: 'calc(100vh - 64px - 41px)' }}>
              <Typography id="view-title" variant="h5" gutterBottom>
                  {title}
              </Typography>
             <Box sx={{ paddingX: 1 }}>
                <BusinessSettingsForm />
            </Box>
          </Box>
        </Form>
      )}
    </Formik>
  );
}

export default SettingsDetails;
