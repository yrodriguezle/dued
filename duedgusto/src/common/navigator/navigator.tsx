import { NavigateFunction, NavigateOptions } from "react-router";
import logger from "../logger/logger";

let navigator: NavigateFunction | null = null;

export function setNavigator(nav: NavigateFunction) {
  navigator = nav;
}

export function navigateTo(path: string, options: NavigateOptions = {}) {
  if (navigator) {
    navigator(path, options);
  } else {
    logger.error("Navigator non inizializzato");
  }
}

export default navigator;
