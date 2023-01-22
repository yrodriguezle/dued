import { useCallback } from 'react';
import { gql, useApolloClient } from '@apollo/client';

import { GET_CURRENT_USER } from '../queries';

function useCallbackGetLoggedUser() {
  const client = useApolloClient();
  return useCallback(
    async (fetchPolicy = 'network-only') => client.query({
      query: gql`${GET_CURRENT_USER}`,
      fetchPolicy,
    }),
    [client],
  );
}

export default useCallbackGetLoggedUser;
