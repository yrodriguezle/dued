import React from 'react';
// import ReactDOM from 'react-dom';
import { createRoot } from 'react-dom/client';

import { Provider } from 'react-redux';
import {
  BrowserRouter as Router,
} from 'react-router-dom';

import {
  ApolloClient,
  InMemoryCache,
  ApolloProvider,
  HttpLink,
  from,
  split,
  fromPromise,
  toPromise,
} from '@apollo/client';
import { WebSocketLink } from '@apollo/client/link/ws';
import { getMainDefinition } from '@apollo/client/utilities';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
import { RetryLink } from '@apollo/client/link/retry';

import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';

import configureStore from './redux/configureStore';
import 'react-perfect-scrollbar/dist/css/styles.css';

import { getAuthHeaders } from './common/auth';
import packageJson from '../package.json';

import './assets/css/app.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import logger from './common/logger';
import handleRefreshToken from './graphql/user/handleRefreshToken';

global.appVersion = packageJson.version;

const {
  store,
} = configureStore();

(async () => {
  const variables = await fetch(
    '/config.json',
    {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      cache: 'no-store',
    },
  );
  const data = await variables.json();
  global.API_ENDPOINT = data.API_ENDPOINT;
  global.GRAPHQL_ENDPOINT = data.GRAPHQL_ENDPOINT;
  global.GRAPHQL_WEBSOCKET = data.GRAPHQL_WEBSOCKET;
  global.COPYRIGHT = data.COPYRIGHT;
  global.ROOT_URL = data.ROOT_URL;
  global.LOGON_TIME = 60;

  const httpLink = new HttpLink({ uri: global.GRAPHQL_ENDPOINT });
  const wsLink = new WebSocketLink({
    uri: global.GRAPHQL_WEBSOCKET,
    options: {
      reconnect: true,
    },
  });
  const splitLink = split(
    ({ query }) => {
      const definition = getMainDefinition(query);
      return (
        definition.kind === 'OperationDefinition'
        && definition.operation === 'subscription'
      );
    },
    wsLink,
    httpLink,
  );

  const authLink = setContext((_, { headers }) => ({
    headers: {
      ...headers,
      Accept: 'application/json',
      'Content-Type': 'application/json;charset=UTF-8',
      ...(getAuthHeaders()),
    },
  }));

  const errorLink = onError((props) => {
    const {
      graphQLErrors, operation, forward,
    } = props;
    if (Array.isArray(graphQLErrors) && graphQLErrors.some(({ extensions }) => extensions.code === '401')) {
      logger.log('...refreshing token');
      return fromPromise(handleRefreshToken().then((jwtData) => {
        if (jwtData) {
          const oldHeaders = operation.getContext().headers;
          operation.setContext({
            headers: {
              ...oldHeaders,
              ...(getAuthHeaders()),
            },
          });
          return toPromise(forward(operation));
        }
        return null;
      }));
    }
    logger.log(props);
    return null;
  });

  const retryLink = new RetryLink({
    delay: {
      initial: 200,
      max: Infinity,
    },
    attempts: {
      max: 5,
    },
  });

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: from([
      retryLink,
      errorLink,
      authLink.concat(splitLink),
    ]),
    queryDeduplication: false,
  });

  const container = document.getElementById('root');
  const root = createRoot(container);
  root.render(
    <ApolloProvider client={client}>
      <Provider store={store}>
        <Router>
          <React.StrictMode>
            <App />
          </React.StrictMode>
        </Router>
      </Provider>
    </ApolloProvider>,
  );
})();

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
