import { ReactNode, useCallback, useEffect, useRef, useState, PointerEvent as ReactPointerEvent } from "react";
import { Modal, Box, Typography, IconButton, SxProps, Theme } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import useDragModePreference from "./useDragModePreference";

// Comportamento drag della modale:
// - "free": al rilascio la modale resta dove trascinata (reset al centro alla riapertura)
// - "elastic": al rilascio la modale torna alla posizione originale (snap-back animato)
// Alias retrocompatibile del tipo dominio condiviso: unica fonte di verita' dei valori ammessi.
export type DialogDragMode = DragModePreference;

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
  dragMode?: DialogDragMode;
}

const sectionBg = "action.hover";

function AppDialog({ open, onClose, title, children, footer, maxWidth = "900px", width, height, disableClose, dragMode }: AppDialogProps) {
  // Default dalla preferenza utente (userStore, fallback "free"); il prop esplicito vince sull'override locale.
  const preferenzaDragModale = useDragModePreference();
  const effectiveDragMode = dragMode ?? preferenzaDragModale;
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef<{ pointerX: number; pointerY: number; offsetX: number; offsetY: number } | null>(null);

  // Reset posizione a ogni apertura: nessuna posizione persistita tra aperture successive.
  useEffect(() => {
    if (open) {
      setOffset({ x: 0, y: 0 });
      setDragging(false);
      dragStartRef.current = null;
    }
  }, [open]);

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      // Ignora pulsanti secondari e i click sui bottoni dell'header (es. Chiudi).
      if (event.button !== 0 || (event.target as HTMLElement).closest("button")) {
        return;
      }
      dragStartRef.current = { pointerX: event.clientX, pointerY: event.clientY, offsetX: offset.x, offsetY: offset.y };
      setDragging(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [offset.x, offset.y]
  );

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const start = dragStartRef.current;
    if (!start) {
      return;
    }
    setOffset({
      x: start.offsetX + (event.clientX - start.pointerX),
      y: start.offsetY + (event.clientY - start.pointerY),
    });
  }, []);

  const handlePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!dragStartRef.current) {
        return;
      }
      dragStartRef.current = null;
      setDragging(false);
      event.currentTarget.releasePointerCapture(event.pointerId);
      // Modalita elastica: torna alla posizione originale al rilascio.
      if (effectiveDragMode === "elastic") {
        setOffset({ x: 0, y: 0 });
      }
    },
    [effectiveDragMode]
  );

  const modalStyle: SxProps<Theme> = {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
    // Transizione solo per lo snap-back elastico a fine drag; durante il drag deve seguire il cursore senza lag.
    transition: effectiveDragMode === "elastic" && !dragging ? "transform 0.25s ease" : "none",
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
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            p: 1,
            paddingLeft: 2,
            borderBottom: 1,
            borderColor: "divider",
            bgcolor: sectionBg,
            cursor: dragging ? "grabbing" : "grab",
            userSelect: "none",
            touchAction: "none",
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
