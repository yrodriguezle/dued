import { useCallback, useRef } from "react";
import { Form, Formik, FormikProps } from "formik";
import { z } from "zod";

import UserForm from "./UserForm";
import FormikToolbar from "../../common/form/toolbar/FormikToolbar";
import logger from "../../../common/logger/logger";
import { UserSearchbox } from "../../common/form/searchbox/searchboxOptions/userSearchboxOptions";
import { formStatuses } from "../../../common/globals/constants";
import useConfirm from "../../common/confirm/useConfirm";
import useInitializeValues from "./useInitializeValues";
import setInitialFocus from "./setInitialFocus";
import sleep from "../../../common/bones/sleep";

const Schema = z.object({
  userId: z.number(),
  roleId: z.number().min(1, "L'utente deve avere un Ruolo"),
  userName: z.string().nonempty("Nome utente è obbligatorio"),
  firstName: z.string().nonempty("Nome è obbligatorio"),
  lastName: z.string().nonempty("Cognome è obbligatorio"),
  description: z.string().optional(),
  disabled: z.boolean(),
});

export type FormikUserValues = z.infer<typeof Schema>;

function UserDetails() {
  const formRef = useRef<FormikProps<FormikUserValues>>(null);
  const { initialValues, handleInitializeValues } = useInitializeValues({ skipInitialize: false });

  const onConfirm = useConfirm();

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
    handleInitializeValues(item).then(() => {
      setTimeout(() => {
        formRef.current?.setStatus({
          formStatus: formStatuses.UPDATE,
          isFormLocked: true,
        });
      }, 0);
    });
  }, [handleInitializeValues]);

  const onSubmit = (values: FormikUserValues) => {
    logger.log("onSubmit", values);
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
          <UserForm onSelectItem={handleSelectedItem} />
        </Form>
      )}
    </Formik>
  );
}

export default UserDetails;
