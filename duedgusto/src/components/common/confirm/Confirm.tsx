import { useCallback } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";

import useStore from "../../../store/useStore";
import { ONLINE } from "../../../store/serverStatusStore";

function Confirm() {
  // const acceptButtonRef = useRef<HTMLAnchorElement>(null);
  // const cancelButtonRef = useRef<HTMLAnchorElement>(null);
  const { confirmDialog, setConfirmValues, receiveServerStatus } = useStore((store) => store);
  const { open, title, content, cancelLabel, acceptLabel } = confirmDialog;

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
      await confirmDialog.onAccept();
    }
    onDismiss();
  }, [confirmDialog, onDismiss]);

  const handleCancel = useCallback(async () => {
    if (confirmDialog.onCancel) {
      await confirmDialog.onCancel();
    }
    onDismiss();
  }, [confirmDialog, onDismiss]);

  // useEffect(() => {
  //   if (open) {
  //     setTimeout(() => {
  //       if (cancelButtonRef.current) {
  //         cancelButtonRef.current.focus();
  //       } else if (acceptButtonRef.current) {
  //         acceptButtonRef.current.focus();
  //       }
  //     }, 100);
  //   }
  // }, [hiddenConfirm]);

  return (
    <Dialog open={open} onClose={handleCancel}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>{content}</DialogContent>
      <DialogActions>
        {cancelLabel ? <Button onClick={handleCancel}>Disagree</Button> : null}
        <Button onClick={handleAccept} color="primary">
          {acceptLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default Confirm;
