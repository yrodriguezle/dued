import { gql, TypedDocumentNode, useQuery } from "@apollo/client";
import { chiusuraMensileFragment } from "./fragments";

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
  const { data, loading, error, refetch } = useQuery<{ chiusureMensili: { chiusureMensili: ChiusuraMensile[] } }>(
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

interface GetChiusuraMensileData {
  chiusureMensili: {
    chiusuraMensile: ChiusuraMensile;
  }
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
  const { data, loading, error, refetch } = useQuery<{ chiusuraMensile: { chiusuraMensile: ChiusuraMensile } }>(
    getChiusuraMensileById,
    {
      variables: { chiusuraId },
      skip: !chiusuraId,
    }
  );

  return {
    chiusuraMensile: data?.chiusuraMensile.chiusuraMensile,
    loading,
    error,
    refetch,
  };
}
