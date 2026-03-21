import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { ApolloProvider } from "@apollo/client";

import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import "dayjs/locale/it";
import "./tailwind.css";

import "@fontsource/roboto/300.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
import "react-toastify/dist/ReactToastify.css";

import router from "./routes/appRouter";
import fetchConfiguration from "./api/fetchConfiguration";
import configureClient from "./graphql/configureClient";
import "./assets/css/app.css";

(async function render() {
  const response = await fetchConfiguration();
  if (response.status !== 200) {
    alert("Error fetching configuration from public/config.json");
    return;
  }
  const data: Partial<Global> = await response.json();
  const globalThisWithProperties = window as Global;
  globalThisWithProperties.API_ENDPOINT = data.API_ENDPOINT;
  globalThisWithProperties.GRAPHQL_ENDPOINT = data.GRAPHQL_ENDPOINT;
  globalThisWithProperties.GRAPHQL_WEBSOCKET = data.GRAPHQL_WEBSOCKET;
  globalThisWithProperties.COPYRIGHT = data.COPYRIGHT;
  globalThisWithProperties.CONNECTION_INTERVAL_UPDATE_TIME = data.CONNECTION_INTERVAL_UPDATE_TIME;
  globalThisWithProperties.SEARCHBOX_CONTAINER_MIN_WIDTH = 500;
  globalThisWithProperties.appVersion = __APP_VERSION__;

  // Carica il nome attività dalle impostazioni (non blocca l'avvio se fallisce)
  try {
    const settingsResponse = await fetch(`${data.API_ENDPOINT}/api/public/business-name`);
    if (settingsResponse.ok) {
      const settingsData = await settingsResponse.json();
      globalThisWithProperties.BUSINESS_NAME = settingsData.businessName;
    }
  } catch {
    // Fallback: usa il nome di default
  }

  const client = configureClient();

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="it">
        <ApolloProvider client={client}>
          <RouterProvider router={router} />
        </ApolloProvider>
      </LocalizationProvider>
    </StrictMode>
  );
})();
