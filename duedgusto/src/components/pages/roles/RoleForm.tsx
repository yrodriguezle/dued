import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import ruoloSearchboxOptions, { RuoloNonNull } from "../../common/form/searchbox/searchboxOptions/ruoloSearchboxOptions";
import FormikSearchbox from "../../common/form/searchbox/FormikSearchbox";
import { FormikRuoloValues } from "./RoleDetails";
import FormikTextField from "../../common/form/FormikTextField";
import FormikCheckbox from "../../common/form/FormikCheckbox";

interface RoleFormProps {
  onSelectItem: (item: RuoloNonNull) => void;
}

function RoleForm({ onSelectItem }: RoleFormProps) {
  return (
    <Paper
      variant="outlined"
      sx={{ p: 2.5 }}
    >
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
          <FormikTextField
            label="Descrizione"
            placeholder="Descrizione"
            name="descrizione"
            autoComplete="off"
            fullWidth
          />
        </div>
        <div className="col-span-12">
          <FormikCheckbox<FormikRuoloValues>
            name="amministratore"
            label="Ruolo amministratore"
          />
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", mt: -0.5 }}
          >
            Consente le operazioni riservate, come riportare in bozza un registro cassa già chiuso.
          </Typography>
        </div>
      </div>
    </Paper>
  );
}

export default RoleForm;
