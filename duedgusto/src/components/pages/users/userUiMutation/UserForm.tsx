import { Switch, FormControlLabel, Box } from "@mui/material";
import { useFormikContext } from "formik";
import FormikTextField from "../../../common/form/FormikTextField";
import userSearchboxOption, { UserSearchbox } from "../../../common/form/searchbox/searchboxOptions/userSearchboxOptions";
import FormikSearchbox from "../../../common/form/searchbox/FormikSearchbox";
import { FormikUserValues } from "../UserDetails";

function UserForm() {
  const formik = useFormikContext<FormikUserValues>();
  return (
    <Box sx={{ paddingX: 5 }}>
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
      />
      <FormikTextField label="Nome:" placeholder="Nome" name="firstName" margin="normal" autoComplete="off" required fullWidth />
      <FormikTextField label="Cognome:" placeholder="Cognome" name="lastName" margin="normal" autoComplete="off" required fullWidth />
      <FormikTextField label="Descrizione:" placeholder="Descrizione" name="description" margin="normal" autoComplete="off" required fullWidth />
      <FormControlLabel control={<Switch id="disabled" name="disabled" checked={formik.values.disabled} onChange={formik.handleChange} color="primary" />} label="Disabilitato" />
    </Box>
  );
}

export default UserForm;
