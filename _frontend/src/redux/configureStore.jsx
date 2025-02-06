import { configureStore } from '@reduxjs/toolkit';
import { createLogger } from 'redux-logger';
import reduxThunk from 'redux-thunk';

import rootReducer from './reducers';
import security from './middlewares/security';

const logger = createLogger({
  predicate: () => process.env.NODE_ENV === 'development' && false,
});

const reduxStore = (preloadedState = {}) => {
  const store = configureStore({
    reducer: rootReducer,
    middleware: [
      reduxThunk,
      security,
      logger,
    ],
    preloadedState,
  });

  // Enable hot module replacement
  if (process.env.NODE_ENV === 'development') {
    if (module.hot) {
      module.hot.accept('./reducers', () => {
        store.replaceReducer(rootReducer);
      });
    }
  }

  return { store };
};

export default reduxStore;
