import { Form, Formik, FormikHelpers } from "formik";
import { Box } from "@mui/system";
import { Button } from "@mui/material";
import { z } from "zod";

import FormikTextField from "../common/form/FormikTextField";
import FormikCheckbox from "../common/form/FormikCheckbox";

const Schema = z.object({
  username: z.string().min(1, { message: "Il nome utente è richiesto." }),
  password: z.string().min(1, { message: "La password è obbligatoria." }),
  alwaysConnected: z.boolean(),
});

export type AuthSignInValues = z.infer<typeof Schema>;

interface AuthSignInFormProps {
  onSubmit: (values: AuthSignInValues, formikHelpers: FormikHelpers<AuthSignInValues>) => void | Promise<unknown>;
}

function AuthSignInForm({ onSubmit }: AuthSignInFormProps) {
  return (
    <Formik
      enableReinitialize
      initialValues={{
        username: "",
        password: "",
        alwaysConnected: true,
      }}
      validate={(values) => {
        const result = Schema.safeParse(values);
        if (result.success) {
          return;
        }
        return Object.fromEntries(result.error.issues.map(({ path, message }) => [path[0], message]));
      }}
      onSubmit={onSubmit}
    >
      {({ isSubmitting }) => {
        return (
          <Form noValidate>
            <Box sx={{ mt: 1 }}>
              <FormikTextField label="Nome utente:" placeholder="Nome utente" name="username" margin="normal" autoComplete="off" autoFocus required fullWidth />
              <FormikTextField label="Password:" placeholder="Password" name="password" type="password" margin="normal" autoComplete="off" required fullWidth />
              <FormikCheckbox label="Rimani connesso" name="alwaysConnected" />
              <Button type="submit" fullWidth variant="contained" sx={{ mt: 2, mb: 2 }} disabled={isSubmitting}>
                Connetti
              </Button>
            </Box>
          </Form>
        );
      }}
    </Formik>
  );
}

export default AuthSignInForm;
