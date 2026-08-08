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
      resto
      stato
      totaleApertura
      totaleChiusura
      speseFornitori
      speseGiornaliere
      # Righe di spesa del giorno: alimentano la griglia spese fisse della chiusura.
      # Risolte da DataLoader batch, quindi 2 query per l'intero mese (non N).
      # Niente fattura { } / ddt { }: innescherebbero i loader per documento su
      # pagamenti che poi la griglia filtra via.
      spese {
        id
        descrizione
        importo
        categoria
        note
      }
      pagamentiFornitori {
        pagamentoId
        fatturaId
        ddtId
        dataPagamento
        importo
        metodoPagamento
        categoria
        descrizione
        note
      }
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
