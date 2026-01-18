// src/graphql/monthlyClosure/mutations.tsx
import { gql, useMutation } from "@apollo/client";
import { MONTHLY_CLOSURE_FRAGMENT } from "./fragments";

export const MUTATE_MONTHLY_CLOSURE = gql`
  mutation MutateMonthlyClosure($input: MonthlyClosureInput!) {
    mutateMonthlyClosure(input: $input) {
      ...MonthlyClosureFragment
    }
  }
  ${MONTHLY_CLOSURE_FRAGMENT}
`;

export const useMutationMonthlyClosure = () => {
    const [mutate, { data, loading, error }] = useMutation(MUTATE_MONTHLY_CLOSURE);

    return {
        mutateMonthlyClosure: mutate,
        data: data?.mutateMonthlyClosure,
        loading,
        error,
    };
};
