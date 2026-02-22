import { Box, Grid, Paper, Typography } from "@mui/material";
import { useFormikContext } from "formik";
import FormikTextField from "../../common/form/FormikTextField";
import FormikCheckbox from "../../common/form/FormikCheckbox";
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
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
      {/* Sezione: Ricerca Utente */}
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
          Ricerca Utente
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <FormikSearchbox<FormikUtenteValues, UtenteSearchbox>
              label="Nome utente *"
              placeholder="Nome utente"
              name="nomeUtente"
              autoFocus
              required
              fullWidth
              fieldName="nomeUtente"
              options={utenteSearchboxOption}
              onSelectItem={onSelectItem}
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Sezione: Dati Personali */}
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
          Dati Personali
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <FormikTextField label="Nome *" placeholder="Nome" name="nome" autoComplete="off" required fullWidth />
          </Grid>
          <Grid item xs={12} md={6}>
            <FormikTextField label="Cognome *" placeholder="Cognome" name="cognome" autoComplete="off" required fullWidth />
          </Grid>
          <Grid item xs={12}>
            <FormikTextField label="Descrizione" placeholder="Descrizione" name="descrizione" autoComplete="off" fullWidth />
          </Grid>
        </Grid>
      </Paper>

      {/* Sezione: Ruolo e Accesso */}
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
          Ruolo e Accesso
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <FormikSearchbox<FormikUtenteValues, RuoloNonNull>
              label="Ruolo *"
              placeholder="Seleziona ruolo"
              name="ruoloNome"
              required
              fullWidth
              fieldName="nome"
              options={ruoloSearchboxOptions}
              onSelectItem={(ruolo) => {
                formik.setFieldValue('ruoloId', ruolo.id);
                formik.setFieldValue('ruoloNome', ruolo.nome);
              }}
            />
          </Grid>
          <Grid item xs={12} md={6} sx={{ display: "flex", alignItems: "center" }}>
            <FormikCheckbox<FormikUtenteValues> name="disabilitato" label="Disabilitato" />
          </Grid>
        </Grid>
      </Paper>

      {/* Sezione: Sicurezza */}
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
          Sicurezza
        </Typography>
        {formik.values.id !== 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Lascia i campi vuoti per mantenere la password attuale.
          </Typography>
        )}
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <FormikTextField
              label={formik.values.id === 0 ? "Password *" : "Nuova Password"}
              placeholder={formik.values.id === 0 ? "Password" : "Nuova password"}
              name="password"
              type="password"
              autoComplete="new-password"
              required={formik.values.id === 0}
              fullWidth
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <FormikTextField
              label={formik.values.id === 0 ? "Conferma Password *" : "Conferma Nuova Password"}
              placeholder="Conferma password"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required={formik.values.id === 0}
              fullWidth
            />
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
}

export default UserForm;
