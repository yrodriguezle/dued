import { gql, TypedDocumentNode } from "@apollo/client";
import { fornitoreFragment, fatturaAcquistoFragment, documentoTrasportoFragment, pagamentoFornitoreFragment } from "./fragments";

// ============ FORNITORE MUTATIONS ============

interface MutateFornitoreData {
  fornitori: {
    mutateFornitore: Fornitore;
  };
}

interface MutateFornitoreVariables {
  fornitore: FornitoreInput;
}

export const mutationMutateFornitore: TypedDocumentNode<MutateFornitoreData, MutateFornitoreVariables> = gql`
  ${fornitoreFragment}
  mutation MutateFornitore($fornitore: FornitoreInput!) {
    fornitori {
      mutateFornitore(fornitore: $fornitore) {
        ...FornitoreFragment
      }
    }
  }
`;

interface DeleteFornitoreData {
  fornitori: {
    deleteFornitore: boolean;
  };
}

interface DeleteFornitoreVariables {
  fornitoreId: number;
}

export const mutationDeleteFornitore: TypedDocumentNode<DeleteFornitoreData, DeleteFornitoreVariables> = gql`
  mutation DeleteFornitore($fornitoreId: Int!) {
    fornitori {
      deleteFornitore(fornitoreId: $fornitoreId)
    }
  }
`;

// ============ FATTURA ACQUISTO MUTATIONS ============

interface MutateFatturaAcquistoData {
  fornitori: {
    mutateFatturaAcquisto: FatturaAcquisto;
  };
}

interface MutateFatturaAcquistoVariables {
  fattura: FatturaAcquistoInput;
}

export const mutationMutateFatturaAcquisto: TypedDocumentNode<MutateFatturaAcquistoData, MutateFatturaAcquistoVariables> = gql`
  ${fatturaAcquistoFragment}
  mutation MutateFatturaAcquisto($fattura: FatturaAcquistoInput!) {
    fornitori {
      mutateFatturaAcquisto(fattura: $fattura) {
        ...FatturaAcquistoFragment
      }
    }
  }
`;

interface DeleteFatturaAcquistoData {
  fornitori: {
    deleteFatturaAcquisto: boolean;
  };
}

interface DeleteFatturaAcquistoVariables {
  fatturaId: number;
}

export const mutationDeleteFatturaAcquisto: TypedDocumentNode<DeleteFatturaAcquistoData, DeleteFatturaAcquistoVariables> = gql`
  mutation DeleteFatturaAcquisto($fatturaId: Int!) {
    fornitori {
      deleteFatturaAcquisto(fatturaId: $fatturaId)
    }
  }
`;

// ============ DOCUMENTO TRASPORTO MUTATIONS ============

interface MutateDocumentoTrasportoData {
  fornitori: {
    mutateDocumentoTrasporto: DocumentoTrasporto;
  };
}

interface MutateDocumentoTrasportoVariables {
  documentoTrasporto: DocumentoTrasportoInput;
}

export const mutationMutateDocumentoTrasporto: TypedDocumentNode<MutateDocumentoTrasportoData, MutateDocumentoTrasportoVariables> = gql`
  ${documentoTrasportoFragment}
  mutation MutateDocumentoTrasporto($documentoTrasporto: DocumentoTrasportoInput!) {
    fornitori {
      mutateDocumentoTrasporto(documentoTrasporto: $documentoTrasporto) {
        ...DocumentoTrasportoFragment
      }
    }
  }
`;

interface DeleteDocumentoTrasportoData {
  fornitori: {
    deleteDocumentoTrasporto: boolean;
  };
}

interface DeleteDocumentoTrasportoVariables {
  ddtId: number;
}

export const mutationDeleteDocumentoTrasporto: TypedDocumentNode<DeleteDocumentoTrasportoData, DeleteDocumentoTrasportoVariables> = gql`
  mutation DeleteDocumentoTrasporto($ddtId: Int!) {
    fornitori {
      deleteDocumentoTrasporto(ddtId: $ddtId)
    }
  }
`;

// ============ PAGAMENTO FORNITORE MUTATIONS ============

interface MutatePagamentoFornitoreData {
  fornitori: {
    mutatePagamentoFornitore: PagamentoFornitore;
  };
}

interface MutatePagamentoFornitoreVariables {
  pagamento: PagamentoFornitoreInput;
}

export const mutationMutatePagamentoFornitore: TypedDocumentNode<MutatePagamentoFornitoreData, MutatePagamentoFornitoreVariables> = gql`
  ${pagamentoFornitoreFragment}
  mutation MutatePagamentoFornitore($pagamento: PagamentoFornitoreInput!) {
    fornitori {
      mutatePagamentoFornitore(pagamento: $pagamento) {
        ...PagamentoFornitoreFragment
      }
    }
  }
`;

interface DeletePagamentoFornitoreData {
  fornitori: {
    deletePagamentoFornitore: boolean;
  };
}

interface DeletePagamentoFornitoreVariables {
  pagamentoId: number;
}

export const mutationDeletePagamentoFornitore: TypedDocumentNode<DeletePagamentoFornitoreData, DeletePagamentoFornitoreVariables> = gql`
  mutation DeletePagamentoFornitore($pagamentoId: Int!) {
    fornitori {
      deletePagamentoFornitore(pagamentoId: $pagamentoId)
    }
  }
`;
