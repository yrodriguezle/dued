import { useState } from "react";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Snackbar from "@mui/material/Snackbar";
import CloseIcon from "@mui/icons-material/Close";
import useVersionCheck from "../../common/versionCheck/useVersionCheck";

/**
 * Snackbar non bloccante che avvisa quando è disponibile una nuova versione
 * dell'app (deploy avvenuto mentre l'utente ha la pagina aperta).
 * L'utente sceglie quando ricaricare, così non interrompe operazioni in corso.
 */
function UpdateNotification() {
  const updateAvailable = useVersionCheck();
  const [dismissed, setDismissed] = useState(false);

  return (
    <Snackbar
      open={updateAvailable && !dismissed}
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      message="È disponibile una nuova versione dell'applicazione"
      action={
        <>
          <Button
            color="primary"
            size="small"
            onClick={() => window.location.reload()}
          >
            Aggiorna
          </Button>
          <IconButton
            size="small"
            color="inherit"
            aria-label="Chiudi"
            onClick={() => setDismissed(true)}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </>
      }
    />
  );
}

export default UpdateNotification;
