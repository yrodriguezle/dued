/* eslint-disable @typescript-eslint/no-unused-vars */
import { useFormikContext } from "formik";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import AddIcon from "@mui/icons-material/Add";
import { Delete, Edit, Save } from "@mui/icons-material";

function FormToolbar() {
  const { dirty, isValid } = useFormikContext();
  return (
    <AppBar position="relative" color="default" elevation={0} sx={{ mb: 1 }}>
      <Toolbar variant="dense">
        <Stack direction="row" spacing={1}>
          <Button color="secondary" startIcon={<Edit />}>
            Modifica
          </Button>
          <Button color="secondary" startIcon={<Save />}>
            Salva
          </Button>
          <Button color="secondary" startIcon={<Delete />} disabled={!dirty}>
            Elimina
          </Button>
          <Button color="secondary" startIcon={<AddIcon />}>
            Nuovo
          </Button>
        </Stack>
      </Toolbar>
    </AppBar>
  );
}

export default FormToolbar;
