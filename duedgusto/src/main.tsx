import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { ApolloProvider } from "@apollo/client";

import App from "./App.tsx";
import packageJson from "../package.json";
import configureClient from "./graphql/configureClient.tsx";
import fetchConfiguration from "./api/fetchConfiguration.tsx";

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
  globalThisWithProperties.LOGON_TIME = 60;
  globalThisWithProperties.SEARCHBOX_CONTAINER_MIN_WIDTH = 300;
  globalThisWithProperties.appVersion = packageJson.version;

  const client = configureClient();

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <BrowserRouter>
        <ApolloProvider client={client}>
          <App />
        </ApolloProvider>
      </BrowserRouter>
    </StrictMode>
  );
})();
