import { gql, TypedDocumentNode } from "@apollo/client";
import { registroCassaFragment } from "./fragments";

// Submit (create or update) cash register
interface SubmitRegistroCassaData {
  gestioneCassa: {
    mutateRegistroCassa: RegistroCassa;
  };
}

export interface ConteggioMonetaInput {
  denominazioneMonetaId: number;
  quantita: number;
}

export interface SpesaCassaInput {
  descrizione: string;
  importo: number;
  // Categoria NON tracciata: se assente il backend applica il default "Altro".
  categoria?: CategoriaSpesa;
}

export interface PagamentoFornitoreRegistroInput {
  pagamentoId?: number;
  fornitoreId: number;
  numeroDdt: string;
  importo: number;
  metodoPagamento?: string;
  tipoDocumento: "FA" | "DDT";
  numeroFattura?: string;
  fatturaId?: number;
  ddtId?: number;
  dataFattura?: string;
  dataDdt?: string;
  aliquotaIva?: number;
  // Categoria (opzionale): valorizzata solo per le spese fisse pagate in modo tracciato.
  categoria?: CategoriaSpesa;
}

export interface RegistroCassaInput {
  id?: number;
  data: string;
  utenteId: number;
  conteggiApertura: ConteggioMonetaInput[];
  conteggiChiusura: ConteggioMonetaInput[];
  spese: SpesaCassaInput[];
  pagamentiFornitori: PagamentoFornitoreRegistroInput[];
  incassoContanteTracciato: number;
  incassiElettronici: number;
  incassiFattura: number;
  speseFornitori: number;
  speseGiornaliere: number;
  note?: string;
  stato: StatoRegistroCassa;
}

export interface SubmitRegistroCassaValues {
  registroCassa: RegistroCassaInput;
}

export const mutationSubmitRegistroCassa: TypedDocumentNode<SubmitRegistroCassaData, SubmitRegistroCassaValues> = gql`
  ${registroCassaFragment}
  mutation SubmitRegistroCassa($registroCassa: RegistroCassaInput!) {
    gestioneCassa {
      mutateRegistroCassa(registroCassa: $registroCassa) {
        ...RegistroCassaFragment
      }
    }
  }
`;

// Close cash register (change status to CLOSED)
interface ChiudiRegistroCassaData {
  gestioneCassa: {
    chiudiRegistroCassa: RegistroCassa;
  };
}

interface ChiudiRegistroCassaValues {
  registroCassaId: number;
}

export const mutationChiudiRegistroCassa: TypedDocumentNode<ChiudiRegistroCassaData, ChiudiRegistroCassaValues> = gql`
  ${registroCassaFragment}
  mutation ChiudiRegistroCassa($registroCassaId: Int!) {
    gestioneCassa {
      chiudiRegistroCassa(registroCassaId: $registroCassaId) {
        ...RegistroCassaFragment
      }
    }
  }
`;

// Delete cash register
interface EliminaRegistroCassaData {
  gestioneCassa: {
    eliminaRegistroCassa: boolean;
  };
}

interface EliminaRegistroCassaValues {
  registroCassaId: number;
}

export const mutationEliminaRegistroCassa: TypedDocumentNode<EliminaRegistroCassaData, EliminaRegistroCassaValues> = gql`
  mutation EliminaRegistroCassa($registroCassaId: Int!) {
    gestioneCassa {
      eliminaRegistroCassa(registroCassaId: $registroCassaId)
    }
  }
`;

// ============ MUTATION: Aggiungi Spesa su Giorno (registro "leggero") ============
// Registra una spesa fissa su un giorno anche in assenza di registro operativo
// (bypassa il solo guard giorno-operativo, mantiene GuardMeseChiuso).
// tracciata=true → PagamentoFornitore; tracciata=false → SpesaCassa.
// TODO: nessuna UI dedicata prevista dal design corrente; la mutation è esposta
// per uso futuro (es. registrazione affitto in giorno di chiusura).

export interface AggiungiSpesaSuGiornoInput {
  data: string;
  descrizione: string;
  importo: number;
  categoria: CategoriaSpesa;
  tracciata: boolean;
  metodoPagamento?: string;
  utenteId: number;
}

interface AggiungiSpesaSuGiornoData {
  gestioneCassa: {
    aggiungiSpesaSuGiorno: RegistroCassa | null;
  };
}

interface AggiungiSpesaSuGiornoValues {
  input: AggiungiSpesaSuGiornoInput;
}

export const mutationAggiungiSpesaSuGiorno: TypedDocumentNode<AggiungiSpesaSuGiornoData, AggiungiSpesaSuGiornoValues> = gql`
  ${registroCassaFragment}
  mutation AggiungiSpesaSuGiorno($input: AggiungiSpesaSuGiornoInput!) {
    gestioneCassa {
      aggiungiSpesaSuGiorno(input: $input) {
        ...RegistroCassaFragment
      }
    }
  }
`;
