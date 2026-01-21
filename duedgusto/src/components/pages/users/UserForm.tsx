import { Switch, FormControlLabel, Box } from "@mui/material";
import Grid from "@mui/material/Grid";
import { useFormikContext } from "formik";
import FormikTextField from "../../common/form/FormikTextField";
import utenteSearchboxOption, { UtenteSearchbox } from "../../common/form/searchbox/searchboxOptions/utenteSearchboxOptions";
import ruoloSearchboxOptions, { RuoloNonNull } from "../../common/form/searchbox/searchboxOptions/ruoloSearchboxOptions";
import FormikSearchbox from "../../common/form/searchbox/FormikSearchbox";
import { FormikUtenteValues } from "./UserDetails";

interface UserFormProps {
  onSelectItem: (item: UtenteSearchbox) => void;
}

function UserForm({ onSelectItem }: UserFormProps) {
  const formik = useFormikContext<FormikUtenteValues>();

  return (
    <Grid container spacing={2} sx={{ marginTop: 1, paddingX: 3 }}>
      <Grid xs={12} sm={8}>
        <Box>
          <FormikSearchbox<FormikUtenteValues, UtenteSearchbox>
            label="Nome utente:"
            placeholder="Nome utente"
            name="nomeUtente"
            margin="normal"
            autoComplete="off"
            autoFocus
            required
            fullWidth
            fieldName="nomeUtente"
            options={utenteSearchboxOption}
            onSelectItem={onSelectItem}
          />
          <FormikSearchbox<FormikUtenteValues, RuoloNonNull>
            label="Ruolo:"
            placeholder="Seleziona ruolo"
            name="ruoloNome"
            margin="normal"
            required
            fullWidth
            fieldName="nome"
            options={ruoloSearchboxOptions}
            onSelectItem={(ruolo) => {
              formik.setFieldValue('ruoloId', ruolo.id);
              formik.setFieldValue('ruoloNome', ruolo.nome);
            }}
          />
          <FormikTextField label="Nome:" placeholder="Nome" name="nome" margin="normal" autoComplete="off" required fullWidth />
          <FormikTextField label="Cognome:" placeholder="Cognome" name="cognome" margin="normal" autoComplete="off" required fullWidth />
          <FormikTextField label="Descrizione:" placeholder="Descrizione" name="descrizione" margin="normal" autoComplete="off" required fullWidth />
          <FormikTextField
            label="Password:"
            placeholder={formik.values.id === 0 ? "Password (obbligatoria)" : "Lascia vuoto per non modificare"}
            name="password"
            type="password"
            margin="normal"
            autoComplete="new-password"
            required={formik.values.id === 0}
            fullWidth
          />
          <FormikTextField
            label="Conferma Password:"
            placeholder={formik.values.id === 0 ? "Conferma password" : "Lascia vuoto per non modificare"}
            name="confirmPassword"
            type="password"
            margin="normal"
            autoComplete="new-password"
            required={formik.values.id === 0}
            fullWidth
          />
          <FormControlLabel
            control={(
              <Switch
                id="disabilitato"
                name="disabilitato"
                checked={formik.values.disabilitato}
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
