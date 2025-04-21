import { TypedDocumentNode, gql } from "@apollo/client";
import { userFragment } from "./fragment";

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
export const mutationRefreshToken: TypedDocumentNode<RefreshTokenData, RefreshTokenValues> = gql`
  mutation RefreshToken($refreshToken: String!) {
    authentication {
      refreshToken(refreshToken: $refreshToken) {
        token
        refreshToken
      }
    }
  }
`;

interface SubmitUserData {
  authentication: {
    mutateUser: User;
  };
}
interface SubmitUserValues {
  user: User;
}
export const mutationSubmitUser: TypedDocumentNode<SubmitUserData, SubmitUserValues> = gql`
  ${userFragment}
  mutation SubmitUser($user: UserInput!) {
    authentication {
      mutateUser(user: $user) {
        ...UserFragment
      }
    }
  }
`;

