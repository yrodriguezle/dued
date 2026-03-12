import { Paper, Typography } from "@mui/material";
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
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 md:col-span-6">
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
        </div>
        <div className="col-span-12 md:col-span-6">
          <FormikTextField label="Descrizione" placeholder="Descrizione" name="descrizione" autoComplete="off" fullWidth />
        </div>
      </div>
    </Paper>
  );
}

export default RoleForm;
