import { useContext, useEffect, useRef, useCallback, useMemo } from "react";
import { Box, Paper, Typography, Avatar, Chip, CircularProgress, Alert, Container } from "@mui/material";
import { Formik, Form, FormikProps } from "formik";
import { z } from "zod";
import { toast } from "react-toastify";
import { useMutation } from "@apollo/client";

import PageTitleContext from "../../layout/headerBar/PageTitleContext";
import useStore from "../../../store/useStore";
import FormikToolbar from "../../common/form/toolbar/FormikToolbar";
import FormikTextField from "../../common/form/FormikTextField";
import { mutationSubmitUtente } from "../../../graphql/utente/mutations";
import { formStatuses } from "../../../common/globals/constants";
import useQueryLoggedUser from "../../../graphql/utente/useQueryLoggedUser";

const profileSchema = z
  .object({
    id: z.number(),
    nomeUtente: z.string().nonempty("Nome utente è obbligatorio"),
    nome: z.string().nonempty("Nome è obbligatorio"),
    cognome: z.string().nonempty("Cognome è obbligatorio"),
    descrizione: z.string().optional(),
    ruoloId: z.number(),
    disabilitato: z.boolean(),
    password: z.string().optional(),
    confirmPassword: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.password && data.password.length < 6) return false;
      if (data.password !== data.confirmPassword) return false;
      return true;
    },
    {
      message: "Le password devono coincidere e avere almeno 6 caratteri",
      path: ["confirmPassword"],
    }
  );

type ProfileFormValues = z.infer<typeof profileSchema>;

