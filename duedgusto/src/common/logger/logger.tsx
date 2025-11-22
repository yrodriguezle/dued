/* eslint-disable @typescript-eslint/no-explicit-any */
const loggingEnabled = import.meta.env.DEV;

const log = (...messages: any[]) => {
  if (loggingEnabled) {
    console.log(...messages); // eslint-disable-line no-console
  }
};

const warn = (...messages: any[]) => {
  if (loggingEnabled) {
    console.warn(...messages); // eslint-disable-line no-console
  }
};

const error = (...messages: any[]) => {
  if (loggingEnabled) {
    console.error(...messages); // eslint-disable-line no-console
  }
};

const time = (label: string) => {
  if (loggingEnabled) {
    console.time(label); // eslint-disable-line no-console
  }
};

const timeLog = (...labels: string[]) => {
  if (loggingEnabled) {
    console.timeLog(...labels); // eslint-disable-line no-console
  }
};

const timeEnd = (...labels: string[]) => {
  if (loggingEnabled) {
    console.timeEnd(...labels); // eslint-disable-line no-console
  }
};

const debug = (...messages: any[]) => {
  if (loggingEnabled) {
    console.debug(...messages); // eslint-disable-line no-console
  }
};

const logger = {
  log,
  warn,
  error,
  time,
  timeLog,
  timeEnd,
  debug,
};

export default logger;
