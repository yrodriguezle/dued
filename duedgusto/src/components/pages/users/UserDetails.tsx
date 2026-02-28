import { useCallback, useContext, useEffect, useRef } from "react";
import { Form, Formik, FormikProps } from "formik";
import { z } from "zod";
import { toast } from "react-toastify";
import { useLocation } from "react-router";
import { useLazyQuery } from "@apollo/client";

import UserForm from "./UserForm";
import FormikToolbar from "../../common/form/toolbar/FormikToolbar";
import logger from "../../../common/logger/logger";
import { UtenteSearchbox } from "../../common/form/searchbox/searchboxOptions/utenteSearchboxOptions";
import { formStatuses } from "../../../common/globals/constants";
import useConfirm from "../../common/confirm/useConfirm";
import useInitializeValues from "./useInitializeValues";
import setInitialFocus from "./setInitialFocus";
import sleep from "../../../common/bones/sleep";
import { Box, Typography } from "@mui/material";
import PageTitleContext from "../../layout/headerBar/PageTitleContext";
import useSubmitUtente from "../../../graphql/utente/useSubmitUser";
import { getUtentePerId } from "../../../graphql/utente/queries";

const Schema = z
  .object({
    id: z.number(),
    ruoloId: z.number().min(1, "L'utente deve avere un Ruolo"),
    ruoloNome: z.string(),
    nomeUtente: z.string().nonempty("Nome utente è obbligatorio"),
    nome: z.string().nonempty("Nome è obbligatorio"),
    cognome: z.string().nonempty("Cognome è obbligatorio"),
    descrizione: z.string().optional(),
    disabilitato: z.boolean(),
    password: z.string().optional(),
    confirmPassword: z.string().optional(),
  })
  .refine(
    (data) => {
      // Se è un nuovo utente (id === 0), la password è obbligatoria
      if (data.id === 0 && !data.password) {
        return false;
      }
      // Se la password è fornita, deve essere almeno 6 caratteri
      if (data.password && data.password.length < 6) {
        return false;
      }
      // Password e conferma devono coincidere
      if (data.password !== data.confirmPassword) {
        return false;
      }
      return true;
    },
    {
      message: "Le password devono coincidere e avere almeno 6 caratteri",
      path: ["confirmPassword"],
    }
  );

export type FormikUtenteValues = z.infer<typeof Schema>;

function UserDetails() {
  const formRef = useRef<FormikProps<FormikUtenteValues>>(null);
  const { title, setTitle } = useContext(PageTitleContext);
  const location = useLocation();
  const { initialValues, handleInitializeValues } = useInitializeValues({ skipInitialize: false });
  const { submitUtente } = useSubmitUtente();
  const [loadUtente] = useLazyQuery(getUtentePerId);

  const onConfirm = useConfirm();

  useEffect(() => {
    setTitle("Gestione utenti");
  }, [setTitle]);

  // Carica i dati dell'utente dall'URL
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const utenteIdParam = searchParams.get("utenteId");

    if (utenteIdParam) {
      const id = parseInt(utenteIdParam, 10);
      if (!isNaN(id)) {
        loadUtente({ variables: { id } }).then((result) => {
          if (result.data?.authentication?.utente) {
            const utente = result.data.authentication.utente;
            const utenteValues: Partial<FormikUtenteValues> = {
              id: utente.id,
              ruoloId: utente.ruoloId,
              ruoloNome: utente.ruolo?.nome || "",
              nomeUtente: utente.nomeUtente,
              nome: utente.nome || "",
              cognome: utente.cognome || "",
              descrizione: utente.descrizione || "",
              disabilitato: utente.disabilitato || false,
              password: "",
              confirmPassword: "",
            };

            handleInitializeValues(utenteValues).then(() => {
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
  }, [location.search, loadUtente, handleInitializeValues]);

  const handleResetForm = useCallback(
    async (hasChanges: boolean) => {
      const confirmed =
        !hasChanges ||
        (await onConfirm({
          title: "Gestione utenti",
          content: "Sei sicuro di voler annullare le modifiche?",
          acceptLabel: "Si",
          cancelLabel: "No",
        }));
      if (!confirmed) {
        return;
      }
      if (formRef.current?.status.formStatus === formStatuses.UPDATE) {
        await handleInitializeValues();
      } else {
        formRef.current?.resetForm();
        await sleep(200);
        setInitialFocus();
      }
    },
    [handleInitializeValues, onConfirm]
  );

  const handleSelectedItem = useCallback(
    (item: UtenteSearchbox) => {
      const itemsValues: Partial<FormikUtenteValues> = {
        id: item.id,
        ruoloId: item.ruoloId,
        nomeUtente: item.nomeUtente,
        nome: item.nome,
        cognome: item.cognome,
        descrizione: item.descrizione || "",
        disabilitato: item.disabilitato,
        password: "",
        confirmPassword: "",
      };

      handleInitializeValues(itemsValues).then(() => {
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

  const onSubmit = async (values: FormikUtenteValues) => {
    try {
      logger.log("onSubmit", values);

      const input = {
        id: values.id || undefined,
        nomeUtente: values.nomeUtente,
        nome: values.nome,
        cognome: values.cognome,
        descrizione: values.descrizione || "",
        disabilitato: values.disabilitato,
        ruoloId: values.ruoloId,
        password: values.password || undefined,
      };

      const result = await submitUtente({ utente: input });

      if (result) {
        toast.success("Utente salvato con successo!");

        // Aggiorna il form con i dati salvati
        const updatedValues: FormikUtenteValues = {
          id: result.id,
          ruoloId: result.ruoloId,
          ruoloNome: result.ruolo?.nome || "",
          nomeUtente: result.nomeUtente,
          nome: result.nome,
          cognome: result.cognome,
          descrizione: result.descrizione,
          disabilitato: result.disabilitato,
          password: "",
          confirmPassword: "",
        };

        await handleInitializeValues(updatedValues);

        setTimeout(() => {
          formRef.current?.setStatus({
            formStatus: formStatuses.UPDATE,
            isFormLocked: false,
          });
        }, 0);
      }
    } catch (error) {
      logger.error("Errore durante il salvataggio:", error);
      toast.error("Errore durante il salvataggio dell'utente");
    }
  };

  return (
    <Formik
      innerRef={formRef}
      enableReinitialize
      initialValues={initialValues}
      initialStatus={{ formStatus: formStatuses.INSERT, isFormLocked: false }}
      validate={(values: FormikUtenteValues) => {
        const result = Schema.safeParse(values);
        if (result.success) {
          return;
        }
        return Object.fromEntries(result.error.issues.map(({ path, message }) => [path[0], message]));
      }}
      onSubmit={onSubmit}
    >
      {() => (
        <Form noValidate>
          <FormikToolbar onFormReset={handleResetForm} />
          <Box className="scrollable-box" sx={{ marginTop: 1, paddingX: 2, overflow: "auto", height: "calc(100vh - 64px - 41px)" }}>
            <Typography id="view-title" variant="h5" gutterBottom>
              {title}
            </Typography>
            <UserForm onSelectItem={handleSelectedItem} />
          </Box>
        </Form>
      )}
    </Formik>
  );
}

export default UserDetails;
