import { TypedDocumentNode, gql } from "@apollo/client";

interface SignInData {
  authentication: {
    signIn: AuthToken;
  };
}

export type SigninValues = {
  username: string;
  password: string;
};

export const mutationSignIn: TypedDocumentNode<SignInData, SigninValues> = gql`
  mutation SignIn($username: String!, $password: String!) {
    authentication {
      signIn(username: $username, password: $password) {
        token
        refreshToken
      }
    }
  }
`;

interface RefreshTokenData {
  authentication: {
    refreshToken: AuthToken;
  };
}
interface RefreshTokenValues {
  refreshToken: string;
}
export const mutationRefreshToken: TypedDocumentNode<
  RefreshTokenData,
  RefreshTokenValues
> = gql`
  mutation RefreshToken($refreshToken: String!) {
    authentication {
      refreshToken(refreshToken: $refreshToken) {
        token
        refreshToken
      }
    }
  }
`;
