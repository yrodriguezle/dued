import { useCallback } from 'react';

function useSubmitLogin() {
  return useCallback(
    async ({ username, password }) => {
      const response = await fetch(
        `${global.API_ENDPOINT}/api/authentication/login`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          cache: 'no-store',
          body: JSON.stringify({
            username,
            password,
          }),
        },
      );
      return response.json();
    },
    [],
  );
}

export default useSubmitLogin;
