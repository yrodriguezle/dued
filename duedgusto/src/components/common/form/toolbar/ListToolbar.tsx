import { Box, IconButton, Toolbar, useMediaQuery, useTheme } from "@mui/material"
import DeleteIcon from "@mui/icons-material/Delete";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import AddIcon from '@mui/icons-material/Add';
import FormikToolbarButton from "./FormikToolbarButton";
import { useMemo } from "react";

interface ListToolbarProps {
  permissions?: {
    insertDenied: boolean;
    updateDenied: boolean;
    deleteDenied: boolean;
  };
  disabledSave?: boolean;
  disabledDelete?: boolean;
  disabledUnlockButton?: boolean;
  hideUnlockButton?: boolean;
  hideSaveButton?: boolean;
  hideNewButton?: boolean;
  hideDeleteButton?: boolean;
}

function ListToolbar({
  permissions,
  disabledDelete,
  hideNewButton,
  hideDeleteButton,
}: ListToolbarProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { insertDenied, updateDenied, deleteDenied } = permissions || {};
  const disableDelete = useMemo(
    () => deleteDenied || insertDenied || updateDenied || disabledDelete,
    [deleteDenied, disabledDelete, insertDenied, updateDenied]
  );
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
          {!hideNewButton && (
            <FormikToolbarButton
              startIcon={<AddIcon />}
            // onClick={() => onFormReset(!disableSave)}
            >
              Nuovo
            </FormikToolbarButton>
          )}
          {!hideDeleteButton && (
            <FormikToolbarButton
              startIcon={<DeleteIcon />}
              color="error"
              disabled={disableDelete}
            >
              Elimina
            </FormikToolbarButton>
          )}
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
  )
}

export default ListToolbar