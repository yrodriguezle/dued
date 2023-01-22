/* eslint-disable import/prefer-default-export */

export const LOGIN = (`
  mutation Login($username: String!, $password: String!) {
    account {
      login(username: $username, password: $password) {
        token
        refreshToken
      }
    }
  }
`);
