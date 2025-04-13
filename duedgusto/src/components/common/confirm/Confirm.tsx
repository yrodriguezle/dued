import { useCallback, useEffect, useRef } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";

import useStore from "../../../store/useStore";
import { ONLINE } from "../../../store/serverStatusStore";

function Confirm() {
  const { confirmDialog, setConfirmValues, receiveServerStatus } = useStore((store) => store);
  const { open, title, content, cancelLabel, acceptLabel } = confirmDialog;

  const acceptButtonRef = useRef<HTMLButtonElement>(null); // ref per il bottone

  const onDismiss = useCallback(() => {
    setConfirmValues({
      open: false,
      title: "",
      content: "",
      onAccept: () => Promise.resolve(true),
    });
    receiveServerStatus(ONLINE);
  }, [receiveServerStatus, setConfirmValues]);

  const handleAccept = useCallback(async () => {
    if (confirmDialog.onAccept) {
      confirmDialog.onAccept(true);
    }
    onDismiss();
  }, [confirmDialog, onDismiss]);

  const handleCancel = useCallback(async () => {
    if (confirmDialog.onCancel) {
      confirmDialog.onCancel(true);
    }
    onDismiss();
  }, [confirmDialog, onDismiss]);

  useEffect(() => {
    if (open && acceptButtonRef.current) {
      // Piccolo timeout per aspettare che il dialog sia renderizzato
      setTimeout(() => {
        acceptButtonRef.current?.focus();
      }, 0);
    }
  }, [open]);

  return (
    <Dialog open={open} onClose={handleCancel}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>{content}</DialogContent>
      <DialogActions>
        {cancelLabel ? <Button onClick={handleCancel}>Disagree</Button> : null}
        <Button
          onClick={handleAccept}
          color="primary"
          ref={acceptButtonRef}
        >
          {acceptLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default Confirm;
