import { Grid, Paper, Typography } from "@mui/material";
import ruoloSearchboxOptions, { RuoloNonNull } from "../../common/form/searchbox/searchboxOptions/ruoloSearchboxOptions";
import FormikSearchbox from "../../common/form/searchbox/FormikSearchbox";
import { FormikRuoloValues } from "./RoleDetails";
import FormikTextField from "../../common/form/FormikTextField";

interface RoleFormProps {
  onSelectItem: (item: RuoloNonNull) => void;
}

function RoleForm({ onSelectItem }: RoleFormProps) {
  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
        Dati Ruolo
      </Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <FormikSearchbox<FormikRuoloValues, RuoloNonNull>
            label="Nome ruolo *"
            placeholder="Nome ruolo"
            name="nome"
            autoComplete="off"
            autoFocus
            required
            fullWidth
            fieldName="nome"
            options={ruoloSearchboxOptions}
            onSelectItem={onSelectItem}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <FormikTextField label="Descrizione" placeholder="Descrizione" name="descrizione" autoComplete="off" fullWidth />
        </Grid>
      </Grid>
    </Paper>
  );
}

export default RoleForm;
