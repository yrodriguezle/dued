import { menuFragment } from "../menus/fragments";
import { ruoloFragment } from "../ruolo/fragments";

export const utenteFragment = `
  ${ruoloFragment}
  ${menuFragment}
  fragment UtenteFragment on Utente {
    id
    nomeUtente
    nome
    cognome
    descrizione
    disabilitato
    ruoloId
    ruolo { ...RuoloFragment }
    menus { ...MenuFragment }
  }`;
