import { useCallback, useState } from "react";
import { useMutation } from "@apollo/client";
import { Box, Paper, Button, Typography, CircularProgress, Alert } from "@mui/material";
import { Formik, Form } from "formik";
import { z } from "zod";
import { toast } from "react-toastify";
import useStore from "../../../store/useStore";
import { UPDATE_BUSINESS_SETTINGS } from "../../../graphql/settings/mutations";
import OperatingHoursSection from "./OperatingHoursSection";
import OperatingDaysSection from "./OperatingDaysSection";

interface BusinessSettingsFormProps {
  initialSettings: BusinessSettings;
}

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

function BusinessSettingsForm({ initialSettings }: BusinessSettingsFormProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const setSettings = useStore((store) => store.setSettings);

  const [updateMutation, { loading: isMutating }] = useMutation(UPDATE_BUSINESS_SETTINGS, {
    onCompleted: (data) => {
      const updated = data.settings.updateBusinessSettings;
      const parsed = {
        ...updated,
        operatingDays: typeof updated.operatingDays === "string"
          ? JSON.parse(updated.operatingDays)
          : updated.operatingDays,
      };
      setSettings(parsed);
      setSubmitError(null);
      toast.success("Impostazioni aggiornate con successo");
    },
    onError: (error) => {
      const errorMessage = error.message || "Errore durante il salvataggio";
      setSubmitError(errorMessage);
      toast.error(errorMessage);
    },
  });

  const handleSubmit = useCallback(
    async (values: BusinessSettings) => {
      try {
        setSubmitError(null);
        await updateMutation({
          variables: {
            input: {
              businessName: values.businessName,
              openingTime: values.openingTime,
              closingTime: values.closingTime,
              operatingDays: JSON.stringify(values.operatingDays),
              timezone: values.timezone,
              currency: values.currency,
              vatRate: values.vatRate,
            },
          },
        });
      } catch (error) {
        const message = (error instanceof Error ? error.message : null) || "Errore sconosciuto";
        setSubmitError(message);
      }
    },
    [updateMutation]
  );

  return (
    <Paper elevation={2} sx={{ padding: 3, maxWidth: 900, margin: "0 auto" }}>
      <Typography variant="h5" sx={{ marginBottom: 3, fontWeight: "bold" }}>
        Impostazioni Attività
      </Typography>

      {submitError && (
        <Alert severity="error" sx={{ marginBottom: 2 }} onClose={() => setSubmitError(null)}>
          {submitError}
        </Alert>
      )}

      <Formik
        initialValues={initialSettings}
        validationSchema={validationSchema}
        onSubmit={handleSubmit}
        enableReinitialize
      >
        {({ isSubmitting, errors, touched, dirty }) => (
          <Form>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {/* Sezione Orari */}
              <OperatingHoursSection errors={errors as Record<string, string | undefined>} touched={touched as Record<string, boolean>} />

              {/* Sezione Giorni Operativi */}
              <OperatingDaysSection errors={errors as Record<string, string | undefined>} touched={touched as Record<string, boolean>} />

              {/* Pulsante Submit */}
              <Box sx={{ display: "flex", gap: 2, justifyContent: "flex-end" }}>
                <Button variant="outlined" color="primary" disabled={isSubmitting || !dirty}>
                  Annulla
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  disabled={isSubmitting || isMutating || !dirty}
                  startIcon={(isSubmitting || isMutating) && <CircularProgress size={20} />}
                >
                  {isSubmitting || isMutating ? "Salvataggio..." : "Salva Impostazioni"}
                </Button>
              </Box>
            </Box>
          </Form>
        )}
      </Formik>
    </Paper>
  );
}

export default BusinessSettingsForm;
