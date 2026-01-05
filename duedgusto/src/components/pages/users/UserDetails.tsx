import { useCallback, useContext, useEffect, useRef } from "react";
import { Form, Formik, FormikProps } from "formik";
import { z } from "zod";
import Paper from "@mui/material/Paper";
import { toast } from "react-toastify";
import { useLocation } from "react-router";
import { useLazyQuery } from "@apollo/client";

import UserForm from "./UserForm";
import FormikToolbar from "../../common/form/toolbar/FormikToolbar";
import logger from "../../../common/logger/logger";
import { UserSearchbox } from "../../common/form/searchbox/searchboxOptions/userSearchboxOptions";
import { formStatuses } from "../../../common/globals/constants";
import useConfirm from "../../common/confirm/useConfirm";
import useInitializeValues from "./useInitializeValues";
import setInitialFocus from "./setInitialFocus";
import sleep from "../../../common/bones/sleep";
import { Box, Typography } from "@mui/material";
import PageTitleContext from "../../layout/headerBar/PageTitleContext";
import useSubmitUser from "../../../graphql/user/useSubmitUser";
import { getUserById } from "../../../graphql/user/queries";

const Schema = z.object({
  userId: z.number(),
  roleId: z.number().min(1, "L'utente deve avere un Ruolo"),
  roleName: z.string(),
  userName: z.string().nonempty("Nome utente è obbligatorio"),
  firstName: z.string().nonempty("Nome è obbligatorio"),
  lastName: z.string().nonempty("Cognome è obbligatorio"),
  description: z.string().optional(),
  disabled: z.boolean(),
  password: z.string().optional(),
  confirmPassword: z.string().optional(),
}).refine((data) => {
  // Se è un nuovo utente (userId === 0), la password è obbligatoria
  if (data.userId === 0 && !data.password) {
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
}, {
  message: "Le password devono coincidere e avere almeno 6 caratteri",
  path: ["confirmPassword"],
});

export type FormikUserValues = z.infer<typeof Schema>;

function UserDetails() {
  const formRef = useRef<FormikProps<FormikUserValues>>(null);
  const { title, setTitle } = useContext(PageTitleContext);
  const location = useLocation();
  const { initialValues, handleInitializeValues } = useInitializeValues({ skipInitialize: false });
  const { submitUser } = useSubmitUser();
  const [loadUser] = useLazyQuery(getUserById);

  const onConfirm = useConfirm();

  useEffect(() => {
    setTitle("Gestione utenti");
  }, [setTitle]);

  // Carica i dati dell'utente dall'URL
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const userIdParam = searchParams.get("userId");

    if (userIdParam) {
      const userId = parseInt(userIdParam, 10);
      if (!isNaN(userId)) {
        loadUser({ variables: { userId } }).then((result) => {
          if (result.data?.authentication?.user) {
            const user = result.data.authentication.user;
            const userValues: Partial<FormikUserValues> = {
              userId: user.userId,
              roleId: user.roleId,
              roleName: user.role?.roleName || "",
              userName: user.userName,
              firstName: user.firstName || "",
              lastName: user.lastName || "",
              description: user.description || "",
              disabled: user.disabled || false,
              password: "",
              confirmPassword: "",
            };

            handleInitializeValues(userValues).then(() => {
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
  }, [location.search, loadUser, handleInitializeValues]);

  const handleResetForm = useCallback(
    async (hasChanges: boolean) => {
      const confirmed = !hasChanges || await onConfirm({
        title: "Gestione utenti",
        content: "Sei sicuro di voler annullare le modifiche?",
        acceptLabel: "Si",
        cancelLabel: "No",
      });
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
    [handleInitializeValues, onConfirm],
  );

  const handleSelectedItem = useCallback((item: UserSearchbox) => {
    const itemsValues: Partial<FormikUserValues> = {
      userId: item.userId,
      roleId: item.roleId,
      userName: item.userName,
      firstName: item.firstName,
      lastName: item.lastName,
      description: item.description || "",
      disabled: item.disabled,
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
  }, [handleInitializeValues]);

  const onSubmit = async (values: FormikUserValues) => {
    try {
      logger.log("onSubmit", values);

      const input = {
        userId: values.userId || undefined,
        userName: values.userName,
        firstName: values.firstName,
        lastName: values.lastName,
        description: values.description || "",
        disabled: values.disabled,
        roleId: values.roleId,
        password: values.password || undefined,
      };

      const result = await submitUser({ user: input });

      if (result) {
        toast.success("Utente salvato con successo!");

        // Aggiorna il form con i dati salvati
        const updatedValues: FormikUserValues = {
          userId: result.userId,
          roleId: result.roleId,
          roleName: result.role?.roleName || "",
          userName: result.userName,
          firstName: result.firstName,
          lastName: result.lastName,
          description: result.description,
          disabled: result.disabled,
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
      validate={(values: FormikUserValues) => {
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
          <FormikToolbar
            onFormReset={handleResetForm}
          />
          <Box className="scrollable-box" sx={{ marginTop: 1, paddingX: 2, overflow: 'auto', height: 'calc(100vh - 64px - 41px)' }}>
            <Typography id="view-title" variant="h5" gutterBottom>
              {title}
            </Typography>
            <Paper sx={{ padding: 1 }}>
              <UserForm onSelectItem={handleSelectedItem} />
            </Paper>
          </Box>
        </Form>
      )}
    </Formik>
  );
}

export default UserDetails;
