import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ApolloProvider } from '@apollo/client';
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';

import App from './App'
import packageJson from '../package.json';
import configureClient from './graphql/configureClient';
import './assets/css/app.css';

(async function render() {
  const response = await fetch(
    '/config.json',
    {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      cache: 'no-store',
    },
  );
  const data: Partial<Global> = await response.json();
  const globalThisWithProperties = window as Global;
  globalThisWithProperties.API_ENDPOINT = data.API_ENDPOINT;
  globalThisWithProperties.GRAPHQL_ENDPOINT = data.GRAPHQL_ENDPOINT;
  globalThisWithProperties.GRAPHQL_WEBSOCKET = data.GRAPHQL_WEBSOCKET;
  globalThisWithProperties.COPYRIGHT = 'Copyright © 2024 Due D Gusto srls';
  globalThisWithProperties.ROOT_URL = '/gestionale';
  globalThisWithProperties.CONNECTION_INTERVAL_UPDATE_TIME = data.CONNECTION_INTERVAL_UPDATE_TIME;
  globalThisWithProperties.LOGON_TIME = 60;
  globalThisWithProperties.SEARCHBOX_CONTAINER_MIN_WIDTH = 300;
  globalThisWithProperties.appVersion = packageJson.version;

  const client = configureClient();

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ApolloProvider client={client}>
        <App />
      </ApolloProvider>
    </StrictMode>,
  )
}());
