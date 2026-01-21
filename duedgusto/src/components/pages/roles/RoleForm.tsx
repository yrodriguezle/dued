import { Box, Grid } from "@mui/material";
import ruoloSearchboxOptions, { RuoloNonNull } from "../../common/form/searchbox/searchboxOptions/ruoloSearchboxOptions";
import FormikSearchbox from "../../common/form/searchbox/FormikSearchbox";
import { FormikRuoloValues } from "./RoleDetails";
import FormikTextField from "../../common/form/FormikTextField";
import { MenuNonNull } from "../../common/form/searchbox/searchboxOptions/menuSearchboxOptions";

interface RoleFormProps {
  menus?: MenuNonNull[];
  onSelectItem: (item: RuoloNonNull) => void;
}

function RoleForm(props: RoleFormProps) {
  const { onSelectItem } = props;
  return (
    <Grid container spacing={2} sx={{ marginTop: 0, paddingX: 3 }}>
      <Grid xs={12} sm={8}>
        <Box>
          <FormikSearchbox<FormikRuoloValues, RuoloNonNull>
            label="Nome ruolo:"
            placeholder="Nome ruolo"
            name="nome"
            margin="normal"
            autoComplete="off"
            autoFocus
            required
            fullWidth
            fieldName="nome"
            options={ruoloSearchboxOptions}
            onSelectItem={onSelectItem}
          />
          <FormikTextField
            label="Descrizione:"
            placeholder="Descrizione"
            name="descrizione"
            margin="normal"
            autoComplete="off"
            required
            fullWidth
          />
        </Box>
      </Grid>
    </Grid>
  )
}

export default RoleForm
