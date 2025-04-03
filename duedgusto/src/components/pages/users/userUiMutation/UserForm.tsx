import { Switch, FormControlLabel, Box } from "@mui/material";
import { useFormikContext } from "formik";
import FormikTextField from "../../../common/form/FormikTextField";

type FormikUserValues = Exclude<User, null>;

// const roles: Role[] = [];

function UserForm() {
  const formik = useFormikContext<FormikUserValues>();
  return (
    <Box sx={{ paddingX: 5 }}>
      <FormikTextField label="Nome utente:" placeholder="Nome utente" name="username" margin="normal" autoComplete="off" autoFocus required fullWidth />
      <FormikTextField label="Nome:" placeholder="Nome" name="firstName" margin="normal" autoComplete="off" required fullWidth />
      <FormikTextField label="Cognome:" placeholder="Cognome" name="lastName" margin="normal" autoComplete="off" required fullWidth />
      <FormikTextField label="Descrizione:" placeholder="Descrizione" name="description" margin="normal" autoComplete="off" required fullWidth />
      <FormControlLabel control={<Switch id="disabled" name="disabled" checked={formik.values.disabled} onChange={formik.handleChange} color="primary" />} label="Disabilitato" />
      {/* <Box mt={1}>
        <Select fullWidth id="roleId" name="roleId" value={formik.values.roleId} onChange={formik.handleChange} displayEmpty>
          <MenuItem value={0}>
            <em>Seleziona Ruolo</em>
          </MenuItem>
          {roles.map((role) =>
            role ? (
              <MenuItem key={role.roleId} value={role.roleId}>
                {role.roleName}
              </MenuItem>
            ) : null
          )}
        </Select>
        {formik.touched.roleId && formik.errors.roleId && <FormHelperText error>{formik.errors.roleId}</FormHelperText>}
      </Box> */}
    </Box>
  );
}

export default UserForm;
