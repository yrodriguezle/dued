import { Box, Toolbar, IconButton, Button, useMediaQuery, useTheme } from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import DeleteIcon from "@mui/icons-material/Delete";
import MoreVertIcon from "@mui/icons-material/MoreVert";

export default function FormikToolbar() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

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
          <Button
            startIcon={<SaveIcon />}
            sx={{
              height: "100%",
              minHeight: "100%",
              borderRadius: 0,
              padding: "0 16px",
              display: "flex",
              alignItems: "center",
              textTransform: "none",
              transition: theme.transitions.create(["background-color"], {
                duration: theme.transitions.duration.short,
              }),
              "&:hover": {
                backgroundColor: theme.palette.action.hover,
                height: "100%",
              },
              "&:active": {
                backgroundColor: theme.palette.action.selected,
                height: "100%",
              },
              "&.Mui-disabled": {
                color: theme.palette.text.disabled,
                height: "100%",
              },
            }}
          >
            Salva
          </Button>
          <Button
            startIcon={<DeleteIcon />}
            color="error"
            sx={{
              height: "100%",
              minHeight: "100%",
              borderRadius: 0,
              padding: "0 16px",
              display: "flex",
              alignItems: "center",
              textTransform: "none",
              transition: theme.transitions.create(["background-color"], {
                duration: theme.transitions.duration.short,
              }),
              "&:hover": {
                backgroundColor: theme.palette.action.hover,
              },
              "&:active": {
                backgroundColor: theme.palette.action.selected,
              },
              "&.Mui-disabled": {
                color: theme.palette.text.disabled,
              },
            }}
          >
            Elimina
          </Button>
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
          <Box sx={{ display: "flex", alignItems: "stretch", gap: 1 }}>{/* Altri bottoni, se necessario */}</Box>
        )}
      </Toolbar>
    </Box>
  );
}
