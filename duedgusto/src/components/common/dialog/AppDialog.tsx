import { ReactNode } from "react";
import { Modal, Box, Typography, IconButton, SxProps, Theme } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

interface AppDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: string;
  width?: Record<string, string> | string;
  height?: Record<string, string> | string;
  disableClose?: boolean;
}

const sectionBg = "action.hover";

function AppDialog({ open, onClose, title, children, footer, maxWidth = "900px", width, height, disableClose }: AppDialogProps) {
  const modalStyle: SxProps<Theme> = {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: width ?? { xs: "95%", sm: "90%", md: "80%", lg: "70%" },
    maxWidth,
    maxHeight: "90vh",
    ...(height ? { height } : {}),
    bgcolor: "background.paper",
    borderRadius: "8px",
    boxShadow: 24,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  };

  return (
    <Modal
      open={open}
      onClose={disableClose ? undefined : onClose}
    >
      <Box sx={modalStyle}>
        {/* Header */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            p: 1,
            paddingLeft: 2,
            borderBottom: 1,
            borderColor: "divider",
            bgcolor: sectionBg,
          }}
        >
          <Typography
            variant="h6"
            component="h2"
          >
            {title}
          </Typography>
          <IconButton
            onClick={onClose}
            size="small"
            disabled={disableClose}
            aria-label="Chiudi finestra"
          >
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, p: 2, overflow: "auto", bgcolor: sectionBg }}>
          {children}
        </Box>

        {/* Footer */}
        {footer && (
          <Box
            sx={{
              px: 2,
              py: 1.5,
              borderTop: 1,
              borderColor: "divider",
              bgcolor: sectionBg,
            }}
          >
            {footer}
          </Box>
        )}
      </Box>
    </Modal>
  );
}

export default AppDialog;
