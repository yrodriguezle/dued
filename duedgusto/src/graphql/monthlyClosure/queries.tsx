// src/graphql/monthlyClosure/queries.tsx
import { gql, useQuery } from "@apollo/client";
import { MONTHLY_CLOSURE_FRAGMENT } from "./fragments";

export const GET_MONTHLY_CLOSURES = gql`
  query GetMonthlyClosures($year: Int!) {
    monthlyClosures(year: $year) {
      ...MonthlyClosureFragment
    }
  }
  ${MONTHLY_CLOSURE_FRAGMENT}
`;

export const GET_MONTHLY_CLOSURE_BY_ID = gql`
    query GetMonthlyClosure($closureId: Int!) {
        monthlyClosure(closureId: $closureId) {
            ...MonthlyClosureFragment
        }
    }
    ${MONTHLY_CLOSURE_FRAGMENT}
`;

export const useQueryMonthlyClosures = ({ year }: { year: number }) => {
    const { data, loading, error, refetch } = useQuery<{ monthlyClosures: MonthlyClosure[] }>(
        GET_MONTHLY_CLOSURES,
        {
            variables: { year },
            skip: !year,
        }
    );

    return {
        monthlyClosures: data?.monthlyClosures || [],
        loading,
        error,
        refetch,
    };
};

export const useQueryMonthlyClosure = ({ closureId }: { closureId: number }) => {
    const { data, loading, error, refetch } = useQuery<{ monthlyClosure: MonthlyClosure }>(
        GET_MONTHLY_CLOSURE_BY_ID,
        {
            variables: { closureId },
            skip: !closureId,
        }
    );

    return {
        monthlyClosure: data?.monthlyClosure,
        loading,
        error,
        refetch,
    };
}
