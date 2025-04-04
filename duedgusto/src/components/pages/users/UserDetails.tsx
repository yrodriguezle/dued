/* eslint-disable @typescript-eslint/no-unused-vars */
import { Form, Formik } from "formik";
import { z } from "zod";

// import FormToolbar from "../../common/form/toolbar/FormToolbar";
import UserForm from "./userUiMutation/UserForm";
import FormikToolbar from "../../common/form/toolbar/FormikToolbar";

type FormikUserValues = Exclude<User, null>;

const Schema = z.object({
  userId: z.number(),
  roleId: z.number().min(1, "L'utente deve avere un Ruolo"),
  userName: z.string().nonempty("Nome utente è obbligatorio"),
  firstName: z.string().nonempty("Nome è obbligatorio"),
  lastName: z.string().nonempty("Cognome è obbligatorio"),
  description: z.string().optional(),
  disabled: z.boolean(),
});

function UserDetails() {
  return (
    <Formik initialValues={{ nome: "" }} onSubmit={(values) => console.log(values)}>
      {() => (
        <Form noValidate>
          <FormikToolbar />
          <UserForm />
        </Form>
      )}
    </Formik>
  );
}

export default UserDetails;
