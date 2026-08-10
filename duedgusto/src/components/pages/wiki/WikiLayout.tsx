import { ReactNode, useCallback, useContext, useEffect } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";

import PageTitleContext from "../../layout/headerBar/PageTitleContext";
import useStore from "../../../store/useStore";

/** Voce dell'indice in cima all'articolo: punta a una WikiSection con lo stesso id. */
export interface WikiVoceIndice {
  id: string;
  titolo: string;
}

interface WikiLayoutProps {
  /** Riga sopra il titolo, per collocare la voce nella wiki. */
  occhiello: string;
  titolo: string;
  /** Due o tre righe che riassumono la voce prima che il lettore scenda. */
  sommario: string;
  indice: WikiVoceIndice[];
  children: ReactNode;
}

/**
 * Cornice comune alle voci della wiki.
 *
 * Si occupa di tre cose: sbarrare la strada a chi non è amministratore, mettere
 * il titolo nell'header dell'app e stampare intestazione e indice della voce.
 * Il contenuto lo porta la singola voce.
 */
function WikiLayout({ occhiello, titolo, sommario, indice, children }: WikiLayoutProps) {
  const { setTitle } = useContext(PageTitleContext);
  const amministratore = useStore((store) => Boolean(store.utente?.ruolo?.amministratore));

  useEffect(() => {
    setTitle(titolo);
  }, [setTitle, titolo]);

  const vaiAllaSezione = useCallback((id: string) => {
    const elemento = document.getElementById(id);
    // jsdom non implementa scrollIntoView: senza la guardia i test cadrebbero qui.
    if (typeof elemento?.scrollIntoView === "function") {
      elemento.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  if (!amministratore) {
    return (
      <Box sx={{ p: { xs: 2, md: 3 } }}>
        <Alert severity="warning">La wiki è riservata ai ruoli con privilegi di amministratore.</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1180, mx: "auto" }}>
      <Typography
        variant="overline"
        color="text.secondary"
      >
        {occhiello}
      </Typography>
      <Typography
        variant="h5"
        fontWeight={600}
        sx={{ mb: 1 }}
      >
        {titolo}
      </Typography>
      <Typography
        variant="body1"
        color="text.secondary"
        sx={{ mb: 3, maxWidth: 820 }}
      >
        {sommario}
      </Typography>

      <Paper
        variant="outlined"
        component="nav"
        aria-label="Indice della voce"
        sx={{ p: 2, mb: 4 }}
      >
        <Typography
          variant="subtitle2"
          fontWeight={600}
          sx={{ mb: 1 }}
        >
          In questa voce
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", columnGap: 3, rowGap: 0.75 }}>
          {indice.map((voce, index) => (
            <Link
              key={voce.id}
              href={`#${voce.id}`}
              underline="hover"
              variant="body2"
              onClick={(event) => {
                event.preventDefault();
                vaiAllaSezione(voce.id);
              }}
            >
              {index + 1}. {voce.titolo}
            </Link>
          ))}
        </Box>
      </Paper>

      {children}
    </Box>
  );
}

export default WikiLayout;
