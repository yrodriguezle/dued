// src/graphql/monthlyClosure/queries.tsx
import { gql, useQuery } from "@apollo/client";
import { MONTHLY_CLOSURE_FRAGMENT } from "./fragments";

export const GET_CHIUSURE_MENSILI = gql`
  query GetChiusureMensili($anno: Int!) {
    chiusureMensili(anno: $anno) {
      ...ChiusuraMensileFragment
    }
  }
  ${MONTHLY_CLOSURE_FRAGMENT}
`;

export const GET_CHIUSURA_MENSILE_BY_ID = gql`
    query GetChiusuraMensile($chiusuraId: Int!) {
        chiusuraMensile(chiusuraId: $chiusuraId) {
            ...ChiusuraMensileFragment
        }
    }
    ${MONTHLY_CLOSURE_FRAGMENT}
`;

export const useQueryChiusureMensili = ({ anno }: { anno: number }) => {
    const { data, loading, error, refetch } = useQuery<{ chiusureMensili: MonthlyClosure[] }>(
        GET_CHIUSURE_MENSILI,
        {
            variables: { anno },
            skip: !anno,
        }
    );

    return {
        chiusureMensili: data?.chiusureMensili || [],
        loading,
        error,
        refetch,
    };
};

export const useQueryChiusuraMensile = ({ chiusuraId }: { chiusuraId: number }) => {
    const { data, loading, error, refetch } = useQuery<{ chiusuraMensile: MonthlyClosure }>(
        GET_CHIUSURA_MENSILE_BY_ID,
        {
            variables: { chiusuraId },
            skip: !chiusuraId,
        }
    );

    return {
        chiusuraMensile: data?.chiusuraMensile,
        loading,
        error,
        refetch,
    };
}
