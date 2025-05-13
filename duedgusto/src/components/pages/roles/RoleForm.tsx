import { Box, Grid } from "@mui/material";
import roleSearchboxOptions, { RoleNonNull } from "../../common/form/searchbox/searchboxOptions/roleSearchboxOptions";
import FormikSearchbox from "../../common/form/searchbox/FormikSearchbox";
import { FormikRoleValues } from "./RoleDetails";
import FormikTextField from "../../common/form/FormikTextField";
import { MenuNonNull } from "../../common/form/searchbox/searchboxOptions/menuSearchboxOptions";

interface RoleFormProps {
  menus?: MenuNonNull[];
  onSelectItem: (item: RoleNonNull) => void;
}

function RoleForm(props: RoleFormProps) {
  const { onSelectItem } = props;
  return (
    <Grid container spacing={2} sx={{ marginTop: 0, paddingX: 3 }}>
      <Grid xs={12} sm={8}>
        <Box>
          <FormikSearchbox<FormikRoleValues, RoleNonNull>
            label="Nome ruolo:"
            placeholder="Nome ruolo"
            name="roleName"
            margin="normal"
            autoComplete="off"
            autoFocus
            required
            fullWidth
            fieldName="roleName"
            options={roleSearchboxOptions}
            onSelectItem={onSelectItem}
          />
          <FormikTextField
            label="Descrizione:"
            placeholder="Descrizione"
            name="roleDescription"
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