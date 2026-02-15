import { gql } from "@apollo/client";

export const spesaMensileLiberaFragment = gql`
  fragment SpesaMensileLiberaFragment on SpesaMensileLibera {
    spesaId
    chiusuraId
    descrizione
    importo
    categoria
    creatoIl
    aggiornatoIl
  }
`;

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
    }
  }
`;

export const pagamentoMensileFornitoriFragment = gql`
  fragment PagamentoMensileFornitoriFragment on PagamentoMensileFornitori {
    chiusuraId
    pagamentoId
    inclusoInChiusura
    pagamento {
      pagamentoId
      dataPagamento
      importo
      metodoPagamento
      note
    }
  }
`;

export const chiusuraMensileFragment = gql`
  fragment ChiusuraMensileFragment on ChiusuraMensile {
    chiusuraId
    anno
    mese
    ultimoGiornoLavorativo

    ricavoTotaleCalcolato
    totaleContantiCalcolato
    totaleElettroniciCalcolato
    totaleFattureCalcolato
    speseAggiuntiveCalcolate
    ricavoNettoCalcolato
    totaleIvaCalcolato
    totaleImponibileCalcolato
    totaleLordoCalcolato
    totaleDifferenzeCassaCalcolato

    giorniEsclusi

    stato
    note
    chiusaDa
    chiusaIl
    creatoIl
    aggiornatoIl
    chiusaDaUtente {
      id
      nomeUtente
    }

    registriInclusi {
      ...RegistroCassaMensileFragment
    }

    speseLibere {
      ...SpesaMensileLiberaFragment
    }

    pagamentiInclusi {
      ...PagamentoMensileFornitoriFragment
    }
  }
  ${registroCassaMensileFragment}
  ${spesaMensileLiberaFragment}
  ${pagamentoMensileFornitoriFragment}
`;
