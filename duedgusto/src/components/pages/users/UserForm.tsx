import { Switch, FormControlLabel, Box } from "@mui/material";
import Grid from "@mui/material/Grid";
import { useFormikContext } from "formik";
import FormikTextField from "../../common/form/FormikTextField";
import userSearchboxOption, { UserSearchbox } from "../../common/form/searchbox/searchboxOptions/userSearchboxOptions";
import roleSearchboxOptions, { RoleNonNull } from "../../common/form/searchbox/searchboxOptions/roleSearchboxOptions";
import FormikSearchbox from "../../common/form/searchbox/FormikSearchbox";
import { FormikUserValues } from "./UserDetails";

interface UserFormProps {
  onSelectItem: (item: UserSearchbox) => void;
}

function UserForm({ onSelectItem }: UserFormProps) {
  const formik = useFormikContext<FormikUserValues>();

  return (
    <Grid container spacing={2} sx={{ marginTop: 1, paddingX: 3 }}>
      <Grid xs={12} sm={8}>
        <Box>
          <FormikSearchbox<FormikUserValues, UserSearchbox>
            label="Nome utente:"
            placeholder="Nome utente"
            name="userName"
            margin="normal"
            autoComplete="off"
            autoFocus
            required
            fullWidth
            fieldName="userName"
            options={userSearchboxOption}
            onSelectItem={onSelectItem}
          />
          <FormikSearchbox<FormikUserValues, RoleNonNull>
            label="Ruolo:"
            placeholder="Seleziona ruolo"
            name="roleName"
            margin="normal"
            required
            fullWidth
            fieldName="roleName"
            options={roleSearchboxOptions}
            onSelectItem={(role) => {
              formik.setFieldValue('roleId', role.roleId);
              formik.setFieldValue('roleName', role.roleName);
            }}
          />
          <FormikTextField label="Nome:" placeholder="Nome" name="firstName" margin="normal" autoComplete="off" required fullWidth />
          <FormikTextField label="Cognome:" placeholder="Cognome" name="lastName" margin="normal" autoComplete="off" required fullWidth />
          <FormikTextField label="Descrizione:" placeholder="Descrizione" name="description" margin="normal" autoComplete="off" required fullWidth />
          <FormikTextField
            label="Password:"
            placeholder={formik.values.userId === 0 ? "Password (obbligatoria)" : "Lascia vuoto per non modificare"}
            name="password"
            type="password"
            margin="normal"
            autoComplete="new-password"
            required={formik.values.userId === 0}
            fullWidth
          />
          <FormikTextField
            label="Conferma Password:"
            placeholder={formik.values.userId === 0 ? "Conferma password" : "Lascia vuoto per non modificare"}
            name="confirmPassword"
            type="password"
            margin="normal"
            autoComplete="new-password"
            required={formik.values.userId === 0}
            fullWidth
          />
          <FormControlLabel
            control={(
              <Switch
                id="disabled"
                name="disabled"
                checked={formik.values.disabled}
                onChange={formik.handleChange}
                color="primary"
              />
            )}
            label="Disabilitato"
          />
        </Box>
      </Grid>
    </Grid>
  );
}

export default UserForm;
