import {
  Box,
  Toolbar,
  IconButton,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import DeleteIcon from "@mui/icons-material/Delete";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import FormikToolbarButton from "./FormikToolbarButton";
import { useFormikContext } from "formik";

export default function FormikToolbar<FormikValues>() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const formik = useFormikContext<FormikValues>();

  return (
    <Box sx={{ borderBottom: 1, borderColor: "divider", bgcolor: "background.paper" }}>
      <Toolbar
        variant="dense"
        disableGutters
        sx={{
          minHeight: 48,
          height: 48,
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <Box sx={{ height: 48, display: "flex", alignItems: "stretch" }}>
          <FormikToolbarButton startIcon={<SaveIcon />}>
            Salva
          </FormikToolbarButton>
          <FormikToolbarButton startIcon={<DeleteIcon />} color="error">
            Elimina
          </FormikToolbarButton>
        </Box>
        {isMobile ? (
          <IconButton
            size="small"
            sx={{
              "&:hover": {
                backgroundColor: theme.palette.action.hover,
              },
            }}
          >
            <MoreVertIcon />
          </IconButton>
        ) : (
          <Box sx={{ display: "flex", alignItems: "stretch", gap: 1 }}>
            {/* Altri bottoni */}
          </Box>
        )}
      </Toolbar>
    </Box>
  );
}
