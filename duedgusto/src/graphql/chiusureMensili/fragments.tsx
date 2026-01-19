import { gql } from "@apollo/client";

export const spesaMensileFragment = gql`
  fragment SpesaMensileFragment on SpesaMensile {
    spesaId
    chiusuraId
    pagamentoId
    descrizione
    importo
    categoria
    creatoIl
  }
`;

export const chiusuraMensileFragment = gql`
  fragment ChiusuraMensileFragment on ChiusuraMensile {
    chiusuraId
    anno
    mese
    ultimoGiornoLavorativo
    ricavoTotale
    totaleContanti
    totaleElettronici
    totaleFatture
    speseAggiuntive
    ricavoNetto
    stato
    note
    chiusaIl
    creatoIl
    chiusaDaUtente {
      userId
      userName
    }
    spese {
      ...SpesaMensileFragment
    }
  }
  ${spesaMensileFragment}
`;
