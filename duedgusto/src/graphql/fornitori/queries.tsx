import { gql, TypedDocumentNode } from "@apollo/client";
import { fornitoreFragment, fatturaAcquistoFragment, documentoTrasportoFragment, pagamentoFornitoreFragment } from "./fragments";

// Get all fornitori
interface GetFornitoriData {
  fornitori: {
    fornitori: Fornitore[];
  };
}

export const getFornitori: TypedDocumentNode<GetFornitoriData> = gql(`
  ${fornitoreFragment}
  query GetFornitori {
    fornitori {
      fornitori {
        ...FornitoreFragment
      }
    }
  }`);

// Get fornitori with pagination
export const getFornitoriConnection = gql(`
  ${fornitoreFragment}
  query GetFornitoriConnection($pageSize: Int!, $where: String, $orderBy: String, $cursor: Int) {
    connection {
      fornitori(first: $pageSize, where: $where, orderBy: $orderBy, cursor: $cursor) {
        totalCount
        pageInfo {
          hasNextPage
          endCursor
          hasPreviousPage
          startCursor
        }
        edges {
          node {
            ...FornitoreFragment
          }
          cursor
        }
      }
    }
  }`);

// Get single fornitore by ID
interface GetFornitoreData {
  fornitori: {
    fornitore: Fornitore;
  };
}

interface GetFornitoreVariables {
  fornitoreId: number;
}

export const getFornitore: TypedDocumentNode<GetFornitoreData, GetFornitoreVariables> = gql(`
  ${fornitoreFragment}
  query GetFornitore($fornitoreId: Int!) {
    fornitori {
      fornitore(fornitoreId: $fornitoreId) {
        ...FornitoreFragment
      }
    }
  }`);

// Get fatture acquisto with pagination
export const getFattureAcquistoConnection = gql(`
  ${fatturaAcquistoFragment}
  query GetFattureAcquistoConnection($pageSize: Int!, $where: String, $orderBy: String, $cursor: Int) {
    connection {
      fattureAcquisto(first: $pageSize, where: $where, orderBy: $orderBy, cursor: $cursor) {
        totalCount
        pageInfo {
          hasNextPage
          endCursor
          hasPreviousPage
          startCursor
        }
        edges {
          node {
            ...FatturaAcquistoFragment
          }
          cursor
        }
      }
    }
  }`);

// Get single fattura acquisto by ID
interface GetFatturaAcquistoData {
  fornitori: {
    fatturaAcquisto: FatturaAcquisto;
  };
}

interface GetFatturaAcquistoVariables {
  fatturaId: number;
}

export const getFatturaAcquisto: TypedDocumentNode<GetFatturaAcquistoData, GetFatturaAcquistoVariables> = gql(`
  ${fatturaAcquistoFragment}
  ${documentoTrasportoFragment}
  ${pagamentoFornitoreFragment}
  query GetFatturaAcquisto($fatturaId: Int!) {
    fornitori {
      fatturaAcquisto(fatturaId: $fatturaId) {
        ...FatturaAcquistoFragment
        documentiTrasporto { ...DocumentoTrasportoFragment }
        pagamenti { ...PagamentoFornitoreFragment }
      }
    }
  }`);

// Get documenti trasporto with pagination
export const getDocumentiTrasportoConnection = gql(`
  ${documentoTrasportoFragment}
  query GetDocumentiTrasportoConnection($pageSize: Int!, $where: String, $orderBy: String, $cursor: Int) {
    connection {
      documentiTrasporto(first: $pageSize, where: $where, orderBy: $orderBy, cursor: $cursor) {
        totalCount
        pageInfo {
          hasNextPage
          endCursor
          hasPreviousPage
          startCursor
        }
        edges {
          node {
            ...DocumentoTrasportoFragment
          }
          cursor
        }
      }
    }
  }`);

// Get single documento trasporto by ID
interface GetDocumentoTrasportoData {
  fornitori: {
    documentoTrasporto: DocumentoTrasporto;
  };
}

interface GetDocumentoTrasportoVariables {
  ddtId: number;
}

export const getDocumentoTrasporto: TypedDocumentNode<GetDocumentoTrasportoData, GetDocumentoTrasportoVariables> = gql(`
  ${documentoTrasportoFragment}
  ${pagamentoFornitoreFragment}
  query GetDocumentoTrasporto($ddtId: Int!) {
    fornitori {
      documentoTrasporto(ddtId: $ddtId) {
        ...DocumentoTrasportoFragment
        pagamenti { ...PagamentoFornitoreFragment }
      }
    }
  }`);

// Get pagamenti fornitori with pagination
export const getPagamentiFornitoreConnection = gql(`
  ${pagamentoFornitoreFragment}
  query GetPagamentiFornitoreConnection($pageSize: Int!, $where: String, $orderBy: String, $cursor: Int) {
    connection {
      pagamentiFornitori(first: $pageSize, where: $where, orderBy: $orderBy, cursor: $cursor) {
        totalCount
        pageInfo {
          hasNextPage
          endCursor
          hasPreviousPage
          startCursor
        }
        edges {
          node {
            ...PagamentoFornitoreFragment
          }
          cursor
        }
      }
    }
  }`);
