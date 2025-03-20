/* eslint-disable @typescript-eslint/no-explicit-any */
const loggingEnabled = import.meta.env.DEV;

const log = (...messages: any[]) => {
  if (loggingEnabled) {
    console.log(...messages);
  }
};

const warning = (...messages: any[]) => {
  if (loggingEnabled) {
    console.warn(...messages);
  }
};

const error = (...messages: any[]) => {
  if (loggingEnabled) {
    console.error(...messages);
  }
};

const logger = {
  log,
  warning,
  error,
};

export default logger;
