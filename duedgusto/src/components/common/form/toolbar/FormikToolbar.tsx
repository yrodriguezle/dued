import {
  Box,
  Toolbar,
  IconButton,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from "@mui/icons-material/Save";
import DeleteIcon from "@mui/icons-material/Delete";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import FormikToolbarButton from "./FormikToolbarButton";
import { useFormikContext } from "formik";
import { formStatuses } from "../../../../common/globals/constants";
import { useMemo } from "react";

interface FormikToolbarProps {
  permissions?: {
    insertDenied: boolean;
    updateDenied: boolean;
    deleteDenied: boolean;
  };
  disabledSave?: boolean;
  disabledDelete?: boolean;
  disabledUnlockButton?: boolean;
}

export default function FormikToolbar({
  permissions,
  disabledSave,
  disabledDelete,
  disabledUnlockButton,
}: FormikToolbarProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const formikProps = useFormikContext();
  const { insertDenied, updateDenied, deleteDenied } = permissions || {};
  const {
    isSubmitting, status, dirty, // touched, errors, values, submitForm,
  } = formikProps;

  const disableUnlock = useMemo(() => updateDenied || status.formStatus === formStatuses.INSERT || disabledUnlockButton, [disabledUnlockButton, status.formStatus, updateDenied])
  const disableSave = useMemo(() => status.isFormLocked || isSubmitting || insertDenied || updateDenied
    || (disabledSave !== undefined ? disabledSave : !dirty), [dirty, disabledSave, insertDenied, isSubmitting, status.isFormLocked, updateDenied]);
  const disableDelete = useMemo(() => deleteDenied || insertDenied || updateDenied || disabledDelete || status.formStatus === formStatuses.INSERT, [deleteDenied, disabledDelete, insertDenied, status.formStatus, updateDenied]);

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
          <FormikToolbarButton
            startIcon={<EditIcon />}
            disabled={disableUnlock}
          >
            {status.isFormLocked || status.formStatus === formStatuses.INSERT ? 'Modifica' : 'Annulla'}
          </FormikToolbarButton>
          <FormikToolbarButton
            startIcon={<SaveIcon />}
            disabled={disableSave}
          >
            Salva
          </FormikToolbarButton>
          <FormikToolbarButton
            startIcon={<DeleteIcon />}
            color="error"
            disabled={disableDelete}
          >
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
