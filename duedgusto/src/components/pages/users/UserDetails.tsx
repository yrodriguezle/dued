import { useCallback } from "react";
import { Form, Formik } from "formik";
import { z } from "zod";

import UserForm from "./userUiMutation/UserForm";
import FormikToolbar from "../../common/form/toolbar/FormikToolbar";
import logger from "../../../common/logger/logger";
import { UserSearchbox } from "../../common/form/searchbox/searchboxOptions/userSearchboxOptions";

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
  const initialValues: FormikUserValues = {
    userId: 0,
    roleId: 0,
    userName: "",
    firstName: "",
    lastName: "",
    description: "",
    disabled: false,
  };

  const handleSelectedItem = useCallback((item: UserSearchbox) => {
    logger.log(item);
  }, []);

  const validate = (values: FormikUserValues) => {
    const result = Schema.safeParse(values);
    if (result.success) {
      return;
    }
    return Object.fromEntries(result.error.issues.map(({ path, message }) => [path[0], message]));
  };

  const onSubmit = (values: FormikUserValues) => {
    logger.log("onSubmit", values);
  };

  return (
    <Formik enableReinitialize initialValues={initialValues} sta validate={validate} onSubmit={onSubmit}>
      {() => (
        <Form noValidate>
          <FormikToolbar />
          <UserForm onSelectItem={handleSelectedItem} />
        </Form>
      )}
    </Formik>
  );
}

export default UserDetails;