function ProfilePage() {
  const { setTitle } = useContext(PageTitleContext);
  const utente = useStore((state) => state.utente);
  const receiveUtente = useStore((state) => state.receiveUtente);
  const { loading, error, refetch } = useQueryLoggedUser();
  const formRef = useRef<FormikProps<ProfileFormValues>>(null);

  const [updateMutation] = useMutation(mutationSubmitUtente, {
    onCompleted: (data) => {
      const updated = data.authentication.mutateUtente;
      if (updated) {
        receiveUtente(updated);
      }
      refetch();
      toast.success("Profilo aggiornato con successo");
    },
    onError: (err) => {
      toast.error(err.message || "Errore durante il salvataggio");
    },
  });

  useEffect(() => {
    setTitle("Il mio profilo");
  }, [setTitle]);

  const initialValues: ProfileFormValues = useMemo(
    () => ({
      id: utente?.id ?? 0,
      nomeUtente: utente?.nomeUtente ?? "",
      nome: utente?.nome ?? "",
      cognome: utente?.cognome ?? "",
      descrizione: utente?.descrizione ?? "",
      ruoloId: utente?.ruoloId ?? 0,
      disabilitato: utente?.disabilitato ?? false,
      password: "",
      confirmPassword: "",
    }),
    [utente]
  );

  const initials = useMemo(() => {
    const n = utente?.nome?.[0] ?? "";
    const c = utente?.cognome?.[0] ?? "";
    return (n + c).toUpperCase() || "?";
  }, [utente]);

  const handleSubmit = useCallback(
    async (values: ProfileFormValues) => {
      await updateMutation({
        variables: {
          utente: {
            id: values.id,
            nomeUtente: values.nomeUtente,
            nome: values.nome,
            cognome: values.cognome,
            descrizione: values.descrizione || "",
            disabilitato: values.disabilitato,
            ruoloId: values.ruoloId,
            password: values.password || undefined,
          },
        },
      });
      formRef.current?.setFieldValue("password", "");
      formRef.current?.setFieldValue("confirmPassword", "");
      formRef.current?.setStatus({
        formStatus: formStatuses.UPDATE,
        isFormLocked: false,
      });
    },
    [updateMutation]
  );

  const validate = useCallback((values: ProfileFormValues) => {
    const result = profileSchema.safeParse(values);
    if (result.success) return;
    const errors: Record<string, string> = {};
    result.error.issues.forEach((issue) => {
      errors[issue.path[0] as string] = issue.message;
    });
    return errors;
  }, []);

  if (loading && !utente) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100dvh" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error && !utente) {
    return (
      <Container
        maxWidth="sm"
        sx={{ marginTop: 4 }}
      >
        <Alert severity="error">Errore nel caricamento del profilo: {error.message}</Alert>
      </Container>
    );
  }

  return (
    <Formik
      innerRef={formRef}
      initialValues={initialValues}
      enableReinitialize
      validate={validate}
      onSubmit={handleSubmit}
      initialStatus={{ formStatus: formStatuses.UPDATE, isFormLocked: false }}
    >
      {() => (
        <Form style={{ display: "flex", flexDirection: "column", height: "calc(100dvh - 48px)" }}>
          <FormikToolbar
            hideUnlockButton
            hideNewButton
            hideDeleteButton
            permissions={{
              insertDenied: false,
              updateDenied: false,
              deleteDenied: true,
            }}
          />
          <Box sx={{ flex: 1, overflow: "auto", minHeight: 0, px: 2, py: 2 }}>
            <Box sx={{ maxWidth: 720 }}>
              {/* Header identità utente */}
              <Paper
                variant="outlined"
                sx={{
                  p: 3,
                  mb: 2.5,
                  display: "flex",
                  alignItems: "center",
                  gap: 2.5,
                }}
              >
                <Avatar
                  sx={{
                    width: 64,
                    height: 64,
                    bgcolor: "primary.main",
                    color: "primary.contrastText",
                    fontSize: "1.5rem",
                    fontWeight: 700,
                    letterSpacing: "-0.02em",
                  }}
                >
                  {initials}
                </Avatar>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography
                    variant="h6"
                    fontWeight={600}
                    noWrap
                  >
                    {utente?.nome} {utente?.cognome}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    noWrap
                  >
                    @{utente?.nomeUtente}
                  </Typography>
                  <Chip
                    label={utente?.ruolo?.nome ?? "—"}
                    size="small"
                    variant="outlined"
                    sx={{ mt: 0.5 }}
                  />
                </Box>
              </Paper>

              {/* Sezione: Dati Personali */}
              <Paper
                variant="outlined"
                sx={{ p: 2.5, mb: 2.5 }}
              >
                <Typography
                  variant="subtitle1"
                  fontWeight={600}
                  sx={{ mb: 2 }}
                >
                  Dati Personali
                </Typography>
                <div className="grid grid-cols-12 gap-4">
                  <div className="col-span-12 md:col-span-6">
                    <FormikTextField
                      label="Nome utente"
                      name="nomeUtente"
                      autoComplete="off"
                      fullWidth
                      disabled
                    />
                  </div>
                  <div className="col-span-12 md:col-span-6" />
                  <div className="col-span-12 md:col-span-6">
                    <FormikTextField
                      label="Nome *"
                      placeholder="Nome"
                      name="nome"
                      autoComplete="off"
                      required
                      fullWidth
                    />
                  </div>
                  <div className="col-span-12 md:col-span-6">
                    <FormikTextField
                      label="Cognome *"
                      placeholder="Cognome"
                      name="cognome"
                      autoComplete="off"
                      required
                      fullWidth
                    />
                  </div>
                  <div className="col-span-12">
                    <FormikTextField
                      label="Descrizione"
                      placeholder="Descrizione"
                      name="descrizione"
                      autoComplete="off"
                      fullWidth
                    />
                  </div>
                </div>
              </Paper>

              {/* Sezione: Cambio Password */}
              <Paper
                variant="outlined"
                sx={{ p: 2.5, mb: 2.5 }}
              >
                <Typography
                  variant="subtitle1"
                  fontWeight={600}
                  sx={{ mb: 1 }}
                >
                  Cambio Password
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 2 }}
                >
                  Lascia i campi vuoti per mantenere la password attuale.
                </Typography>
                <div className="grid grid-cols-12 gap-4">
                  <div className="col-span-12 md:col-span-6">
                    <FormikTextField
                      label="Nuova Password"
                      placeholder="Nuova password"
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      fullWidth
                    />
                  </div>
                  <div className="col-span-12 md:col-span-6">
                    <FormikTextField
                      label="Conferma Nuova Password"
                      placeholder="Conferma password"
                      name="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      fullWidth
                    />
                  </div>
                </div>
              </Paper>

            </Box>
          </Box>
        </Form>
      )}
    </Formik>
  );
}

export default ProfilePage;
