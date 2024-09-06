import { Box } from '@mui/system';
import { Formik } from 'formik';

function AuthSignInForm({ onSubmit }) {
  return (
    <Formik
      enableReinitialize
      initialValues={{
        username: '',
        password: '',
        alwaysConnected: true,
      }}
      validationSchema={Schema}
      onSubmit={onSubmit}
    >
      {({ handleSubmit }) => (
        <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 1 }}>
          <Box sx={{ mt: 1 }}>
            <FormikTextField
              label="Nome utente:"
              placeholder="Nome utente"
              name="username"
              margin="normal"
              autoComplete="off"
              autoFocus
              required
              fullWidth
            />
            <FormikTextField
              label="Password:"
              placeholder="Password"
              name="password"
              type="password"
              margin="normal"
              autoComplete="off"
              required
              fullWidth
            />
            <FormikCheckbox
              label="Rimani connesso"
              name="alwaysConnected"
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 2, mb: 2 }}
              disabled={isSubmitting}
            >
              Connetti
            </Button>
          </Box>
        </Box>
      )}
    </Formik>
  )
}

export default AuthSignInForm