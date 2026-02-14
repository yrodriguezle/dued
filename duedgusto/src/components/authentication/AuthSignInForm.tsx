import { Form, Formik, FormikHelpers } from "formik";
import { Box, Button, InputAdornment } from "@mui/material";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import LoginIcon from "@mui/icons-material/Login";
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
      {({ isSubmitting }) => (
        <Form noValidate>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <FormikTextField
              label="Nome utente"
              placeholder="Inserisci il nome utente"
              name="username"
              autoComplete="off"
              autoFocus
              required
              fullWidth
              size="medium"
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <PersonOutlineIcon color="action" />
                    </InputAdornment>
                  ),
                },
              }}
            />
            <FormikTextField
              label="Password"
              placeholder="Inserisci la password"
              name="password"
              type="password"
              autoComplete="off"
              required
              fullWidth
              size="medium"
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockOutlinedIcon color="action" />
                    </InputAdornment>
                  ),
                },
              }}
            />
            <FormikCheckbox label="Rimani connesso" name="alwaysConnected" />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={isSubmitting}
              startIcon={<LoginIcon />}
              sx={{
                mt: 1,
                py: 1.2,
                fontWeight: 600,
                fontSize: "0.95rem",
                textTransform: "none",
                borderRadius: 2,
              }}
            >
              Accedi
            </Button>
          </Box>
        </Form>
      )}
    </Formik>
  );
}

export default AuthSignInForm;
