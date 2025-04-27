import { Box, Checkbox, FormControlLabel, Grid, List, ListItem } from "@mui/material";
import roleSearchboxOptions, { RoleSearchbox } from "../../common/form/searchbox/searchboxOptions/roleSearchboxOptions";
import FormikSearchbox from "../../common/form/searchbox/FormikSearchbox";
import { FormikRoleValues } from "./RoleDetails";
import FormikTextField from "../../common/form/FormikTextField";
import { MenuNonNull } from "../../common/form/searchbox/searchboxOptions/menuSearchboxOptions";
import { useFormikContext } from "formik";

interface RoleFormProps {
  menus?: MenuNonNull[];
  onSelectItem: (item: RoleSearchbox) => void;
}

function RoleForm(props: RoleFormProps) {
  const { menus = [], onSelectItem } = props;
  const { values } = useFormikContext<FormikRoleValues>();
  return (
    <Grid container spacing={2} sx={{ marginTop: 1, paddingX: 3 }}>
      <Grid xs={12} sm={8}>
        <Box>
          <FormikSearchbox<FormikRoleValues, RoleSearchbox>
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
          <FormikTextField label="Descrizione:" placeholder="Descrizione" name="roleDescription" margin="normal" autoComplete="off" required fullWidth />
        </Box>
      </Grid>

      <Grid xs={12}>
        <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
          <List dense>
            {menus.map(menu => (
              <ListItem key={menu.menuId}>
                <FormControlLabel
                  control={
                    <Checkbox
                      name="menuIds"
                      value={menu.menuId}
                      checked={values.menuIds.includes(menu.menuId)}
                    // onChange={e => {
                    //   const { setFieldValue, values } = formRef.current!;
                    //   const current = values.menuIds as number[];
                    //   if (e.target.checked) {
                    //     setFieldValue('menuIds', [...current, menu.menuId]);
                    //   } else {
                    //     setFieldValue('menuIds', current.filter(id => id !== menu.menuId));
                    //   }
                    // }}
                    />
                  }
                  label={menu.title}
                />
              </ListItem>
            ))}
          </List>
        </Box>
      </Grid>
    </Grid>
  )
}

export default RoleForm