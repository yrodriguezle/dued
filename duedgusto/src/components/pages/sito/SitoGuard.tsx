import { ReactNode } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";

import useStore from "../../../store/useStore";

/**
 * Cornice delle pagine della sezione Sito: mostra il contenuto solo a chi ha il flag
 * amministratore, come fa `WikiLayout` per la wiki.
 *
 * ⚠️ **È cosmesi, non sicurezza.** Chi non è amministratore non vede nemmeno la voce di menu
 * (il gating è nel seed), ma potrebbe comunque digitare la route: quello che davvero protegge
 * i dati è il guard sul backend, presente su ogni mutation della vetrina, sulla lettura di
 * `connection { mediaAssets }` e su `POST /api/media`. Questo componente evita solo una pagina
 * vuota e incomprensibile.
 */
function SitoGuard({ children }: { children: ReactNode }) {
  const amministratore = useStore((store) => Boolean(store.utente?.ruolo?.amministratore));

  if (!amministratore) {
    return (
      <Box sx={{ p: { xs: 2, md: 3 } }}>
        <Alert severity="warning">La sezione Sito è riservata ai ruoli con privilegi di amministratore.</Alert>
      </Box>
    );
  }

  return <>{children}</>;
}

export default SitoGuard;
