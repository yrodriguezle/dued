const loggingEnabled = process.env.NODE_ENV === 'development';

const log = (...messages) => {
  if (loggingEnabled) {
    console.log(...messages); // eslint-disable-line no-console
  }
};

const warning = (...messages) => {
  if (loggingEnabled) {
    console.warn(...messages); // eslint-disable-line no-console
  }
};

const error = (...messages) => {
  if (loggingEnabled) {
    console.error(...messages); // eslint-disable-line no-console
  }
};

const logger = {
  log,
  warning,
  error,
};

export default logger;
