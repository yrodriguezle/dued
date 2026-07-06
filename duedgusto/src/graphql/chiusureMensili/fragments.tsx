import { gql } from "@apollo/client";

export const registroCassaMensileFragment = gql`
  fragment RegistroCassaMensileFragment on RegistroCassaMensile {
    chiusuraId
    registroId
    incluso
    registro {
      id
      data
      totaleVendite
      incassoContanteTracciato
      incassiElettronici
      incassiFattura
      differenza
      stato
      totaleApertura
      totaleChiusura
      speseFornitori
      speseGiornaliere
    }
  }
`;

export const chiusuraMensileFragment = gql`
  fragment ChiusuraMensileFragment on ChiusuraMensile {
    chiusuraId
    anno
    mese
    ricavoTotaleCalcolato
    totaleContantiCalcolato
    totaleElettroniciCalcolato
    totaleFattureCalcolato
    speseTracciateRegistriCalcolate
    speseGiornaliereRegistriCalcolate
    ricavoNettoCalcolato
    totaleIvaCalcolato
    totaleImponibileCalcolato
    totaleLordoCalcolato
    totaleDifferenzeCassaCalcolato

    avvisiCompletezza

    giorniEsclusi

    stato
    note
    chiusaDa
    chiusaIl
    createdAt
    updatedAt
    chiusaDaUtente {
      id
      nomeUtente
    }

    registriInclusi {
      ...RegistroCassaMensileFragment
    }
  }
  ${registroCassaMensileFragment}
`;
