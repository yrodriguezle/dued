// src/graphql/monthlyClosure/fragments.tsx
import { gql } from "@apollo/client";

export const MONTHLY_EXPENSE_FRAGMENT = gql`
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

export const MONTHLY_CLOSURE_FRAGMENT = gql`
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
      username
    }
    spese {
      ...SpesaMensileFragment
    }
  }
  ${MONTHLY_EXPENSE_FRAGMENT}
`;
