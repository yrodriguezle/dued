import { userFragment } from './fragments';

export const REFRESH_TOKEN = (`
  query RefreshAccessToken($token: String!, $refreshToken: String!) {
    account {
      refreshAccessToken(token: $token, refreshToken: $refreshToken)
    }
  }
`);

export const GET_CURRENT_USER = (`
  ${userFragment}
  query GetCurrentUser {
    account {
      currentUser {
        ...UserFragment
      }
    }
  }
`);
