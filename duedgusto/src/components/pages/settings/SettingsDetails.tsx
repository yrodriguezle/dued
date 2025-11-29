import { useContext, useEffect } from "react";
import { Box, CircularProgress, Container, Alert } from "@mui/material";
import PageTitleContext from "../../layout/headerBar/PageTitleContext";
import useGetBusinessSettings from "../../../graphql/settings/useGetBusinessSettings";
import BusinessSettingsForm from "./BusinessSettingsForm";

function SettingsDetails() {
  const { setTitle } = useContext(PageTitleContext);
  const { settings, loading, error } = useGetBusinessSettings();

  useEffect(() => {
    setTitle("Impostazioni");
  }, [setTitle]);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Container maxWidth="sm" sx={{ marginTop: 4 }}>
        <Alert severity="error">
          Errore nel caricamento delle impostazioni: {error.message}
        </Alert>
      </Container>
    );
  }

  if (!settings) {
    return (
      <Container maxWidth="sm" sx={{ marginTop: 4 }}>
        <Alert severity="warning">
          Nessuna configurazione trovata. Contatta l'amministratore.
        </Alert>
      </Container>
    );
  }

  return (
    <Box sx={{ padding: 2 }}>
      <BusinessSettingsForm initialSettings={settings} />
    </Box>
  );
}

export default SettingsDetails;
