import { useMemo } from "react";
import { gql, TypedDocumentNode, useQuery } from "@apollo/client";
import { chiusuraMensileFragment } from "./fragments";

// ============ QUERY: Lista chiusure mensili per anno ============

interface GetChiusureMensiliData {
  chiusureMensili: {
    chiusureMensili: ChiusuraMensile[];
  };
}

interface GetChiusureMensiliVariables {
  anno: number;
}

export const getChiusureMensili: TypedDocumentNode<GetChiusureMensiliData, GetChiusureMensiliVariables> = gql`
  query GetChiusureMensili($anno: Int!) {
    chiusureMensili {
      chiusureMensili(anno: $anno) {
        ...ChiusuraMensileFragment
      }
    }
  }
  ${chiusuraMensileFragment}
`;

export const useQueryChiusureMensili = ({ anno }: { anno: number }) => {
  const { data, loading, error, refetch } = useQuery<GetChiusureMensiliData>(
    getChiusureMensili,
    {
      variables: { anno },
      skip: !anno,
    }
  );

  return {
    chiusureMensili: data?.chiusureMensili.chiusureMensili || [],
    loading,
    error,
    refetch,
  };
};

// ============ QUERY: Singola chiusura mensile per ID ============

interface GetChiusuraMensileData {
  chiusureMensili: {
    chiusuraMensile: ChiusuraMensile;
  };
}

interface GetChiusuraMensileVariables {
  chiusuraId: number;
}

export const getChiusuraMensileById: TypedDocumentNode<GetChiusuraMensileData, GetChiusuraMensileVariables> = gql`
  query GetChiusuraMensile($chiusuraId: Int!) {
    chiusureMensili {
      chiusuraMensile(chiusuraId: $chiusuraId) {
        ...ChiusuraMensileFragment
      }
    }
  }
  ${chiusuraMensileFragment}
`;

export const useQueryChiusuraMensile = ({ chiusuraId }: { chiusuraId: number }) => {
  const { data, loading, error, refetch } = useQuery<GetChiusuraMensileData>(
    getChiusuraMensileById,
    {
      variables: { chiusuraId },
      skip: !chiusuraId,
    }
  );

  return {
    chiusuraMensile: data?.chiusureMensili.chiusuraMensile,
    loading,
    error,
    refetch,
  };
};

// ============ QUERY: Validazione completezza registri ============

interface ValidaCompletezzaRegistriData {
  chiusureMensili: {
    validaCompletezzaRegistri: string[];
  };
}

interface ValidaCompletezzaRegistriVariables {
  anno: number;
  mese: number;
}

export const getValidaCompletezzaRegistri: TypedDocumentNode<ValidaCompletezzaRegistriData, ValidaCompletezzaRegistriVariables> = gql`
  query ValidaCompletezzaRegistri($anno: Int!, $mese: Int!) {
    chiusureMensili {
      validaCompletezzaRegistri(anno: $anno, mese: $mese)
    }
  }
`;

const EMPTY_GIORNI: string[] = [];

export const useQueryValidaCompletezzaRegistri = ({ anno, mese, skip }: { anno: number; mese: number; skip?: boolean }) => {
  const { data, loading, error, refetch } = useQuery<ValidaCompletezzaRegistriData>(
    getValidaCompletezzaRegistri,
    {
      variables: { anno, mese },
      skip: skip || !anno || !mese,
    }
  );

  const giorniMancanti = useMemo(
    () => data?.chiusureMensili.validaCompletezzaRegistri ?? EMPTY_GIORNI,
    [data?.chiusureMensili.validaCompletezzaRegistri]
  );

  return {
    giorniMancanti,
    loading,
    error,
    refetch,
  };
};
